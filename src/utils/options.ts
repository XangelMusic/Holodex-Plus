import { storage } from "webextension-polyfill";

// To add something to options, just add it to `schema`
const schema = {
  // key: default-value
  remoteYoutubeLikeButton: true,
  openHolodexInNewTab: true,
  holodexButtonInYoutube: true,
  openInHolodexContextMenu: true,
};
type Schema = typeof schema;
const descriptions: Partial<Record<keyof Schema, { name: string, description: string }>> = {
  remoteYoutubeLikeButton: {
    name: "Like Button on Holodex",
    description: "Add a 'Like on YouTube' button to Holodex videos - clicking it will open YouTube in a new tab.",
  },
  holodexButtonInYoutube: {
    name: "Holodex Button in YouTube",
    description: "Add a Holodex button in the YouTube watch and shorts page.",
  },
  openHolodexInNewTab: {
    name: "Open in New Tab",
    description: "When clicking the extension icon, open Holodex in a new tab instead of the current one.",
  },
  openInHolodexContextMenu: {
    name: "Context Menu Options",
    description: "Add 'Open in Holodex' and 'Open in Multiview' options to the context menu on YouTube pages.",
  },
};

export const Options = {
  /** Get an option's name */
  name(key: keyof Schema): string | null {
    return descriptions[key]?.name ?? null;
  },

  /** Get an option's description */
  description(key: keyof Schema): string | null {
    return descriptions[key]?.description ?? null;
  },

  /** Get an option */
  async get<K extends keyof Schema>(key: K): Promise<Schema[K]> {
    const result = await storage.local.get(key);
    if (result[key] === undefined) {
      console.warn(`Option "${key}" not found in storage, returning default value.`);
      return schema[key];
    }
    return result[key] as Schema[K];
  },

  /** Set an option */
  async set<K extends keyof Schema>(key: K, value: Schema[K]): Promise<void> {
    await storage.local.set({ [key]: value });
  },

  /** Get the options storage schema */
  schema(): Schema {
    return { ...schema };
  },

  /** Listen for changes to a specific option */
  onChange<K extends keyof Schema>(key: K, callback: (newValue: Schema[K], oldValue?: Schema[K]) => void): () => void {
    type OnChangedListener = Parameters<typeof storage.onChanged.addListener>[0];

    const listener: OnChangedListener = (changes, areaName) => {
      if (areaName !== "local" || !(key in changes)) return;
      const newValue = (changes[key].newValue ?? schema[key]) as Schema[K];
      const oldValue = changes[key].oldValue as Schema[K] | undefined;
      callback(newValue, oldValue);
    };

    storage.onChanged.addListener(listener);
    return () => storage.onChanged.removeListener(listener);
  },
} as const;