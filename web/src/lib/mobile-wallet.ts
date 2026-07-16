/**
 * Mobile wallet connection helper — detects in-app browsers and offers deep-linking
 * to Phantom mobile app instead of using phantom's broken in-app browser
 */

export interface MobileWalletInfo {
  isMobile: boolean;
  isPhantomBrowser: boolean;
  isInAppBrowser: boolean;
  userAgent: string;
}

export function detectMobileWallet(): MobileWalletInfo {
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(ua);
  const isPhantomBrowser = /phantom/.test(ua) || (window as any).phantom?.solana?.isPhantom;
  const isInAppBrowser = /instagram|facebook|twitter|chrome\/[0-9].*\sEdge/.test(ua) || 
    (!('chrome' in window) && !('safari' in window) && isMobile);

  return {
    isMobile,
    isPhantomBrowser,
    isInAppBrowser,
    userAgent: ua,
  };
}

/**
 * Get Phantom mobile deep-link URL.
 * Opens Phantom app and navigates to the given dApp URL.
 */
export function getPhantomDeepLink(dappUrl: string = window.location.href): string {
  // Phantom mobile scheme: Opens Phantom and navigates to the URL
  const encodedUrl = encodeURIComponent(dappUrl);
  return `https://phantom.app/ul/browse/${encodedUrl}?ref=ogscan`;
}

/**
 * Attempt to connect to Phantom wallet.
 * On mobile in non-Phantom browsers, redirects to Phantom app.
 * On desktop or in Phantom browser, uses standard wallet adapter.
 */
export async function connectPhantomMobile() {
  const { isMobile, isPhantomBrowser } = detectMobileWallet();

  // If on mobile and NOT already in Phantom browser, offer app deep-link
  if (isMobile && !isPhantomBrowser) {
    const deepLink = getPhantomDeepLink();
    console.log("Redirecting to Phantom mobile app...", deepLink);
    // Open in new tab so user can approve and return
    window.open(deepLink, "_blank");
    return;
  }

  // Otherwise, use standard wallet connection (for desktop or Phantom browser)
  const phantom = (window as any).phantom?.solana;
  if (!phantom) {
    throw new Error("Phantom wallet not detected. Install Phantom from phantom.app");
  }

  try {
    const response = await phantom.connect();
    console.log("Connected to Phantom:", response.publicKey.toString());
    return response;
  } catch (err) {
    console.error("Phantom connection failed:", err);
    throw err;
  }
}

/**
 * Show a wallet connection prompt that's mobile-friendly.
 * Returns an HTML element or can trigger connection directly.
 */
export function createMobileWalletPrompt(): HTMLElement {
  const { isMobile, isPhantomBrowser } = detectMobileWallet();
  const container = document.createElement("div");
  container.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/50";

  if (isMobile && !isPhantomBrowser) {
    // Mobile, not in Phantom browser — show deep-link button
    container.innerHTML = `
      <div class="bg-black border border-[hsl(var(--og-blood))]/40 rounded-lg p-6 max-w-sm">
        <div class="text-center mb-4">
          <h2 class="text-lg font-bold text-white mb-2">Connect Phantom Wallet</h2>
          <p class="text-sm text-gray-400">Your Phantom app will open in a new tab</p>
        </div>
        <button class="w-full bg-[hsl(var(--og-blood))] hover:bg-[hsl(var(--og-blood))]/80 text-white font-semibold py-2 px-4 rounded transition" onclick="window.open('${getPhantomDeepLink()}', '_blank')">
          Open Phantom App
        </button>
        <button class="w-full mt-2 bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded transition" onclick="this.closest('.fixed').remove()">
          Cancel
        </button>
      </div>
    `;
  } else {
    // Desktop or already in Phantom browser
    container.innerHTML = `
      <div class="bg-black border border-[hsl(var(--og-blood))]/40 rounded-lg p-6 max-w-sm">
        <div class="text-center mb-4">
          <h2 class="text-lg font-bold text-white mb-2">Connect Phantom Wallet</h2>
          <p class="text-sm text-gray-400">Approve the connection in your Phantom extension</p>
        </div>
        <button class="w-full bg-[hsl(var(--og-blood))] hover:bg-[hsl(var(--og-blood))]/80 text-white font-semibold py-2 px-4 rounded transition" onclick="connectPhantomStandard()">
          Connect Phantom
        </button>
        <button class="w-full mt-2 bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded transition" onclick="this.closest('.fixed').remove()">
          Cancel
        </button>
      </div>
    `;
  }

  return container;
}

/**
 * Check if we can use standard Phantom extension (desktop)
 */
export function hasPhantomExtension(): boolean {
  return !!(window as any).phantom?.solana?.isPhantom;
}

/**
 * Detect if running in Phantom mobile app
 */
export function isRunningInPhantomApp(): boolean {
  return /phantom/.test(navigator.userAgent.toLowerCase()) || 
    (window as any).phantom?.solana?.isPhantom === true;
}
