import { describe, it, expect, beforeEach } from "vitest";
import { LibraryStore } from "../src/modules/LibraryStore";
import type { ScoreRecord } from "../src/types";

function makeRecord(overrides: Partial<ScoreRecord> = {}): Omit<ScoreRecord, "id" | "createdAt" | "updatedAt"> {
  return {
    title: "Test Song",
    parts: [{ index: 0, name: "Lead", shortName: "L" }],
    xmlContent: "<score-partwise/>",
    fileName: "test.musicxml",
    ...overrides,
  };
}

describe("LibraryStore", () => {
  let store: LibraryStore;

  beforeEach(async () => {
    store = new LibraryStore(`test-db-${Math.random()}`);
    await store.open();
  });

  it("adds and retrieves a record", async () => {
    const id = await store.add(makeRecord());
    const record = await store.get(id);
    expect(record?.title).toBe("Test Song");
    expect(record?.id).toBe(id);
    expect(record?.createdAt).toBeGreaterThan(0);
  });

  it("lists all records sorted by updatedAt desc", async () => {
    const id1 = await store.add(makeRecord({ title: "First" }));
    await new Promise((r) => setTimeout(r, 5));
    const id2 = await store.add(makeRecord({ title: "Second" }));
    const list = await store.list();
    expect(list.map((r) => r.id)).toEqual([id2, id1]);
  });

  it("deletes a record", async () => {
    const id = await store.add(makeRecord());
    await store.delete(id);
    expect(await store.get(id)).toBeUndefined();
  });

  it("updates lastState", async () => {
    const id = await store.add(makeRecord());
    await store.updateLastState(id, {
      selectedPartIndex: 1,
      playMode: "solo",
      displayMode: "all",
      cursorMeasure: 4,
      tempo: 120,
    });
    const record = await store.get(id);
    expect(record?.lastState?.selectedPartIndex).toBe(1);
    expect(record?.lastState?.playMode).toBe("solo");
  });

  it("tracks and returns the last opened id", async () => {
    const id = await store.add(makeRecord());
    await store.setLastOpened(id);
    expect(await store.getLastOpened()).toBe(id);
  });
});
