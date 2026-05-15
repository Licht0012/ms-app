import { openDB, type IDBPDatabase } from "idb";
import type { ScoreRecord, ScorePlayState } from "../types";

const SCORES_STORE = "scores";
const META_STORE = "meta";
const LAST_OPENED_KEY = "lastOpenedId";

export class LibraryStore {
  private db?: IDBPDatabase;
  private readonly dbName: string;

  constructor(dbName: string = "ms-app") {
    this.dbName = dbName;
  }

  async open(): Promise<void> {
    this.db = await openDB(this.dbName, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(SCORES_STORE)) {
          const store = db.createObjectStore(SCORES_STORE, { keyPath: "id" });
          store.createIndex("updatedAt", "updatedAt");
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      },
    });
  }

  private requireDb(): IDBPDatabase {
    if (!this.db) throw new Error("LibraryStore.open() not called");
    return this.db;
  }

  async add(input: Omit<ScoreRecord, "id" | "createdAt" | "updatedAt">): Promise<string> {
    const db = this.requireDb();
    const now = Date.now();
    const record: ScoreRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await db.put(SCORES_STORE, record);
    return record.id;
  }

  async get(id: string): Promise<ScoreRecord | undefined> {
    return this.requireDb().get(SCORES_STORE, id);
  }

  async list(): Promise<ScoreRecord[]> {
    const all = await this.requireDb().getAll(SCORES_STORE);
    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(id: string): Promise<void> {
    await this.requireDb().delete(SCORES_STORE, id);
  }

  async updateLastState(id: string, lastState: ScorePlayState): Promise<void> {
    const db = this.requireDb();
    const existing = await db.get(SCORES_STORE, id);
    if (!existing) return;
    existing.lastState = lastState;
    existing.updatedAt = Date.now();
    await db.put(SCORES_STORE, existing);
  }

  async setLastOpened(id: string): Promise<void> {
    await this.requireDb().put(META_STORE, id, LAST_OPENED_KEY);
  }

  async getLastOpened(): Promise<string | undefined> {
    return this.requireDb().get(META_STORE, LAST_OPENED_KEY);
  }

  async clearAll(): Promise<void> {
    const db = this.requireDb();
    await db.clear(SCORES_STORE);
    await db.clear(META_STORE);
  }
}
