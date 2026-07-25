---
name: orbitx-aether-web
description: Build or refine premium OrbitX websites, landing pages, dashboards, and UI components. Use for React UI work, standalone HTML experiences, responsive design, accessibility, animation, visual polish, or any request to vibe-code a website.
---

# OrbitX AETHER Web Craft

Build the requested experience literally and completely. User-specified brand, copy, colors, layout, and behavior override every default in this skill.

## Start with the repository

1. Identify whether the target is the main app (`web/src`), OG DEX (`web/ogdex/src`), the static splash, or a standalone generated page.
2. Inspect nearby components and shared primitives before choosing a pattern.
3. Reuse the existing design language, tokens, icons, routing, and data hooks. Do not introduce a second component system.
4. Preserve the `@/` alias in the main app. Use `lucide-react` for app icons.

## Design standard

- Give every element a clear purpose.
- Use whitespace, alignment, typography, and contrast to establish hierarchy.
- Keep one dominant action per view.
- Support information density with grouping, not visual noise.
- Use a coherent spacing, radius, border, color, and motion system.
- Make hover, active, focus, loading, empty, error, and success states intentional.
- Prefer 200–400 ms transitions and avoid motion that blocks input.
- Use semantic HTML, visible keyboard focus, useful labels, and adequate contrast.
- Design mobile-first, then verify wide and narrow layouts.
- Use specific production copy. Never ship lorem ipsum, TODOs, fake controls, or dead buttons.

When the request does not specify an aesthetic, follow OrbitX: near-black layered surfaces, restrained violet/lime/gold accents, crisp borders, strong display type, and data-rich cards. Do not flatten the interface into generic gray Tailwind panels.

## Main React application

- Compose from `web/src/components/ui` and existing layout components.
- Keep remote data in TanStack Query or existing hooks, not duplicated component state.
- Use `lazyWithRetry` for large route-level additions where the app already lazy-loads peers.
- Preserve wallet-provider and auth boundaries.
- Show stale data while refreshing when safe; make destructive and financial actions explicit.
- Never expose service-role keys or provider secrets through `VITE_*`.

## Standalone AETHER page

Use this mode only for a deliberately self-contained HTML deliverable or the `vibe-code` flow:

- Return one complete HTML5 document with viewport metadata.
- Tailwind Play CDN, Font Awesome, and Chart.js are acceptable only when the target has no build step.
- Keep custom CSS in `<style>` and behavior in vanilla `<script>`.
- Include a layered hero, substantial content, responsive cards, social proof where relevant, a styled interaction or form, and a real footer when appropriate.
- Implement controls, validation, feedback, and scroll-reveal behavior; do not merely draw them.
- Sanitize untrusted content and avoid injecting user input through `innerHTML`.

Do not import CDN scripts into the React production app.

## Adversarial review

Before finishing, check:

- Does every visible control work?
- Are loading, empty, error, and long-content states handled?
- Can a keyboard user operate it?
- Does it remain usable at 320 px and at desktop width?
- Is text readable over every gradient/image?
- Did the implementation follow the user's brief rather than a default template?
- Is the result consistent with adjacent OrbitX screens?

Run the narrowest relevant tests, then `npm run build` from `web` for app-level UI changes.

## Source patterns

- `supabase/functions/vibe-code/index.ts`
- `docs/vibecode/aether-training-prompt.html`
- `web/src/components/ui/`
- `web/src/App.tsx`
- `web/src/pages/Splash.tsx`
