---
name: orbitx-game-builder
description: Build polished web games, prediction experiences, leaderboards, or game partnerships inside OrbitX. Use for game mechanics, canvas/WebGL/DOM gameplay, multiplayer or provably-fair design, scoring, achievements, iframe integrations, and game UI.
---

# OrbitX Web Game Builder

The repository currently embeds partner games; it does not contain the source of those games. Do not claim to reuse mechanics that are not present. For a new native game, establish the rules, trust boundary, and state model before building visuals.

## Pick the integration mode

### Native client game

Use for low-stakes, local, or server-authoritative gameplay owned by OrbitX.

- Put reusable simulation and scoring logic in pure TypeScript modules.
- Keep rendering separate from game state.
- Use `requestAnimationFrame` for visual loops and fixed-step updates when deterministic physics matters.
- Pause or reduce work when hidden; clean up timers, listeners, audio, and animation frames.
- Support pointer, touch, and keyboard controls.
- Provide start, pause, resume, restart, sound, instructions, and reduced-motion behavior where relevant.

### Server-authoritative or value-bearing game

Use whenever rewards, wagers, rankings, inventory, or shared outcomes matter.

- The browser submits intent; the server validates state transitions.
- Never trust client score, clock, randomness, balance, or win claims.
- Use idempotency keys and transactional writes.
- Authenticate wallet/account ownership for every mutation.
- Store durable state outside function memory.
- Define disconnect, timeout, replay, tie, cancellation, and settlement rules.
- Do not describe a game as “provably fair” unless commitments, entropy sources, reveal/verification, and replay protection are implemented and documented.
- Keep custody and signatures explicit. Never request private keys or seed phrases.

### Partner embed

Follow the browser-shell pattern in `web/src/pages/Games.tsx`:

- Use HTTPS URLs only.
- Give each iframe the minimum `allow` and `sandbox` capabilities it needs.
- Include a loading state, failure fallback, reload action, accessible title, and open-in-new-tab link.
- Assume some partners block framing with CSP or `X-Frame-Options`.
- Treat `postMessage` as untrusted: validate `origin`, schema, and message type.
- Do not grant `allow-same-origin` plus `allow-scripts` without understanding the embedded origin and threat model.

## Quality bar

- Explain the objective and controls before the first round.
- Make state changes legible through motion, sound, text, and not color alone.
- Keep gameplay responsive under slow network conditions.
- Prevent double submission and accidental wallet actions.
- Make scores and odds mathematically testable.
- Use deterministic seeded tests for random-dependent logic.
- Test win, loss, tie, invalid input, timeout, reconnect, and rapid repeat actions.

## Prediction markets

Define market source, close time, resolution source, invalid-market policy, fees, payout math, and dispute behavior. Display timezone and settlement status. Never resolve from a client-supplied value.

## Source patterns

- `web/src/pages/Games.tsx`
- `web/src/pages/Leaderboard.tsx`
- `web/src/pages/orbitx/`
- `web/vercel.json`
- `contracts/`
