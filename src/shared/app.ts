/**
 * App identity and display metadata (Outpost ★ boundary file).
 * APP_ID is used for the localStorage key, the envelope guard, and the MCP
 * server name; keep it equal to the Worker name in wrangler.jsonc.
 */
export const APP = {
  id: "nestimate",
  name: "Nestimate",
  shortName: "Nestimate",
  description: "Size up the nest egg. A local-first retirement projection tool.",
  themeColor: "#0f6b66",
  backgroundColor: "#f4f6f7",
  /** Soft cap on the serialized state blob (KV allows 25 MiB). PUTs above this get 413. */
  maxStateBytes: 1024 * 1024,
} as const;

export const APP_ID: string = APP.id;
export const APP_NAME: string = APP.name;
