import { describe, expect, it } from "vitest";
import {
  applyWizardImage,
  applyWizardText,
  appendTelegramHandoffParams,
  beginConfirm,
  createNftSession,
  createTokenSession,
  isLaunchCancel,
  launchSuccessHtml,
  markDone,
  markSigning,
  memoryClear,
  memoryGet,
  memorySet,
  nftSuccessHtml,
  parseLaunchSeed,
  parseNftSeed,
  wizardPrompt,
} from "./telegram-launch-session.js";

describe("telegram launch session", () => {
  it("parses Launch $STEVE as ticker-only so the wizard asks for the name", () => {
    expect(parseLaunchSeed("Launch $STEVE")).toEqual({ name: "", symbol: "STEVE" });
    expect(parseLaunchSeed("launch steve")).toEqual({ name: "", symbol: "STEVE" });
    expect(parseLaunchSeed("Launch Steve Coin STEVE")).toEqual({ name: "Steve Coin", symbol: "STEVE" });
    expect(parseLaunchSeed("/launch")).toEqual({ name: "", symbol: "" });
  });

  it("parses NFT launch seeds", () => {
    expect(parseNftSeed("Launch an NFT")).toEqual({ name: "", symbol: "" });
    expect(parseNftSeed("mint nft Steve Pass STEVE")).toEqual({ name: "Steve Pass", symbol: "STEVE" });
  });

  it("keeps two users' wizards isolated", () => {
    const a = createTokenSession({ telegramUserId: "1", chatId: "10", seed: { symbol: "STEVE" } });
    const b = createTokenSession({ telegramUserId: "2", chatId: "20", seed: { symbol: "BOB" } });
    memorySet(a);
    memorySet(b);
    expect(memoryGet("1")?.ticker).toBe("STEVE");
    expect(memoryGet("2")?.ticker).toBe("BOB");
    memoryClear("1");
    expect(memoryGet("1")).toBeNull();
    expect(memoryGet("2")?.ticker).toBe("BOB");
    memoryClear("2");
  });

  it("walks ticker → name → image → website → X → description → confirm", () => {
    const s = createTokenSession({ telegramUserId: "9", seed: { symbol: "STEVE" } });
    expect(s.step).toBe("name");
    expect(applyWizardText(s, "Steve Coin").session.step).toBe("image");
    expect(applyWizardImage(s, { fileId: "photo-1" }).session.step).toBe("website");
    expect(applyWizardText(s, "OrbitX.world").session.website).toMatch(/orbitx\.world/i);
    expect(s.step).toBe("twitter");
    expect(applyWizardText(s, "@orbitx_wrld").session.twitter).toMatch(/orbitx_wrld/i);
    expect(s.step).toBe("description");
    expect(applyWizardText(s, "A test token").session.step).toBe("confirm");
    expect(s.description).toBe("A test token");
    const card = wizardPrompt(s);
    expect(card.text).toContain("Confirm token launch");
    expect(card.reply_markup.inline_keyboard[0][0].callback_data).toContain(s.confirmNonce);
  });

  it("requires explicit confirm and ignores a stale nonce / double tap", () => {
    const s = createTokenSession({ telegramUserId: "3", seed: { name: "Steve Coin", symbol: "STEVE" } });
    applyWizardImage(s, { fileId: "img" });
    applyWizardText(s, "skip");
    applyWizardText(s, "skip");
    applyWizardText(s, "A test token");
    expect(beginConfirm(s, "nope").error).toBe("stale_nonce");
    const first = beginConfirm(s, s.confirmNonce);
    expect(first.ok).toBe(true);
    expect(s.inFlight).toBe(true);
    expect(beginConfirm(s, s.confirmNonce).error).toBe("in_flight");
    markSigning(s, { openUrl: "https://www.orbitx.world/agent/create-token?name=Steve" });
    const again = beginConfirm(s, s.confirmNonce);
    expect(again.alreadySigning).toBe(true);
  });

  it("never renders a launch card without a real mint + signature", () => {
    const empty = launchSuccessHtml({ name: "Steve Coin", ticker: "STEVE" });
    expect(empty).toMatch(/not confirmed/i);
    expect(empty).not.toMatch(/Token Launched/);
    const fake = "1".repeat(64);
    expect(launchSuccessHtml({ name: "Steve", ticker: "STEVE", mint: fake, signature: "" })).toMatch(/not confirmed/i);
    const html = launchSuccessHtml({
      name: "Steve Coin",
      ticker: "STEVE",
      mint: "So11111111111111111111111111111111111111112",
      signature: "5".repeat(88),
    });
    expect(html).toContain("Token Launched");
    expect(html).toContain("So11111111111111111111111111111111111111112");
    expect(html).toContain("solscan.io/tx/");
    expect(html).toContain("orbitx.world/ORBITX_DEX/token/");
    expect(html).toMatch(/does not burn \$ORBITX/i);
  });

  it("NFT success also requires a real mint + signature", () => {
    expect(nftSuccessHtml({ name: "Pass" })).toMatch(/not confirmed/i);
    const html = nftSuccessHtml({
      name: "Steve Pass",
      ticker: "STEVE",
      mint: "So11111111111111111111111111111111111111112",
      signature: "5".repeat(88),
    });
    expect(html).toContain("NFT minted");
    expect(html).toContain("solscan.io/tx/");
  });

  it("appends telegram handoff params onto the existing launch URL", () => {
    const s = createTokenSession({ telegramUserId: "42", chatId: "99", seed: { symbol: "STEVE" } });
    const url = appendTelegramHandoffParams("https://www.orbitx.world/agent/create-token?name=Steve&symbol=STEVE", s);
    expect(url).toContain("telegramUser=42");
    expect(url).toContain("chat=99");
    expect(url).toContain(`nonce=${s.confirmNonce}`);
  });

  it("treats cancel as an explicit abort", () => {
    expect(isLaunchCancel("cancel")).toBe(true);
    expect(isLaunchCancel("/cancel")).toBe(true);
    expect(isLaunchCancel("Launch $STEVE")).toBe(false);
  });
});
