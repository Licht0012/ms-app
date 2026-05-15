import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadFile } from "../src/modules/FileLoader";

const fixturesDir = join(__dirname, "fixtures");

function fileFromFixture(name: string, mime = ""): File {
  const buffer = readFileSync(join(fixturesDir, name));
  return new File([buffer], name, { type: mime });
}

describe("FileLoader", () => {
  it("reads .musicxml file as MusicXML string", async () => {
    const file = fileFromFixture("sample.musicxml", "application/xml");
    const xml = await loadFile(file);
    expect(xml).toContain("<score-partwise");
    expect(xml).toContain("<part-name>Lead</part-name>");
  });

  it("reads .xml file as MusicXML string", async () => {
    const buffer = readFileSync(join(fixturesDir, "sample.musicxml"));
    const file = new File([buffer], "song.xml", { type: "application/xml" });
    const xml = await loadFile(file);
    expect(xml).toContain("<score-partwise");
  });

  it("rejects unsupported extensions", async () => {
    const file = new File(["data"], "song.mscz");
    await expect(loadFile(file)).rejects.toThrow(/unsupported/i);
  });

  it("reads .mxl file by extracting the rootfile listed in META-INF/container.xml", async () => {
    const file = fileFromFixture("sample.mxl", "application/vnd.recordare.musicxml");
    const xml = await loadFile(file);
    expect(xml).toContain("<score-partwise");
    expect(xml).toContain("<part-name>Lead</part-name>");
  });

  it("falls back to first .musicxml entry when container.xml is missing", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("something.musicxml", "<?xml version=\"1.0\"?><score-partwise>fallback</score-partwise>");
    const buffer = await zip.generateAsync({ type: "arraybuffer" });
    const file = new File([buffer], "x.mxl");
    const xml = await loadFile(file);
    expect(xml).toContain("fallback");
  });
});
