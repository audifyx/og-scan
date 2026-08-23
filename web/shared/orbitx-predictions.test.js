import { describe, expect, it } from "vitest";
import {
  ORBITX_PREDICTIONS_URL,
  isHttpUrl,
  resolvePredictionsUrl,
} from "./orbitx-predictions.js";

describe("OrbitX Predictions URL", () => {
  it("is the live orbitxtrade.world product", () => {
    expect(ORBITX_PREDICTIONS_URL).toBe("https://orbitxtrade.world/");
  });

  it("rewrites stub and retired hosts to the live product", () => {
    expect(resolvePredictionsUrl("/predictions")).toBe(ORBITX_PREDICTIONS_URL);
    expect(resolvePredictionsUrl("/predictions/market/1")).toBe(ORBITX_PREDICTIONS_URL);
    expect(resolvePredictionsUrl("https://solno.fun")).toBe(ORBITX_PREDICTIONS_URL);
    expect(resolvePredictionsUrl("http://orbitx-prediction.fun/")).toBe(ORBITX_PREDICTIONS_URL);
  });

  it("keeps other hrefs intact", () => {
    expect(isHttpUrl("https://orbitxtrade.world/")).toBe(true);
    expect(isHttpUrl("/os")).toBe(false);
    expect(resolvePredictionsUrl("/play")).toBe("/play");
  });
});
