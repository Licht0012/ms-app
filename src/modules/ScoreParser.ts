import type { PartInfo, ScoreMeta } from "../types";

export function parseMeta(xml: string): ScoreMeta {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Invalid MusicXML");
  }

  // Try standard locations, then MuseScore's <credit-words> (used for the visible
  // title on the printed score). Return empty string if none found — the caller
  // decides the user-facing default (e.g. filename basename).
  const title =
    doc.querySelector("work > work-title")?.textContent?.trim() ||
    doc.querySelector("movement-title")?.textContent?.trim() ||
    doc.querySelector("credit-words")?.textContent?.trim() ||
    "";

  const scoreParts = Array.from(doc.querySelectorAll("part-list > score-part"));
  const parts: PartInfo[] = scoreParts.map((el, index) => {
    const name = el.querySelector("part-name")?.textContent?.trim() || `Part ${index + 1}`;
    const abbr = el.querySelector("part-abbreviation")?.textContent?.trim();
    const shortName = abbr && abbr.length > 0 ? abbr : name.charAt(0).toUpperCase();
    return { index, name, shortName };
  });

  return { title, parts };
}
