// Downloads a PDF from a public https URL without letting it reach internal addresses (SSRF).
// Every hop is resolved and checked; the connection is pinned to the checked address so DNS
// rebinding can't swap it; redirects are re-checked; size and time are capped.
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

export class FetchRefused extends Error {
  constructor(
    readonly reason:
      | "bad_url"
      | "blocked_address"
      | "too_many_redirects"
      | "http_error"
      | "too_large"
      | "not_pdf"
      | "timeout"
      | "network",
    message: string,
  ) {
    super(message);
    this.name = "FetchRefused";
  }
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
  ["64:ff9b::", 96],
  ["2001:db8::", 32],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

export function isBlockedAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) return true;
  if (family === 6) {
    // IPv4-mapped IPv6 (::ffff:10.0.0.1) is checked as the IPv4 address it carries.
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
    if (mapped) return blocked.check(mapped[1]!, "ipv4");
    return blocked.check(address, "ipv6");
  }
  return blocked.check(address, "ipv4");
}

export type Resolve = (host: string) => Promise<Array<{ address: string; family: number }>>;

export interface Transport {
  /** Performs one GET to `url`, connecting only to `address`. */
  get(
    url: URL,
    address: { address: string; family: number },
    opts: { timeoutMs: number; maxBytes: number },
  ): Promise<{ status: number; location?: string; contentType?: string; body?: Uint8Array }>;
}

export interface SafeFetchOptions {
  maxBytes: number;
  timeoutMs: number;
  maxRedirects?: number;
  resolve?: Resolve;
  transport?: Transport;
}

const defaultResolve: Resolve = (host) => dnsLookup(host, { all: true, verbatim: true });

function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchRefused("bad_url", "That isn't a valid link.");
  }
  if (url.protocol !== "https:") throw new FetchRefused("bad_url", "Only https links are allowed.");
  if (url.username || url.password)
    throw new FetchRefused("bad_url", "Links with credentials aren't allowed.");
  if (url.port && url.port !== "443")
    throw new FetchRefused("bad_url", "Only the standard https port is allowed.");
  return url;
}

export async function safeFetchPdf(
  rawUrl: string,
  opts: SafeFetchOptions,
): Promise<{ bytes: Uint8Array; finalUrl: string }> {
  const resolve = opts.resolve ?? defaultResolve;
  const transport = opts.transport ?? httpsTransport;
  const maxRedirects = opts.maxRedirects ?? 3;
  let url = checkUrl(rawUrl);

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const host = url.hostname.replace(/^\[|\]$/g, "");
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await resolve(host);
    } catch {
      throw new FetchRefused("network", "Couldn't find that site.");
    }
    if (!addresses.length || addresses.some((a) => isBlockedAddress(a.address))) {
      throw new FetchRefused(
        "blocked_address",
        "That link points to a private or internal address.",
      );
    }
    const res = await transport.get(url, addresses[0]!, {
      timeoutMs: opts.timeoutMs,
      maxBytes: opts.maxBytes,
    });
    if (res.status >= 300 && res.status < 400 && res.location) {
      url = checkUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status !== 200 || !res.body) {
      throw new FetchRefused("http_error", `The site answered ${res.status}.`);
    }
    const isPdf =
      res.body.length >= 5 && Buffer.from(res.body.subarray(0, 5)).toString("latin1") === "%PDF-";
    if (!isPdf)
      throw new FetchRefused("not_pdf", "That link isn't a PDF. Upload the manual instead.");
    return { bytes: res.body, finalUrl: url.toString() };
  }
  throw new FetchRefused("too_many_redirects", "That link redirects too many times.");
}

/** node:https with the connection pinned to the vetted address; SNI and Host stay the hostname. */
export const httpsTransport: Transport = {
  get(url, address, { timeoutMs, maxBytes }) {
    return new Promise((resolvePromise, reject) => {
      // `timeout` below only catches an idle socket; this caps the whole download (slow drip).
      const deadline = setTimeout(
        () => req.destroy(new FetchRefused("timeout", "The site took too long to answer.")),
        timeoutMs,
      );
      const done =
        <T>(fn: (v: T) => void) =>
        (v: T) => {
          clearTimeout(deadline);
          fn(v);
        };
      resolvePromise = done(resolvePromise);
      reject = done(reject);
      const req = httpsRequest(
        url,
        {
          method: "GET",
          headers: {
            "user-agent": "Tandrix/1.0 (+manual fetch)",
            accept: "application/pdf,*/*;q=0.5",
          },
          lookup: (_h, _o, cb) => cb(null, address.address, address.family),
          timeout: timeoutMs,
        },
        (res) => {
          const status = res.statusCode ?? 0;
          if (status >= 300 && status < 400) {
            res.resume();
            return resolvePromise({
              status,
              ...(res.headers.location ? { location: res.headers.location } : {}),
            });
          }
          const declared = Number(res.headers["content-length"] ?? 0);
          if (declared > maxBytes) {
            res.destroy();
            return reject(new FetchRefused("too_large", "The file is too large."));
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (c: Buffer) => {
            size += c.length;
            if (size > maxBytes) {
              res.destroy();
              reject(new FetchRefused("too_large", "The file is too large."));
            } else chunks.push(c);
          });
          res.on("end", () =>
            resolvePromise({
              status,
              ...(res.headers["content-type"] ? { contentType: res.headers["content-type"] } : {}),
              body: new Uint8Array(Buffer.concat(chunks)),
            }),
          );
          res.on("error", () => reject(new FetchRefused("network", "The download failed.")));
        },
      );
      req.on("timeout", () =>
        req.destroy(new FetchRefused("timeout", "The site took too long to answer.")),
      );
      req.on("error", (e) =>
        reject(
          e instanceof FetchRefused ? e : new FetchRefused("network", "Couldn't reach that site."),
        ),
      );
      req.end();
    });
  },
};
