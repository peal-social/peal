// Draws the art of Peal's emails into peal-emails, where the server serves
// it from: `bun nx run peal-ui:email-art`.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { emailArt } from "./email-art/art";
import { artSources, assetsFolder } from "./email-art/files";

mkdirSync(assetsFolder, { recursive: true });

for (const [name, bytes] of emailArt(artSources())) {
  writeFileSync(path.join(assetsFolder, name), bytes);
}
