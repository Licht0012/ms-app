import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseMeta } from "../src/modules/ScoreParser";

const sample = readFileSync(join(__dirname, "fixtures/sample.musicxml"), "utf-8");

describe("ScoreParser.parseMeta", () => {
  it("extracts work title", () => {
    const meta = parseMeta(sample);
    expect(meta.title).toBe("Test Song");
  });

  it("extracts parts with names and abbreviations", () => {
    const meta = parseMeta(sample);
    expect(meta.parts).toHaveLength(2);
    expect(meta.parts[0]).toMatchObject({ index: 0, name: "Lead", shortName: "L" });
    expect(meta.parts[1]).toMatchObject({ index: 1, name: "Bass", shortName: "B" });
  });

  it("falls back to first letter when part-abbreviation is missing", () => {
    const xml = `<?xml version="1.0"?>
      <score-partwise>
        <part-list>
          <score-part id="P1"><part-name>Soprano</part-name></score-part>
        </part-list>
      </score-partwise>`;
    const meta = parseMeta(xml);
    expect(meta.parts[0].shortName).toBe("S");
  });

  it("falls back to 'Untitled' when no work title", () => {
    const xml = `<?xml version="1.0"?>
      <score-partwise>
        <part-list>
          <score-part id="P1"><part-name>X</part-name></score-part>
        </part-list>
      </score-partwise>`;
    const meta = parseMeta(xml);
    expect(meta.title).toBe("Untitled");
  });
});
