# ESM Buffer Polyfill Fix & Domain Update

## Issue Fixed

**Problem:** ESM import hoisting was evaluating `App.tsx` before the Buffer polyfill ran, causing runtime errors when Raydium/BN.js/Token-2022 dependencies tried to access the bare `Buffer` global at module-load time.

**Root Cause:** Static `import App from "./App.tsx"` gets hoisted by JavaScript engines regardless of its position in the file, so it executed before `window.Buffer = Buffer` line.

## Solution Implemented

### File: `/web/src/main.tsx`

**Before:**
```typescript
import { Buffer } from "buffer";
(window as any).Buffer = Buffer;

import App from "./App.tsx";  // ❌ Gets hoisted, runs before polyfill!
```

**After:**
```typescript
import { Buffer } from "buffer";
(window as any).Buffer = Buffer;

// Defer App import until AFTER Buffer polyfill is set up
async function bootstrap() {
  const { default: App } = await import("./App.tsx");  // ✓ Dynamic import, runs after!
  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap().catch(console.error);
```

### Why This Works

1. **Polyfill runs synchronously** - `window.Buffer = Buffer` executes immediately
2. **Dynamic import deferred** - `await import("./App.tsx")` doesn't execute until the polyfill is set
3. **No hoisting** - Dynamic imports are not hoisted by ESM, they execute when called
4. **Error safe** - `.catch(console.error)` prevents silent failures

## Domain Updates

Updated all references from `ogscan.fun` to `orbitx.world`:

### Files Modified:
- `web/src/lib/og.ts` - OGSCAN_SITE_URL constant
- `web/src/components/SiteHeader.tsx` - Header brand text  
- `web/src/components/Hero.tsx` - CTA link text
- `web/src/components/SiteFooter.tsx` - Footer branding & copyright
- `web/src/components/TechStack.tsx` - Tech stack display
- `web/src/components/spaces/XIntegration.tsx` - Hardcoded space URLs

### Display Changes:
- "ogscan.fun" → "orbitx.world" in all UI
- All API/internal links now route to orbitx.world domain

## Testing & Deployment

✅ **Build Status:** Successful (`dist/` generated, 13.39s)  
✅ **Type Check:** All TypeScript types valid  
✅ **No Breaking Changes:** ESM fix is transparent to app logic

## Verification Steps

1. **ESM Fix:** Load app in browser - should not throw "Buffer is not defined" error
2. **Domain:** Check page headers/footers - should display "orbitx.world"  
3. **Links:** Click any site links - should resolve to orbitx.world domain
4. **Launch Page:** Navigate to /launch - vanity mint generation should work

## Production Deployment

Command: `vercel deploy --prod`  
Branch: `v0/fix-and-deploy-041d31af`  
Status: Deployed ✓
