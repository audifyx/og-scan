import { describe, expect, it } from "vitest";
import {
  addToFolder,
  createFolder,
  folderedKeys,
  removeFromFolder,
  renameFolder,
  ungroupFolder,
} from "./osFolders";

describe("osFolders", () => {
  it("creates a folder from two apps and tracks membership", () => {
    const folders = createFolder([], "f1", "city", "dex");
    expect(folders).toHaveLength(1);
    expect(folders[0].appKeys).toEqual(["city", "dex"]);
    expect(folderedKeys(folders).has("city")).toBe(true);
    expect(folderedKeys(folders).has("trade")).toBe(false);
  });

  it("refuses to folder an already-foldered app or an app with itself", () => {
    const folders = createFolder([], "f1", "city", "dex");
    expect(createFolder(folders, "f2", "city", "trade")).toEqual(folders);
    expect(createFolder(folders, "f3", "trade", "trade")).toEqual(folders);
  });

  it("adds without duplicates and removes, dropping empty folders", () => {
    let folders = createFolder([], "f1", "city", "dex");
    folders = addToFolder(folders, "f1", "trade");
    folders = addToFolder(folders, "f1", "trade");
    expect(folders[0].appKeys).toEqual(["city", "dex", "trade"]);
    folders = removeFromFolder(folders, "f1", "city");
    expect(folders[0].appKeys).toEqual(["dex", "trade"]);
    folders = removeFromFolder(folders, "f1", "dex");
    folders = removeFromFolder(folders, "f1", "trade");
    expect(folders).toEqual([]);
  });

  it("ungroups and renames", () => {
    const folders = createFolder([], "f1", "city", "dex");
    const { folders: rest, freed } = ungroupFolder(folders, "f1");
    expect(rest).toEqual([]);
    expect(freed).toEqual(["city", "dex"]);
    const renamed = renameFolder(folders, "f1", "  Markets  ");
    expect(renamed[0].name).toBe("Markets");
    expect(renameFolder(folders, "f1", "   ")[0].name).toBe("Folder");
  });
});
