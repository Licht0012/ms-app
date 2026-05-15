import JSZip from "jszip";

export async function loadFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".musicxml") || name.endsWith(".xml")) {
    return await file.text();
  }
  if (name.endsWith(".mxl")) {
    return await loadMxl(file);
  }
  throw new Error(`Unsupported file extension: ${file.name}`);
}

async function loadMxl(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  // container.xml から rootfile を解決
  const container = zip.file("META-INF/container.xml");
  if (container) {
    const containerXml = await container.async("string");
    const match = containerXml.match(/full-path="([^"]+)"/);
    if (match) {
      const entry = zip.file(match[1]);
      if (entry) return await entry.async("string");
    }
  }

  // フォールバック：最初の .musicxml / .xml エントリを返す
  for (const name of Object.keys(zip.files)) {
    if (/\.(musicxml|xml)$/i.test(name) && !name.startsWith("META-INF/")) {
      const entry = zip.file(name);
      if (entry) return await entry.async("string");
    }
  }

  throw new Error("No MusicXML content found in .mxl archive");
}
