import "@testing-library/jest-dom";

// Tests pinned to the node environment (e.g. packaging assertions under
// api/) have no DOM. Skip the browser shims rather than throwing on import.
const HAS_DOM = typeof window !== "undefined" && typeof Element !== "undefined";

if (HAS_DOM) {
  // jsdom does not implement scrolling APIs that layout code calls on mount.
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
