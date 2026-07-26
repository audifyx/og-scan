import { describe, expect, it } from "vitest";
import { cityAudio } from "./cityAudio";

describe("cityAudio", () => {
  it("exposes music/sfx prefs", () => {
    cityAudio.setMusicVol(0.45);
    cityAudio.setSfxVol(0.7);
    const s = cityAudio.getState();
    expect(typeof s.musicOn).toBe("boolean");
    expect(typeof s.sfxOn).toBe("boolean");
    expect(s.musicVol).toBeCloseTo(0.45);
    expect(s.sfxVol).toBeCloseTo(0.7);
  });

  it("toggles music without throwing in node", () => {
    const before = cityAudio.getState().musicOn;
    cityAudio.setMusicOn(!before);
    expect(cityAudio.getState().musicOn).toBe(!before);
    cityAudio.setMusicOn(before);
  });
});
