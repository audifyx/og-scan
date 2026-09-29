import { useEffect, useMemo, useState } from "react";
import { Folder, Pencil, Plus, Trash2, X } from "lucide-react";
import { APP_CATALOG, type OsHomeApp } from "./appsCatalog";
import {
  FOLDER_TILE_PREFIX,
  createFolder,
  deleteFolder,
  getFolders,
  saveFolders,
  updateFolder,
  type AppFolder,
} from "../themes/folders";
import "./oshome.css";

/**
 * App folders UI (idea 33).
 *
 *  useFoldersState — reactive folder list (listens to orbitx:folders)
 *  folderTileApp   — synthetic OsHomeApp so a folder renders as one tile
 *  FolderSheet     — overlay showing a folder's apps (custom icon + color)
 *  FolderManager   — overlay: create / rename / delete / assign apps
 */

export function useFoldersState(): AppFolder[] {
  const [folders, setFolders] = useState<AppFolder[]>(() => getFolders());
  useEffect(() => {
    const fn = () => setFolders(getFolders());
    window.addEventListener("orbitx:folders", fn);
    return () => window.removeEventListener("orbitx:folders", fn);
  }, []);
  return folders;
}

/** Synthetic catalog entry so a folder renders as a single home tile. */
export function folderTileApp(folder: AppFolder): OsHomeApp {
  return {
    id: `${FOLDER_TILE_PREFIX}${folder.id}`,
    name: folder.name,
    blurb: `${folder.appIds.length} apps`,
    href: "#",
    icon: Folder,
    accent: folder.color,
    category: "platform",
  };
}

export function isFolderTile(id: string): boolean {
  return id.startsWith(FOLDER_TILE_PREFIX);
}

/* ---------------- folder contents sheet ---------------- */

export function FolderSheet({
  folder,
  onClose,
  onLaunch,
}: {
  folder: AppFolder;
  onClose: () => void;
  onLaunch: (a: OsHomeApp) => void;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  const apps = useMemo(() => {
    const map = new Map(APP_CATALOG.map((a) => [a.id, a]));
    return folder.appIds.map((id) => map.get(id)).filter((a): a is OsHomeApp => !!a);
  }, [folder]);

  return (
    <div className="osh-launcher" onClick={onClose} role="dialog" aria-label={`${folder.name} folder`}>
      <div className="osh-launcher-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="osh-settings-head" style={{ padding: "18px 18px 0" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>
            <span style={{ marginRight: 8 }}>{folder.icon}</span>
            {folder.name}
          </h2>
          <button className="osh-x-btn" onClick={onClose} aria-label="Close folder">
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>
        <div style={{ padding: "10px 18px 22px" }}>
          {apps.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--dt-muted)" }}>
              Empty folder — add apps from the folder manager (long-press any layout's Themes button → Folders).
            </p>
          )}
          <div className="osh-folder-grid">
            {apps.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  className="osh-icon"
                  onClick={() => {
                    onClose();
                    onLaunch(a);
                  }}
                  aria-label={a.name}
                >
                  <span className="osh-icon-tile">
                    <Icon className="osh-icon-glyph" style={{ color: a.accent }} />
                  </span>
                  <span className="osh-icon-label">{a.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- folder manager ---------------- */

const EMOJI_CHOICES = ["📁", "📈", "🎮", "💬", "🤖", "📰", "🎨", "💰", "⚙️", "🌙", "🔥", "💎"];
const COLOR_CHOICES = ["#17ff4d", "#3de7ff", "#f5c542", "#ff4d9a", "#a78bfa", "#ff6b35", "#5b8cff", "#ff4d5e"];

export function FolderManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const folders = useFoldersState();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(EMOJI_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [editing, setEditing] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [open, onClose]);

  if (!open) return null;

  const assigningFolder = folders.find((f) => f.id === assigning) ?? null;
  const assignable = APP_CATALOG.filter((a) =>
    `${a.name} ${a.blurb}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  const toggleApp = (folder: AppFolder, appId: string) => {
    const has = folder.appIds.includes(appId);
    updateFolder(folder.id, {
      appIds: has ? folder.appIds.filter((id) => id !== appId) : [...folder.appIds, appId],
    });
  };

  return (
    <div className="osh-launcher" onClick={onClose} role="dialog" aria-label="Folder manager">
      <div className="osh-launcher-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="osh-settings-head" style={{ padding: "18px 18px 0" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>App folders</h2>
          <button className="osh-x-btn" onClick={onClose} aria-label="Close folders">
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>
        <div style={{ padding: "6px 18px 22px" }}>
          {/* create */}
          <div className="osh-picker-sec" style={{ marginTop: 8 }}>New folder</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              className="osh-vault-search"
              style={{ flex: 1 }}
              placeholder="Folder name…"
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
            />
            <button
              className="osh-pill-btn"
              onClick={() => {
                if (!name.trim()) return;
                createFolder(name.trim(), icon, color);
                setName("");
              }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Create
            </button>
          </div>
          <div className="osh-emoji-row">
            {EMOJI_CHOICES.map((e) => (
              <button key={e} className="osh-emoji" data-active={icon === e || undefined} onClick={() => setIcon(e)}>
                {e}
              </button>
            ))}
          </div>
          <div className="osh-emoji-row">
            {COLOR_CHOICES.map((c) => (
              <button
                key={c}
                className="osh-color-dot"
                data-active={color === c || undefined}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>

          {/* list */}
          <div className="osh-picker-sec">Folders ({folders.length})</div>
          {folders.map((f) => (
            <div key={f.id} className="osh-folder-card">
              <span style={{ fontSize: 20 }}>{f.icon}</span>
              <div style={{ flex: 1 }}>
                {editing === f.id ? (
                  <input
                    className="osh-vault-search"
                    defaultValue={f.name}
                    maxLength={24}
                    autoFocus
                    onBlur={(e) => {
                      updateFolder(f.id, { name: e.target.value.trim() || f.name });
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                ) : (
                  <div>
                    <b style={{ fontSize: 13.5 }}>{f.name}</b>
                    <div style={{ fontSize: 11.5, color: "var(--dt-muted)" }}>{f.appIds.length} apps</div>
                  </div>
                )}
              </div>
              <button className="osh-x-btn" title="Assign apps" onClick={() => { setAssigning(f.id); setQ(""); }}>
                <Plus style={{ width: 14, height: 14 }} />
              </button>
              <button className="osh-x-btn" title="Rename" onClick={() => setEditing(f.id)}>
                <Pencil style={{ width: 14, height: 14 }} />
              </button>
              <button
                className="osh-x-btn"
                title="Delete folder (apps return to the grid)"
                onClick={() => {
                  if (window.confirm(`Delete "${f.name}"? Its apps return to the home grid.`)) {
                    deleteFolder(f.id);
                  }
                }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
              </button>

              {assigning === f.id && (
                <div style={{ flexBasis: "100%", marginTop: 8 }}>
                  <input
                    className="osh-vault-search"
                    placeholder="Search apps to add…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  <div className="osh-vault-list" style={{ maxHeight: 170, overflowY: "auto", marginTop: 6 }}>
                    {assignable.slice(0, 30).map((a) => {
                      const Icon = a.icon;
                      const inFolder = f.appIds.includes(a.id);
                      return (
                        <button
                          key={a.id}
                          className="osh-vault-row"
                          data-on={inFolder || undefined}
                          onClick={() => toggleApp(f, a.id)}
                          style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                        >
                          <Icon style={{ width: 15, height: 15, color: a.accent }} />
                          <span style={{ fontSize: 12.5, flex: 1 }}>{a.name}</span>
                          {inFolder && <span className="osh-check">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                  <button className="osh-link" onClick={() => setAssigning(null)}>Done</button>
                </div>
              )}
            </div>
          ))}
          <p style={{ fontSize: 12, color: "var(--dt-muted)", marginTop: 10 }}>
            Apps in a folder leave the flat grid and live inside the folder tile.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Remove foldered apps from a flat list; caller appends folderTileApp() tiles. */
export function applyFolders(apps: OsHomeApp[], folders: AppFolder[]): OsHomeApp[] {
  const inFolder = new Set(folders.flatMap((f) => f.appIds));
  return apps.filter((a) => !inFolder.has(a.id));
}

export function persistFolderOrder() {
  // Folders render after apps; order changes flow through the same
  // useOrderedApps pipeline. This hook exists for future ordering UI.
  saveFolders(getFolders());
}
