/**
 * OrbitX OS — iOS-style app folders. Pure functions so the grouping rules
 * are unit-testable. A folder lives on the desktop in place of its member
 * apps; members stay openable from Start / the Apps window regardless.
 */

export interface OsFolder {
  id: string;
  name: string;
  appKeys: string[];
  /** Folder tile color (idea bank #90); undefined = default glass. */
  color?: string;
}

/** Create a folder from two desktop apps. Caller supplies the id. */
export function createFolder(
  folders: OsFolder[],
  id: string,
  aKey: string,
  bKey: string,
): OsFolder[] {
  if (aKey === bKey) return folders;
  if (folders.some((f) => f.appKeys.includes(aKey) || f.appKeys.includes(bKey))) {
    return folders; // already foldered — caller handles add-to-folder instead
  }
  return [...folders, { id, name: "Folder", appKeys: [aKey, bKey] }];
}

/** Add an app to an existing folder (no duplicates). */
export function addToFolder(
  folders: OsFolder[],
  folderId: string,
  appKey: string,
): OsFolder[] {
  return folders.map((f) =>
    f.id === folderId && !f.appKeys.includes(appKey)
      ? { ...f, appKeys: [...f.appKeys, appKey] }
      : f,
  );
}

/** Remove one app from a folder; empty folders disappear. */
export function removeFromFolder(
  folders: OsFolder[],
  folderId: string,
  appKey: string,
): OsFolder[] {
  return folders
    .map((f) =>
      f.id === folderId ? { ...f, appKeys: f.appKeys.filter((k) => k !== appKey) } : f,
    )
    .filter((f) => f.appKeys.length > 0);
}

/** Dissolve a folder. Returns the remaining folders + the freed app keys. */
export function ungroupFolder(
  folders: OsFolder[],
  folderId: string,
): { folders: OsFolder[]; freed: string[] } {
  const target = folders.find((f) => f.id === folderId);
  if (!target) return { folders, freed: [] };
  return { folders: folders.filter((f) => f.id !== folderId), freed: target.appKeys };
}

export function setFolderColor(
  folders: OsFolder[],
  folderId: string,
  color: string | undefined,
): OsFolder[] {
  return folders.map((f) => (f.id === folderId ? { ...f, color } : f));
}

export function renameFolder(
  folders: OsFolder[],
  folderId: string,
  name: string,
): OsFolder[] {
  const clean = name.trim().slice(0, 24) || "Folder";
  return folders.map((f) => (f.id === folderId ? { ...f, name: clean } : f));
}

/** Every app key currently inside any folder. */
export function folderedKeys(folders: OsFolder[]): Set<string> {
  const out = new Set<string>();
  for (const f of folders) for (const k of f.appKeys) out.add(k);
  return out;
}
