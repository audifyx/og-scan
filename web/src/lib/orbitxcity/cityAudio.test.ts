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

  it("exposes uploaded theme playlist", () => {
    const s = cityAudio.getState();
    expect(s.tracks.length).toBeGreaterThan(5);
    expect(s.trackId).toBeTruthy();
    expect(s.trackTitle).toBeTruthy();
    cityAudio.setTrack(s.tracks[1]!.id);
    expect(cityAudio.getState().trackId).toBe(s.tracks[1]!.id);
    cityAudio.setTrack(s.tracks[0]!.id);
  });
});
