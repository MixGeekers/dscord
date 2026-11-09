import { copyFile, cp } from "node:fs/promises";
await copyFile(
  new URL("../../web/theme.js", import.meta.url),
  new URL("../../dist/central-admin/theme.js", import.meta.url),
);
await cp(
  new URL("../../web/licenses", import.meta.url),
  new URL("../../dist/central-admin/licenses", import.meta.url),
  { recursive: true },
);
