import { ICON_DATA_URI, ICON_DATA_URI_48 } from "./icon-bundled.js";

const ICON_ENTRIES = [
  { src: ICON_DATA_URI_48, mimeType: "image/png", sizes: ["48x48"] },
  { src: ICON_DATA_URI, mimeType: "image/png", sizes: ["512x512"] },
] as const;

type IconEntry = (typeof ICON_ENTRIES)[number];

export const TOOL_ICONS: Record<string, ReadonlyArray<IconEntry>> = {
  web_fetch: ICON_ENTRIES,
  web_search: ICON_ENTRIES,
  ai_chat_completion: ICON_ENTRIES,
  account_status: ICON_ENTRIES,
  default: ICON_ENTRIES,
};
