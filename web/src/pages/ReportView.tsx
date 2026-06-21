import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SUPABASE_URL } from "@/lib/supabase";

// Public, shareable report renderer. The report HTML is fetched from the
// report-view edge function (CORS-enabled) and rendered via iframe srcDoc, so
// it displays fully regardless of the storage/edge CSP sandbox that otherwise
// forces the raw URL to show as text.
export default function ReportView() {
  const { id } = useParams<{ id: string }>();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/report-view?id=${encodeURIComponent(id)}`);
        if (!res.ok) throw new Error(String(res.status));
        const text = await res.text();
        if (alive) setHtml(text);
      } catch {
        if (alive) setError(true);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  if (error) {
    return <div style={{ font: "16px system-ui", background: "#0b0b0f", color: "#aaa", padding: 40, minHeight: "100vh" }}>Report not found.</div>;
  }
  if (html == null) {
    return <div style={{ font: "16px system-ui", background: "#0b0b0f", color: "#aaa", padding: 40, minHeight: "100vh" }}>Loading report…</div>;
  }
  return (
    <iframe
      title="OG Scan report"
      srcDoc={html}
      sandbox="allow-scripts allow-popups allow-same-origin"
      style={{ border: "none", width: "100vw", height: "100vh", background: "#fff" }}
    />
  );
}
