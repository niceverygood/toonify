import Dexie, { Table } from "dexie";
import type { Character, Project } from "@/lib/types";

class WebtoonDB extends Dexie {
  characters!: Table<Character, string>;
  projects!: Table<Project, string>;

  constructor() {
    // NOTE: kept as "WebtoonStudio" (the original codename) even after the
    // user-facing rebrand to Toonify — changing this would orphan every
    // existing user's IndexedDB data. Brand string is rendered in the UI;
    // this constant is purely the storage identifier.
    super("WebtoonStudio");
    this.version(1).stores({
      characters: "id, name, createdAt",
      projects: "id, title, createdAt, updatedAt",
    });
  }
}

export const db = new WebtoonDB();
