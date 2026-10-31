// Where the Get-Tandrix buttons lead. Until the signed Mac build and the TestFlight link are public,
// they lead to the early-access sign-up on the home page, so no button ever dead-ends.
const env = (v: string | undefined) => (v && /^https:\/\//.test(v) ? v : undefined);

export const MAC_DOWNLOAD_URL = env(process.env.NEXT_PUBLIC_MAC_DOWNLOAD_URL) ?? "/#early";
export const IPHONE_DOWNLOAD_URL = env(process.env.NEXT_PUBLIC_IPHONE_DOWNLOAD_URL) ?? "/#early";
/** The public source, when there is one. */
export const SOURCE_URL = env(process.env.NEXT_PUBLIC_SOURCE_URL);
/** True while the buttons lead to the sign-up rather than a download. */
export const EARLY_ACCESS = !env(process.env.NEXT_PUBLIC_MAC_DOWNLOAD_URL);
/** What the buttons say: never "Download" until there's something to download. */
export const GET_LABEL = EARLY_ACCESS ? "Get early access" : "Download";
export const GET_MAC_LABEL = EARLY_ACCESS ? "Get early access" : "Download for Mac";

/** Opens in a new tab only when it leaves the site. */
export const isExternal = (url: string) => url.startsWith("https://");
