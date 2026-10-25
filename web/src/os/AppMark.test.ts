import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { render } from "@testing-library/react";
import { createElement } from "react";
import { PLATFORM_APPS, type PlatformApp } from "../lib/orbitxPlatforms";
import { AppMark } from "./AppMark";

// public/ lives at web/public; this test lives at web/src/os/.
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "public");

describe("AppMark icons", () => {
  it("every catalog app opts into a real icon image", () => {
    for (const app of PLATFORM_APPS) {
      expect(app.iconSrc, `${app.key} is missing iconSrc`).toBe(`/icons/${app.key}.png`);
    }
  });

  it("every iconSrc resolves to a file under public/icons/", () => {
    for (const app of PLATFORM_APPS) {
      const rel = (app.iconSrc || "").replace(/^\//, "");
      expect(rel.startsWith("icons/")).toBe(true);
      expect(existsSync(join(PUBLIC_DIR, rel)), `${app.key}: ${app.iconSrc} has no file`).toBe(true);
    }
  });

  it("renders the image overlay when iconSrc is set, glyph-only otherwise", () => {
    const withIcon = PLATFORM_APPS[0];
    const { container: c1 } = render(createElement(AppMark, { app: withIcon, className: "oxos-icon__mark" }));
    const img = c1.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe(withIcon.iconSrc);

    const noIcon: PlatformApp = { ...withIcon, iconSrc: undefined };
    const { container: c2 } = render(createElement(AppMark, { app: noIcon, className: "oxos-icon__mark" }));
    expect(c2.querySelector("img")).toBeNull();
    expect(c2.querySelector("svg")).not.toBeNull();
  });
});
