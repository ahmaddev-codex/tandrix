import { describe, expect, it } from "vitest";
import { FetchRefused, isBlockedAddress, safeFetchPdf, type Transport } from "../src/safe-fetch";

const PDF = new TextEncoder().encode("%PDF-1.7\n...");
const PUBLIC = [{ address: "93.184.215.14", family: 4 }];

/** Answers by URL; records every connection it was asked to make. */
function web(routes: Record<string, Awaited<ReturnType<Transport["get"]>>>) {
  const calls: Array<{ url: string; address: string }> = [];
  const transport: Transport = {
    async get(url, address) {
      calls.push({ url: url.toString(), address: address.address });
      return routes[url.toString()] ?? { status: 404 };
    },
  };
  return { calls, transport };
}

const opts = (transport: Transport, resolve = async (_h: string) => PUBLIC) => ({
  maxBytes: 1000,
  timeoutMs: 1000,
  resolve,
  transport,
});

async function refusal(p: Promise<unknown>) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(FetchRefused);
  return (e as FetchRefused).reason;
}

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fe80::1",
    "fd00::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "not-an-ip",
  ])("blocks %s", (a) => expect(isBlockedAddress(a)).toBe(true));

  it.each(["93.184.215.14", "8.8.8.8", "2606:4700::1111"])("allows %s", (a) =>
    expect(isBlockedAddress(a)).toBe(false),
  );
});

describe("safeFetchPdf", () => {
  it("downloads a public PDF, connecting to the address it checked", async () => {
    const w = web({ "https://maker.example/m.pdf": { status: 200, body: PDF } });
    const r = await safeFetchPdf("https://maker.example/m.pdf", opts(w.transport));
    expect(r.finalUrl).toBe("https://maker.example/m.pdf");
    expect(r.bytes).toEqual(PDF);
    expect(w.calls).toEqual([{ url: "https://maker.example/m.pdf", address: "93.184.215.14" }]);
  });

  it.each([
    ["http://maker.example/m.pdf", "bad_url"],
    ["https://user:pw@maker.example/m.pdf", "bad_url"],
    ["https://maker.example:8443/m.pdf", "bad_url"],
    ["https://127.0.0.1/m.pdf", "blocked_address"],
    ["https://169.254.169.254/latest/meta-data", "blocked_address"],
    ["https://[::1]/m.pdf", "blocked_address"],
    ["not a url", "bad_url"],
  ])("refuses %s before connecting", async (url, reason) => {
    const w = web({});
    expect(await refusal(safeFetchPdf(url, opts(w.transport)))).toBe(reason);
    expect(w.calls).toEqual([]);
  });

  it("refuses a hostname that resolves to a private address", async () => {
    const w = web({});
    const resolve = async () => [{ address: "10.0.0.5", family: 4 }];
    expect(
      await refusal(safeFetchPdf("https://intranet.example/m.pdf", opts(w.transport, resolve))),
    ).toBe("blocked_address");
    expect(w.calls).toEqual([]);
  });

  it("refuses when any resolved address is private", async () => {
    const w = web({});
    const resolve = async () => [...PUBLIC, { address: "127.0.0.1", family: 4 }];
    expect(
      await refusal(safeFetchPdf("https://mixed.example/m.pdf", opts(w.transport, resolve))),
    ).toBe("blocked_address");
  });

  it("re-checks redirects and refuses one to an internal address", async () => {
    const w = web({
      "https://maker.example/m.pdf": { status: 302, location: "https://169.254.169.254/creds" },
    });
    expect(await refusal(safeFetchPdf("https://maker.example/m.pdf", opts(w.transport)))).toBe(
      "blocked_address",
    );
    expect(w.calls).toHaveLength(1);
  });

  it("refuses a redirect to http", async () => {
    const w = web({
      "https://maker.example/m.pdf": { status: 301, location: "http://maker.example/m.pdf" },
    });
    expect(await refusal(safeFetchPdf("https://maker.example/m.pdf", opts(w.transport)))).toBe(
      "bad_url",
    );
  });

  it("follows a safe redirect and reports where it ended", async () => {
    const w = web({
      "https://maker.example/m.pdf": { status: 302, location: "/files/m.pdf" },
      "https://maker.example/files/m.pdf": { status: 200, body: PDF },
    });
    const r = await safeFetchPdf("https://maker.example/m.pdf", opts(w.transport));
    expect(r.finalUrl).toBe("https://maker.example/files/m.pdf");
  });

  it("stops after too many redirects", async () => {
    const w = web({
      "https://a.example/1": { status: 302, location: "https://a.example/2" },
      "https://a.example/2": { status: 302, location: "https://a.example/1" },
    });
    expect(await refusal(safeFetchPdf("https://a.example/1", opts(w.transport)))).toBe(
      "too_many_redirects",
    );
    expect(w.calls).toHaveLength(4);
  });

  it("refuses a page that isn't a PDF", async () => {
    const w = web({
      "https://maker.example/m.pdf": {
        status: 200,
        body: new TextEncoder().encode("<html>login</html>"),
      },
    });
    expect(await refusal(safeFetchPdf("https://maker.example/m.pdf", opts(w.transport)))).toBe(
      "not_pdf",
    );
  });

  it("reports a site error", async () => {
    const w = web({});
    expect(await refusal(safeFetchPdf("https://maker.example/gone.pdf", opts(w.transport)))).toBe(
      "http_error",
    );
  });

  it("turns a DNS failure into a refusal", async () => {
    const w = web({});
    const resolve = async () => {
      throw new Error("ENOTFOUND");
    };
    expect(
      await refusal(safeFetchPdf("https://nowhere.example/m.pdf", opts(w.transport, resolve))),
    ).toBe("network");
  });
});
