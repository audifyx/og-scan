import { useEffect, useMemo, useState } from "react";
import { getMultiplayerKit } from "../../multiplayer/client";
import type { ChatMessage, MatchmakingTicket } from "../../multiplayer/client";
import type { LobbyDescriptor, PartyMember, PresencePeer } from "../../types";
import { useGameProfile } from "../../state/useGameProfile";
import { unlockAchievement } from "../../systems/progression";
import { bumpMission, pushNotification } from "../../state/GameProfileStore";

export function PlayMultiplayerPage() {
  const { profile, updateProfile } = useGameProfile();
  const kit = useMemo(() => getMultiplayerKit(), []);
  const [lobbies, setLobbies] = useState<LobbyDescriptor[]>([]);
  const [peers, setPeers] = useState<PresencePeer[]>([]);
  const [party, setParty] = useState<PartyMember[]>([]);
  const [partyId, setPartyId] = useState<string | null>(profile.partyId);
  const [ticket, setTicket] = useState<MatchmakingTicket | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [password, setPassword] = useState("");
  const [voiceRoom, setVoiceRoom] = useState<string | null>(null);

  useEffect(() => {
    kit.lobbies.list().then(setLobbies);
    return kit.presence.subscribe(setPeers);
  }, [kit]);

  useEffect(() => kit.chat.subscribe("lobby", setChat), [kit]);

  useEffect(() => {
    if (!ticket || ticket.status !== "queued") return;
    const id = setInterval(() => {
      const t = kit.matchmaking.getTicket(ticket.id);
      if (t) setTicket({ ...t });
    }, 400);
    return () => clearInterval(id);
  }, [ticket, kit]);

  const selfMember = (): PartyMember => ({
    id: "self",
    name: profile.character.name,
    classId: profile.character.classId,
    ready: false,
    leader: true,
  });

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <div className="gx-kicker">Multiplayer</div>
        <h1 className="gx-title" style={{ fontSize: "1.7rem" }}>
          Lobbies · parties · presence
        </h1>
        <p className="gx-lead">Client architecture ready for Realtime/LiveKit wiring. Local kit for Studio QA.</p>
      </div>

      <div className="gx-panel">
        <div className="gx-kicker">Matchmaking</div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
          <button
            type="button"
            className="gx-btn gx-btn-primary"
            onClick={async () => {
              const t = await kit.matchmaking.enqueue("arena");
              setTicket(t);
            }}
          >
            Queue arena
          </button>
          {ticket && (
            <button type="button" className="gx-btn" onClick={() => kit.matchmaking.cancel(ticket.id).then(() => setTicket({ ...ticket, status: "cancelled" }))}>
              Cancel
            </button>
          )}
        </div>
        {ticket && (
          <div className="gx-badge" style={{ marginTop: "0.75rem" }}>
            {ticket.status.toUpperCase()} {ticket.lobbyId ? `→ ${ticket.lobbyId}` : ""}
          </div>
        )}
      </div>

      <div className="gx-panel">
        <div className="gx-kicker">Game lobbies</div>
        <div className="gx-list" style={{ marginTop: "0.65rem" }}>
          {lobbies.map((l) => (
            <div key={l.id} className="gx-row">
              <div>
                <strong style={{ fontFamily: "var(--gx-display)", fontSize: "0.8rem" }}>{l.label}</strong>
                <div style={{ color: "var(--gx-muted)", fontSize: "0.75rem" }}>
                  {l.mode} · {l.players}/{l.maxPlayers} · {l.visibility} · {l.region}
                </div>
              </div>
              <button
                type="button"
                className="gx-btn gx-btn-primary"
                style={{ padding: "0.35rem 0.7rem" }}
                onClick={async () => {
                  try {
                    const joined = await kit.lobbies.join(l.id, l.passwordRequired ? password || undefined : undefined);
                    setLobbies(await kit.lobbies.list());
                    pushNotification({ kind: "social", title: "Joined lobby", body: joined.label });
                    if (l.mode === "city") window.location.href = "/Orbitxcity";
                  } catch (e) {
                    pushNotification({ kind: "info", title: "Join failed", body: e instanceof Error ? e.message : "error" });
                  }
                }}
              >
                Join
              </button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
          <input className="gx-input" style={{ maxWidth: 180 }} placeholder="Private password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button
            type="button"
            className="gx-btn"
            onClick={async () => {
              const lobby = await kit.lobbies.create({ label: `${profile.character.name}'s Room`, mode: "social", visibility: "public" });
              setLobbies(await kit.lobbies.list());
              pushNotification({ kind: "social", title: "Lobby created", body: lobby.label });
            }}
          >
            Create public lobby
          </button>
        </div>
      </div>

      <div className="gx-panel">
        <div className="gx-kicker">Party</div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.65rem" }}>
          <button
            type="button"
            className="gx-btn gx-btn-primary"
            onClick={async () => {
              const res = await kit.parties.create(selfMember());
              setPartyId(res.partyId);
              setParty(res.members);
              updateProfile((p) => {
                const unlocked = unlockAchievement(p.progression, "party_up");
                return { ...p, partyId: res.partyId, progression: unlocked.prog };
              });
            }}
          >
            Create party
          </button>
          <button
            type="button"
            className="gx-btn"
            disabled={!partyId}
            onClick={async () => {
              if (!partyId) return;
              const members = await kit.parties.invite(partyId, {
                id: `bot_${Date.now()}`,
                name: "ShardQueen",
                classId: "socialite",
                ready: false,
                leader: false,
              });
              setParty(members);
              updateProfile((p) => bumpMission(p, "weekly_party", "party_sessions", 1));
            }}
          >
            Invite friend
          </button>
          <button
            type="button"
            className="gx-btn"
            disabled={!partyId}
            onClick={async () => {
              if (!partyId) return;
              const members = await kit.parties.setReady(partyId, "self", true);
              setParty(members);
            }}
          >
            Ready up
          </button>
        </div>
        <div className="gx-list" style={{ marginTop: "0.75rem" }}>
          {party.map((m) => (
            <div key={m.id} className="gx-row">
              <span>{m.name} · {m.classId}{m.leader ? " · leader" : ""}</span>
              <span className="gx-badge">{m.ready ? "READY" : "WAIT"}</span>
            </div>
          ))}
          {party.length === 0 && <div style={{ color: "var(--gx-muted)", fontSize: "0.85rem" }}>No active party.</div>}
        </div>
      </div>

      <div className="gx-grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        <div className="gx-panel">
          <div className="gx-kicker">Presence</div>
          <div className="gx-list" style={{ marginTop: "0.55rem" }}>
            {peers.map((p) => (
              <div key={p.id} className="gx-row">
                <span>{p.name}</span>
                <span className="gx-badge">{p.status}</span>
              </div>
            ))}
          </div>
          <div className="gx-kicker" style={{ marginTop: "0.85rem" }}>Friends</div>
          <div className="gx-list" style={{ marginTop: "0.45rem" }}>
            {profile.friends.map((f) => (
              <div key={f} className="gx-row"><span>{f}</span><span className="gx-badge">FRIEND</span></div>
            ))}
          </div>
        </div>

        <div className="gx-panel">
          <div className="gx-kicker">Lobby chat</div>
          <div className="gx-chat" style={{ marginTop: "0.55rem" }}>
            {chat.map((m) => (
              <div key={m.id}><b>{m.name}</b>: {m.text}</div>
            ))}
          </div>
          <form
            style={{ display: "flex", gap: "0.4rem", marginTop: "0.65rem" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              kit.chat.send("lobby", "self", profile.character.name, draft);
              updateProfile((p) => bumpMission(p, "daily_social", "chat", 1));
              setDraft("");
            }}
          >
            <input className="gx-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Say something…" />
            <button type="submit" className="gx-btn gx-btn-primary">Send</button>
          </form>
          <button
            type="button"
            className="gx-btn"
            style={{ marginTop: "0.65rem" }}
            onClick={async () => {
              if (voiceRoom) {
                await kit.voice.leave();
                setVoiceRoom(null);
              } else {
                const s = await kit.voice.join("voice-plaza");
                setVoiceRoom(s.roomId);
                updateProfile((p) => {
                  const unlocked = unlockAchievement(p.progression, "voice_join");
                  return { ...p, progression: unlocked.prog };
                });
              }
            }}
          >
            {voiceRoom ? `Leave voice (${voiceRoom})` : "Join voice plaza"}
          </button>
        </div>
      </div>
    </div>
  );
}
