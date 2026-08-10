# OrbitX Product Demo Video

## Deliverables

This production pack covers `/trade`, `/nft`, `/ORBITX_DEX`, `/orbitxlaunch`, `/x`, and `/agent` with caption-only advertising copy. Captures are stored in `web/public/demo-video/` and were taken at 1920×1080 in the local Vite preview.

## 80-second edit

| Time | Source | On-screen caption | Edit direction |
|---|---|---|---|
| 00:00–00:05 | Title card / OrbitX brand asset | `One connected command center.` | Black-to-grid reveal, cyan line sweep, logo lockup. |
| 00:05–00:16 | `/trade` — `demo-video/orbitx-trade.png` | `Trade with clarity.` / `See the market. Keep your focus.` | Slow push into the market workspace; highlight Discover, watchlist/search, and the calm execution layout. |
| 00:16–00:27 | `/nft` — `demo-video/orbitx-nft.png` | `Discover. Collect. Create.` / `A visual market for the next wave.` | Pan from category rail to featured collection and staff picks. |
| 00:27–00:39 | `/ORBITX_DEX` — `demo-video/orbitx-dex.png` | `Built for focused execution.` / `A dedicated terminal when the details matter.` | Use the verified route state; because the local preview redirects to auth, frame this as an access gate, not a live trading claim. |
| 00:39–00:51 | `/orbitxlaunch` — `demo-video/orbitx-launch.png` | `From idea to launch.` / `Discover, create, claim, and track — in one flow.` | Push across Board, Create, Claim, Rescue, and Portfolio navigation. Do not simulate a launch or transaction. |
| 00:51–01:02 | `/x` — `demo-video/orbitx-x.png` | `Connect your social workflow.` / `Turn your presence into a programmable surface.` | Focus on X MCP copy and connection choices. Do not imply a post was published. |
| 01:02–01:13 | `/agent` — `demo-video/orbitx-agent.png` | `Make tools easier to reach.` / `Connect agents to the work.` | Show secure-access state and transition to agent capability callouts in the edit. No real tool execution. |
| 01:13–01:20 | Montage / end card | `Six surfaces. One OrbitX.` / `Move at your speed.` | 6-frame flash montage, then logo and CTA: `Explore OrbitX`. |

## Capture notes

- `/ORBITX_DEX` and `/agent` are auth-gated in the local preview and resolve to `/auth`; the video should preserve that state as an intentional secure-access moment rather than hiding it.
- `/trade` currently renders an empty feed in the local preview. The edit should describe the workspace and interface structure, not live market availability or performance.
- No wallet connection, signing, publishing, launch, purchase, or irreversible action is performed.
- Avoid claims about returns, speed benchmarks, zero slippage, guaranteed execution, or security guarantees.

## Composition recipe

- Canvas: 1920×1080, 30 fps, 80 seconds.
- Palette: OrbitX black, graphite, cyan, and warm gold.
- Typography: geometric sans for headlines, mono for route labels and metadata.
- Captions: lower-left, 64–76 px headline, 26–32 px supporting line, high-contrast backing plate at 82% opacity.
- Motion: 8–12% Ken Burns push, 250 ms cross-dissolves, one restrained cyan/gold accent sweep per transition.
- Sound: optional minimal electronic bed at -18 LUFS; no voiceover.

## Render status

The local environment has no available `ffmpeg` or browser video-recording encoder, so an MP4 could not be rendered or attached directly from this workspace. The six source captures and this exact edit script are included in the repository and are ready for assembly in a video editor or an encoder-enabled CI job.

Suggested assembly command when `ffmpeg` is available:

```bash
ffmpeg -framerate 30 -loop 1 -t 11 -i web/public/demo-video/orbitx-trade.png \
  -filter_complex "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,format=yuv420p" \
  -r 30 -c:v libx264 -pix_fmt yuv420p orbitx-trade-shot.mp4
```

Repeat per shot, add caption plates in the editor, then concatenate with 250 ms dissolves and the title/end cards described above.

## Source captures

- `web/public/demo-video/orbitx-trade.png`
- `web/public/demo-video/orbitx-nft.png`
- `web/public/demo-video/orbitx-dex.png`
- `web/public/demo-video/orbitx-launch.png`
- `web/public/demo-video/orbitx-x.png`
- `web/public/demo-video/orbitx-agent.png`

These are capture assets, not product UI changes; no demo-only overlay code was shipped into the app.
