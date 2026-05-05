import { ICON_DATA_URI } from "./icon-bundled.js";

const ICON_ENTRY = {
  src: ICON_DATA_URI,
  mimeType: "image/png",
  sizes: ["512x512"],
} as const;

type IconEntry = typeof ICON_ENTRY;

export const TOOL_ICONS: Record<string, ReadonlyArray<IconEntry>> = {
  web_fetch: [ICON_ENTRY],
  web_search: [ICON_ENTRY],
  ai_chat_completion: [ICON_ENTRY],
  account_status: [ICON_ENTRY],
  default: [ICON_ENTRY],
};
