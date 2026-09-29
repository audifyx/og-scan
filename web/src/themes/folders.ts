/**
 * App folders (idea 33) — group apps into named folders with custom
 * icons, rendered as a single tile that opens a folder sheet.
 *
 * Folders are stored as an ordered list; folder membership removes the
 * app from the flat layout (OsHomePage filters via applyFolders()).
 */

export interface AppFolder {
  id: string;
  name: string;
  /** emoji / glyph shown on the folder tile */
  icon: string;
  /** hex color for the folder tile */
  color: string;
  appIds: string[];
}

export const FOLDERS_KEY = "orbitx-app-folders";

const DEFAULT_FOLDERS: AppFolder[] = [
  { id: "folder-trade", name: "Trading", icon: "📈", color: "#17ff4d", appIds: [] },
];

function read(): AppFolder[] {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [...DEFAULT_FOLDERS];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [...DEFAULT_FOLDERS];
    return arr.filter(
      (f) => f && typeof f.id === "string" && typeof f.name === "string" && Array.isArray(f.appIds)
    );
  } catch {
    return [...DEFAULT_FOLDERS];
  }
}

function write(folders: AppFolder[]) {
  try {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("orbitx:folders"));
}

export function getFolders(): AppFolder[] {
  return read();
}

export function saveFolders(folders: AppFolder[]) {
  write(folders);
}

export function createFolder(name: string, icon = "📁", color = "#3de7ff"): AppFolder {
  const folder: AppFolder = {
    id: `folder-${Date.now().toString(36)}`,
    name: name.trim().slice(0, 24) || "Folder",
    icon,
    color,
    appIds: [],
  };
  const folders = read();
  folders.push(folder);
  write(folders);
  return folder;
}

export function updateFolder(id: string, patch: Partial<Omit<AppFolder, "id">>) {
  write(read().map((f) => (f.id === id ? { ...f, ...patch, id } : f)));
}

export function deleteFolder(id: string) {
  write(read().filter((f) => f.id !== id));
}

export function folderForApp(appId: string): AppFolder | null {
  return read().find((f) => f.appIds.includes(appId)) ?? null;
}

/** Folder tile id prefix used in the flattened app list. */
export const FOLDER_TILE_PREFIX = "folder:";

export function isFolderTileId(id: string): boolean {
  return id.startsWith(FOLDER_TILE_PREFIX);
}

export function folderIdFromTile(tileId: string): string {
  return tileId.slice(FOLDER_TILE_PREFIX.length);
}
