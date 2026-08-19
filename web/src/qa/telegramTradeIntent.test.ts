import { describe, expect, it } from "vitest";
import {
  applyTelegramAlias,
  parseSolAmount,
  parseTradeIntent,
  parseUsdAmount,
} from "../../api/orbitx/telegram-trade-intent.js";
import {
  inferPublicTool,
  isPrivilegedTelegramTool,
  parseCallInvocation,
  resolveOfficialCommand,
} from "../../api/orbitx/telegram-orbitx-lib.js";
import { hasEmbeddedAgentTool, listAllOrbitXTools, resolveOrbitXToolName } from "../../api/orbitx-hub.js";

const ORBITX = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

describe("official Telegram trade wiring", () => {
  it("maps guessed names like orbitx_trade onto live hub tools", () => {
    expect(applyTelegramAlias("orbitx_trade")).toBe("orbitx_prepare_buy");
    expect(applyTelegramAlias("trade")).toBe("orbitx_prepare_buy");
    expect(applyTelegramAlias("shop")).toBe("orbitx_shop");
    expect(resolveOfficialCommand("trade").tool).toBe("orbitx_prepare_buy");
    expect(resolveOfficialCommand("shop").tool).toBe("orbitx_shop");
    expect(parseCallInvocation("/call trade").tool).toBe("orbitx_prepare_buy");
    expect(parseCallInvocation("/call orbitx_trade").tool).toBe("orbitx_prepare_buy");
    expect(resolveOrbitXToolName("orbitx_trade")).toBe("orbitx_prepare_buy");
    expect(resolveOrbitXToolName("orbitx_swap")).toBe("orbitx_prepare_buy");
    expect(hasEmbeddedAgentTool("orbitx_trade")).toBe(true);
    expect(listAllOrbitXTools().some((t) => t.name === "orbitx_trade")).toBe(true);
    expect(hasEmbeddedAgentTool("orbitx_shop")).toBe(true);
    expect(hasEmbeddedAgentTool("orbitx_prepare_buy")).toBe(true);
    expect(isPrivilegedTelegramTool("orbitx_prepare_buy")).toBe(true);
    expect(isPrivilegedTelegramTool("orbitx_trade_auto")).toBe(true);
  });

  it("parses SOL, USD/USDC, auto-buy, and $ORBITX buys from chat text", () => {
    expect(parseUsdAmount("with 10$ usdc")).toBe(10);
    expect(parseUsdAmount("$10")).toBe(10);
    expect(parseSolAmount("0.1 sol")).toBe(0.1);

    const alt = parseTradeIntent(`buy ${ORBITX} with 10$ usdc`);
    expect(alt?.tool).toBe("orbitx_buy_orbitx");
    expect(alt?.args.amountUsd).toBe(10);
    expect(alt?.args.mint).toBe(ORBITX);

    const other = parseTradeIntent("buy So11111111111111111111111111111111111111112 with 10$ usdc");
    expect(other?.tool).toBe("orbitx_prepare_buy");
    expect(other?.args.amountUsd).toBe(10);
    expect(other?.args.mint).toBe("So11111111111111111111111111111111111111112");

    const auto = parseTradeIntent("auto buy 0.2 sol of $ORBITX");
    expect(auto?.tool).toBe("orbitx_buy_orbitx");
    expect(auto?.args.autoConfirm).toBe(true);
    expect(auto?.args.amountSol).toBe(0.2);

    expect(parseTradeIntent("/autobuy on")?.meta).toBe("autobuy");
    expect(inferPublicTool(`buy ${ORBITX} with 10$ usdc`)?.tool).toBe("orbitx_buy_orbitx");
    expect(inferPublicTool(ORBITX)?.tool).toBe("orbitx_get_token");
  });

  it("exposes a 2500+ live OrbitX tool catalog", () => {
    const tools = listAllOrbitXTools();
    expect(tools.length).toBeGreaterThanOrEqual(2500);
    expect(tools.some((t) => t.name === "orbitx_prepare_buy")).toBe(true);
    expect(tools.some((t) => t.name === "orbitx_execute_launch")).toBe(true);
    expect(tools.some((t) => t.name === "orbitx_mint_nft")).toBe(true);
    expect(tools.some((t) => t.name === "orbitx_shop")).toBe(true);
    expect(tools.some((t) => t.name === "orbitx_buy_orbitx")).toBe(true);
  });
});
