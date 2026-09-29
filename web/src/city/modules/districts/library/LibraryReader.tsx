/**
 * Archive reader UI — browse the OrbitX history and famous trades.
 * Mobile-friendly overlay; opened at library reading terminals.
 */
import { useMemo, useState } from "react";
import { ARCHIVE, searchArchive } from "./Library";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function LibraryReader({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const entries = useMemo(
    () => (query.trim() ? searchArchive(query) : ARCHIVE),
    [query]
  );
  const selected = entries.find((e) => e.id === selectedId) ?? entries[0];

  if (!open) return null;

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#f5c518" }}>📚 ORBITX ARCHIVE</div>
          <button onClick={onClose} style={btn}>✕</button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the archive… (try “rug”, “mcp”, “famous”)"
          style={{ ...field, width: "100%", margin: "10px 0", boxSizing: "border-box" }}
        />
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 }}>
          {entries.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelectedId(e.id)}
              style={{
                ...btn, whiteSpace: "nowrap",
                background: selected?.id === e.id ? "#3a2f16" : "#1a222c",
                borderColor: selected?.id === e.id ? "#f5c518" : "#2a3542",
              }}
            >
              {e.title.length > 34 ? e.title.slice(0, 34) + "…" : e.title}
            </button>
          ))}
        </div>
        {selected && (
          <div style={{ marginTop: 10, maxHeight: "46vh", overflowY: "auto" }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>{selected.title}</div>
            <div style={{ fontSize: 12, color: "#9fb0c3", margin: "4px 0 10px" }}>
              {selected.date} · {selected.tags.join(" · ")}
            </div>
            {selected.body.map((p, i) => (
              <p key={i} style={{ fontSize: 14, lineHeight: 1.65, color: "#d8dee7" }}>{p}</p>
            ))}
          </div>
        )}
        {entries.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "#9fb0c3" }}>
            Nothing in the archive matches “{query}”.
          </div>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 60, display: "flex",
  alignItems: "flex-end", justifyContent: "center", background: "rgba(0,0,0,0.55)",
};
const panel: React.CSSProperties = {
  width: "min(620px, 100%)", maxHeight: "92vh", overflowY: "auto",
  background: "#141009", color: "#e8eef5", borderTop: "2px solid #f5c518",
  borderRadius: "14px 14px 0 0", padding: 16, fontFamily: "Georgia, serif",
};
const btn: React.CSSProperties = {
  background: "#1a222c", color: "#e8eef5", border: "1px solid #2a3542",
  borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 700,
};
const field: React.CSSProperties = {
  background: "#1d1710", color: "#e8eef5", border: "1px solid #4a3a1e",
  borderRadius: 8, padding: "10px 12px", fontFamily: "Georgia, serif",
};
