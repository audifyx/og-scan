import { SUPA_FN, ANON } from "../_lib.js";
export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  if (!mint) { res.statusCode = 400; return res.end("mint required"); }
  try {
    const r = await fetch(`${SUPA_FN}/og-report-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}`, apikey: ANON },
      body: JSON.stringify({ query: mint }),
    });
    if (!r.ok) { res.statusCode = 502; return res.end("report unavailable"); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="OGDEX_Report_${mint.slice(0,8)}.pdf"`);
    res.statusCode = 200; res.end(buf);
  } catch (e) { res.statusCode = 500; res.end("error"); }
}
