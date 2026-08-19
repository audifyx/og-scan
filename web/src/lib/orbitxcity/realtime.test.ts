import { describe, expect, it } from "vitest";
import { MAIN_LOBBY, districtLobby, isDistrictLobby, watchLobbyDirectory } from "./realtime";

describe("realtime lobby helpers", () => {
  it("treats oxc-world-* as district rooms and oxc-lobby-* as custom", () => {
    expect(isDistrictLobby(MAIN_LOBBY.id)).toBe(true);
    expect(isDistrictLobby("oxc-world-miami")).toBe(true);
    expect(isDistrictLobby("oxc-lobby-friends-open")).toBe(false);
  });

  it("maps a city id onto the matching public room", () => {
    expect(districtLobby("nyc")).toEqual(MAIN_LOBBY);
    expect(districtLobby("la").id).toBe("oxc-world-la");
    expect(districtLobby("la").isPrivate).toBe(false);
  });

  it("watchLobbyDirectory always emits Main Lobby even when Realtime is off", () => {
    let latest: { id: string }[] = [];
    const stop = watchLobbyDirectory((list) => {
      latest = list;
    });
    expect(latest.some((l) => l.id === MAIN_LOBBY.id)).toBe(true);
    stop();
  });
});
