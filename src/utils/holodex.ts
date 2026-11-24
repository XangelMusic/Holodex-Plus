import { tabs, Tabs } from "webextension-polyfill";
import { Options } from "@utils";

const HOLODEX_URL_HOME = "https://holodex.net";
const HOLODEX_URL_REGEX = /^(?:[^:]+:\/\/)?(?:[^\/]+\.)?holodex.net\b/i;
const YOUTUBE_HOSTNAME_REGEX = /^(?:[^\/]+\.)?youtube.com/i;
const FEED_PATHNAME_REGEX = /^(?:\/?$|\/feed\b)/i; // pathname matches homepage or any feed like subscriptions
const CHANNEL_URL_REGEX = /(?<=[=\/?&#])[A-Za-z0-9\-_]{24}(?=[=\/?&#]|$)/;
const VIDEO_URL_REGEX = /(?<=[=\/?&#])[A-Za-z0-9\-_]{11}(?=[=\/?&#]|$)/;
const CANONICAL_URL_REGEX =
  /\/(?:channel\/[A-Za-z0-9\-_]{24}|(?:shorts\/|watch\?v=)[A-Za-z0-9\-_]{11})\b/;

export async function openHolodexUrl(url: string, tab?: Tabs.Tab, isMultiview: boolean = false) {
  const holodexUrl = await getHolodexUrl(url, isMultiview);
  if (!holodexUrl) return;

  const isNewTab = tab?.url === "about:newtab" || tab?.url === "about:home" || tab?.url === "about:blank";
  const currentTabId = tab?.id;

  if (tab && !isNewTab && (holodexUrl === HOLODEX_URL_HOME || await Options.get("openHolodexInNewTab")))
    await tabs.create({ url: holodexUrl, index: tab.index + 1 });
  else if (currentTabId)
    await tabs.update(currentTabId, { url: holodexUrl });
  else
    // fallback behavior
    await tabs.create({ url: holodexUrl });
}

/**
 * Returns a promise resolving to the Holodex URL for given URL.
 * Supports returning Holodex channel and watch Holodex URLs,
 * and defaults to Holodex homepage for non-YT URLs and YT homepage & feeds.
 * For other YT URLs, including the new @<channel> URLs, delegates to given handler,
 * which is passed the given URL and returns a promise resolving to a YT canonical URL,
 * from which to derive the Holodex URL from.
 */
export async function getHolodexUrl(url: string | undefined, isMultiview: boolean) {
  if (url) {
    if (HOLODEX_URL_REGEX.test(url)) {
      const { pathname } = new URL(url);

      /** Open a new tab to Holodex home when watching a stream or video */
      if (pathname.startsWith("/watch")) {
        return HOLODEX_URL_HOME;
      }

      /** Do nothing on Homepage, Favorites, Multiview, or other Holodex pages */
      return null;
    }

    /** Match with given URL */
    const result = matchUrl(url, isMultiview);
    if (result)
      return result;

    /** Match with canonical URL */
    const urlObj = new URL(url);
    if (YOUTUBE_HOSTNAME_REGEX.test(urlObj.hostname) && !FEED_PATHNAME_REGEX.test(urlObj.pathname)) {
      const canonicalUrl = await findCanonicalUrl(url);

      if (canonicalUrl) {
        const result = matchUrl(canonicalUrl, isMultiview);
        if (result)
          return result;
      }
    }
  }

  /** Return Holodex URL after all tests exhausted */
  return HOLODEX_URL_HOME.concat(isMultiview ? `/multiview` : ``);
}

/** Attempt to match given URL */
function matchUrl(testUrl: string, isMultiview: boolean): string | undefined {
  const videoMatch = testUrl.match(VIDEO_URL_REGEX);
  if (videoMatch) {

    return isMultiview
      ? HOLODEX_URL_HOME.concat(`/multiview/AAUY${ videoMatch[0] }%2CUAEYchat`)
      : HOLODEX_URL_HOME.concat(`/watch/${ videoMatch[0] }`);
  }

  const channelMatch = testUrl.match(CHANNEL_URL_REGEX);
  if (channelMatch) {
    return isMultiview
      ? HOLODEX_URL_HOME.concat(`/multiview`)
      : HOLODEX_URL_HOME.concat(`/channel/${ channelMatch[0] }`);
  }
}

/** Retrieve canonical URL */
async function findCanonicalUrl(url: string): Promise<string | null> {
  console.debug("(fallback) fetch original page for canonical URL");
  const doc = await (await fetch(url)).text();
  const match = doc.match(CANONICAL_URL_REGEX);
  const canonicalUrl = match ? "https://www.youtube.com" + match[0] : null;
  console.debug("(fallback) found canonical URL:", canonicalUrl);
  return canonicalUrl;
}
