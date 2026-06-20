import { isPreview } from "@/lib/preview";

/** Fixed banner shown only in read-only preview mode. */
export const PreviewBanner = () => {
  if (!isPreview()) return null;
  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 99999,
        background: "linear-gradient(90deg,#bef264,#22d3ee)", color: "#04140a",
        font: "600 11px/1.4 ui-sans-serif,system-ui", textAlign: "center",
        padding: "4px 8px", letterSpacing: "0.04em", pointerEvents: "none",
      }}
    >
      PREVIEW MODE — read-only UI review · no live data · interactions disabled
    </div>
  );
};
