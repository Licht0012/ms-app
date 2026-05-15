import JSZip from "jszip";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const musicxml = readFileSync(join(dir, "sample.musicxml"));

const zip = new JSZip();
zip.file("META-INF/container.xml",
  `<?xml version="1.0" encoding="UTF-8"?>
<container>
  <rootfiles>
    <rootfile full-path="sample.musicxml" media-type="application/vnd.recordare.musicxml+xml"/>
  </rootfiles>
</container>`);
zip.file("sample.musicxml", musicxml);

const buffer = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(join(dir, "sample.mxl"), buffer);
console.log("Created sample.mxl");
