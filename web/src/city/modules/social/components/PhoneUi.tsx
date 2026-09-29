/**
 * PhoneUi — GTA-style in-game phone.
 *
 * Apps: Calls, Texts, Camera, Web (in-world sites), Feed (LifeInvasion),
 * News (Channel 6), Maps (venues + teleport), Settings (paper ledger).
 *
 * Calls: dial contacts, incoming NPC calls (scripted subtitle lines while
 * active), hang up. Texts: threads with scripted NPC replies (no LLM).
 * Camera: captures the game canvas via the integrator's `takeSnapshot`
 * fn — no device camera access. Photos post to LifeInvasion.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { usePhone } from "../hooks/usePhone";
import { useSocialFeed } from "../hooks/useSocialFeed";
import { useNews } from "../hooks/useNews";
import { IN_WORLD_SITES, PHONE_CONTACTS, VENUES } from "../data/socialData";
import { venueCoord } from "../data/venueCoords";
import { paperLedger } from "../engine/paperLedger";
import type { PhoneAppId, PhoneContact, TokenDrama } from "../types";
import { FeedUi } from "./FeedUi";
import { NewsUi } from "./NewsUi";
import { NpcAvatar } from "./NpcAvatar";

export interface TeleportFn {
  (x: number, z: number, heading?: number): void;
}

export interface PhoneUiProps {
  playerName: string;
  playerHandle: string;
  drama: TokenDrama[];
  takeSnapshot?: () => string | null;
  teleport?: TeleportFn;
  onClose: () => void;
}

const APPS: { id: PhoneAppId; icon: string; label: string }[] = [
  { id: "calls", icon: "📞", label: "Calls" },
  { id: "texts", icon: "💬", label: "Texts" },
  { id: "camera", icon: "📷", label: "Camera" },
  { id: "web", icon: "🌐", label: "Web" },
  { id: "feed", icon: "🌀", label: "Feed" },
  { id: "news", icon: "📺", label: "News" },
  { id: "maps", icon: "🗺", label: "Maps" },
  { id: "settings", icon: "⚙️", label: "Settings" },
];

export function PhoneUi({ playerName, playerHandle, drama, takeSnapshot, teleport, onClose }: PhoneUiProps) {
  const [app, setApp] = useState<PhoneAppId | null>(null);
  const phone = usePhone(playerName);
  const feed = useSocialFeed(drama, playerName, playerHandle);
  const news = useNews(drama);

  // GTA flavor: random incoming NPC call every ~2 min while the phone is open
  useEffect(() => {
    const iv = setInterval(() => phone.simulateIncoming(), 120_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // auto-advance call subtitles while a call is active
  useEffect(() => {
    if (phone.activeCall?.status !== "active") return;
    const iv = setInterval(() => phone.advanceCallScript(), 3400);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone.activeCall?.status]);

  const clock = useMemo(
    () =>
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app]
  );

  return (
    <div className="oxs-overlay" onClick={onClose}>
      <div className="oxs-phone" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="In-game phone">
        <div className="oxs-phone-notch" />
        {phone.incoming && (
          <div className="oxs-incoming">
            <p className="oxs-incoming-name">{contactName(phone.incoming.contactId)}</p>
            <p className="oxs-muted">incoming call…</p>
            <div className="oxs-row">
              <button className="oxs-btn oxs-btn-primary" onClick={phone.answerIncoming}>Answer</button>
              <button className="oxs-btn oxs-btn-ghost" onClick={phone.declineIncoming}>Decline</button>
            </div>
          </div>
        )}
        {phone.activeCall ? (
          <CallScreen
            contactId={phone.activeCall.contactId}
            status={phone.activeCall.status}
            script={phone.callScript}
            scriptIdx={phone.callScriptIdx}
            onHangUp={phone.endCall}
            onBack={() => setApp(null)}
          />
        ) : app === null ? (
          <div className="oxs-phone-screen">
            <div className="oxs-home-time">
              <div className="oxs-home-clock">{clock}</div>
              <div className="oxs-muted oxs-small">OrbitX City</div>
            </div>
            <div className="oxs-app-grid">
              {APPS.map((a) => (
                <button key={a.id} className="oxs-app" onClick={() => setApp(a.id)}>
                  <span className="oxs-app-icon">{a.icon}</span>
                  <span className="oxs-app-label">{a.label}</span>
                  {a.id === "news" && news.unread > 0 && <span className="oxs-badge">{news.unread}</span>}
                  {a.id === "texts" && <TextBadge threads={phone.threads} />}
                </button>
              ))}
            </div>
            <button className="oxs-btn oxs-btn-ghost oxs-home-close" onClick={onClose}>
              Put phone away
            </button>
          </div>
        ) : (
          <div className="oxs-phone-screen">
            <AppBar app={app} onBack={() => setApp(null)} />
            {app === "calls" && <CallsApp phone={phone} />}
            {app === "texts" && <TextsApp phone={phone} />}
            {app === "camera" && <CameraApp phone={phone} feed={feed} takeSnapshot={takeSnapshot} />}
            {app === "web" && <WebApp />}
            {app === "feed" && <FeedUi feed={feed} embedded />}
            {app === "news" && <NewsUi news={news} embedded />}
            {app === "maps" && <MapsApp teleport={teleport} onClose={onClose} />}
            {app === "settings" && <SettingsApp playerName={playerName} />}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function contactName(id: string): string {
  return PHONE_CONTACTS.find((c) => c.id === id)?.name ?? id;
}

function AppBar({ app, onBack }: { app: PhoneAppId; onBack: () => void }) {
  const label = APPS.find((a) => a.id === app)?.label ?? app;
  return (
    <div className="oxs-appbar">
      <button className="oxs-btn oxs-btn-ghost" onClick={onBack} aria-label="Back">‹</button>
      <span className="oxs-appbar-title">{label}</span>
      <span style={{ width: 40 }} />
    </div>
  );
}

function TextBadge({ threads }: { threads: Record<string, { fromMe: boolean; ts: number }[]> }) {
  void threads;
  return null;
}

// --- Calls ---------------------------------------------------------------

type PhoneApi = ReturnType<typeof usePhone>;

function CallsApp({ phone }: { phone: PhoneApi }) {
  return (
    <div className="oxs-contacts">
      {phone.contacts.map((c: PhoneContact) => (
        <div key={c.id} className="oxs-contact">
          <div>
            <div className="oxs-contact-name">
              {c.name} <span className={`oxs-presence ${c.online ? "on" : ""}`} />
            </div>
            <div className="oxs-muted oxs-small">{c.number}</div>
          </div>
          <button className="oxs-btn oxs-btn-primary" onClick={() => phone.startCall(c.id)}>
            Call
          </button>
        </div>
      ))}
      <p className="oxs-muted oxs-small">NPC calls are scripted in-world flavor — no real telephony.</p>
    </div>
  );
}

function CallScreen({
  contactId, status, script, scriptIdx, onHangUp, onBack,
}: {
  contactId: string;
  status: string;
  script: string[];
  scriptIdx: number;
  onHangUp: () => void;
  onBack: () => void;
}) {
  const line = script[Math.min(scriptIdx, script.length - 1)] ?? "…";
  return (
    <div className="oxs-call-screen">
      <button className="oxs-btn oxs-btn-ghost" onClick={onBack} style={{ alignSelf: "flex-start" }}>‹</button>
      <div className="oxs-call-avatar">📞</div>
      <h3 className="oxs-title">{contactName(contactId)}</h3>
      <p className="oxs-muted">{status === "ringing" ? "ringing…" : status === "active" ? "connected" : status}</p>
      {status === "active" && (
        <div className="oxs-call-subtitles">
          <p>"{line}"</p>
        </div>
      )}
      <button className="oxs-btn oxs-btn-danger oxs-call-end" onClick={onHangUp}>
        End call
      </button>
    </div>
  );
}

// --- Texts ---------------------------------------------------------------

function TextsApp({ phone }: { phone: PhoneApi }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [openId, phone.threads]);

  if (!openId) {
    return (
      <div className="oxs-contacts">
        {phone.contacts.map((c: PhoneContact) => {
          const msgs = phone.threads[c.id] ?? [];
          const last = msgs[msgs.length - 1];
          return (
            <button key={c.id} className="oxs-contact oxs-contact-btn" onClick={() => setOpenId(c.id)}>
              <div>
                <div className="oxs-contact-name">{c.name}</div>
                <div className="oxs-muted oxs-small">{last ? last.text.slice(0, 42) : "no messages yet"}</div>
              </div>
              <span>›</span>
            </button>
          );
        })}
      </div>
    );
  }

  const msgs = phone.threads[openId] ?? [];
  return (
    <div className="oxs-thread">
      <button className="oxs-btn oxs-btn-ghost" onClick={() => setOpenId(null)}>‹ {contactName(openId)}</button>
      <div className="oxs-msgs">
        {msgs.map((m) => (
          <div key={m.id} className={`oxs-msg ${m.fromMe ? "me" : "them"}`}>
            {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="oxs-composer-row">
        <input
          className="oxs-input"
          value={draft}
          maxLength={280}
          placeholder="Text…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              phone.sendText(openId, draft);
              setDraft("");
            }
          }}
        />
        <button
          className="oxs-btn oxs-btn-primary"
          onClick={() => {
            phone.sendText(openId, draft);
            setDraft("");
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// --- Camera --------------------------------------------------------------

function CameraApp({
  phone, feed, takeSnapshot,
}: {
  phone: PhoneApi;
  feed: ReturnType<typeof useSocialFeed>;
  takeSnapshot?: () => string | null;
}) {
  const [caption, setCaption] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);

  const snap = () => {
    setErr(null);
    if (!takeSnapshot) {
      setErr("Camera isn't wired to the game canvas yet (integrator: pass takeSnapshot).");
      return;
    }
    const url = takeSnapshot();
    if (!url) {
      setErr("Snapshot failed — try again when the 3D scene is rendering.");
      return;
    }
    setFlash(true);
    setTimeout(() => setFlash(false), 220);
    phone.addPhoto(url, caption.trim() || "orbitx city");
    setCaption("");
  };

  return (
    <div className="oxs-camera">
      <div className={`oxs-viewfinder ${flash ? "flash" : ""}`}>
        {phone.photos[0] ? (
          <img src={phone.photos[0].dataUrl} alt={phone.photos[0].caption} />
        ) : (
          <p className="oxs-muted">Viewfinder — captures the live game canvas.</p>
        )}
      </div>
      <div className="oxs-composer-row">
        <input
          className="oxs-input"
          value={caption}
          maxLength={60}
          placeholder="Caption…"
          onChange={(e) => setCaption(e.target.value)}
        />
        <button className="oxs-btn oxs-btn-primary" onClick={snap}>📸 Snap</button>
      </div>
      {err && <p className="oxs-error">{err}</p>}
      <div className="oxs-gallery">
        {phone.photos.map((p) => (
          <div key={p.id} className="oxs-photo">
            <img src={p.dataUrl} alt={p.caption} />
            <div className="oxs-photo-bar">
              <span className="oxs-small">{p.caption}</span>
              <span className="oxs-row">
                <button
                  className="oxs-btn oxs-btn-ghost oxs-small"
                  onClick={() => {
                    feed.post(`📸 ${p.caption}`);
                  }}
                >
                  Post to Feed
                </button>
                <button className="oxs-btn oxs-btn-ghost oxs-small" onClick={() => phone.deletePhoto(p.id)}>
                  ✕
                </button>
              </span>
            </div>
          </div>
        ))}
        {phone.photos.length === 0 && <p className="oxs-muted oxs-small">No photos yet.</p>}
      </div>
    </div>
  );
}

// --- Web -----------------------------------------------------------------

function WebApp() {
  const [siteId, setSiteId] = useState<string | null>(null);
  const site = IN_WORLD_SITES.find((s) => s.id === siteId);
  if (!site) {
    return (
      <div className="oxs-contacts">
        {IN_WORLD_SITES.map((s) => (
          <button key={s.id} className="oxs-contact oxs-contact-btn" onClick={() => setSiteId(s.id)}>
            <div>
              <div className="oxs-contact-name">🌐 {s.title}</div>
              <div className="oxs-muted oxs-small">{s.url}</div>
            </div>
            <span>›</span>
          </button>
        ))}
        <p className="oxs-muted oxs-small">In-world web only — these sites live inside OrbitX City.</p>
      </div>
    );
  }
  return (
    <div className="oxs-site">
      <button className="oxs-btn oxs-btn-ghost" onClick={() => setSiteId(null)}>‹ Sites</button>
      <h3 className="oxs-title">{site.title}</h3>
      <p className="oxs-muted oxs-small">{site.url}</p>
      <p>{site.body}</p>
    </div>
  );
}

// --- Maps ----------------------------------------------------------------

function MapsApp({ teleport, onClose }: { teleport?: TeleportFn; onClose: () => void }) {
  return (
    <div className="oxs-contacts">
      {VENUES.map((v) => {
        const c = venueCoord(v.id);
        return (
          <div key={v.id} className="oxs-contact">
            <div>
              <div className="oxs-contact-name">{v.name}</div>
              <div className="oxs-muted oxs-small">{v.district} · {v.blurb}</div>
            </div>
            {c && teleport ? (
              <button
                className="oxs-btn oxs-btn-primary"
                onClick={() => {
                  teleport(c.x, c.z, c.heading);
                  onClose();
                }}
              >
                Go
              </button>
            ) : (
              <span className="oxs-chip">soon</span>
            )}
          </div>
        );
      })}
      {!teleport && (
        <p className="oxs-muted oxs-small">
          Fast-travel unlocks when the integrator passes a teleport fn (see MODULE.md).
        </p>
      )}
    </div>
  );
}

// --- Settings ------------------------------------------------------------

function SettingsApp({ playerName }: { playerName: string }) {
  const [balance, setBalance] = useState(paperLedger.balance);
  useEffect(() => paperLedger.subscribe(setBalance), []);
  return (
    <div className="oxs-site">
      <h3 className="oxs-title">Settings</h3>
      <p><strong>{playerName}</strong></p>
      <p>Paper CITY: <strong>{balance.toLocaleString()}</strong> <span className="oxs-muted oxs-small">(gameplay only, local)</span></p>
      <h4 className="oxs-subtitle">Recent ledger</h4>
      <div className="oxs-ledger">
        {paperLedger.history().slice(0, 12).map((t) => (
          <div key={t.id} className="oxs-ledger-row">
            <span className={t.delta >= 0 ? "oxs-pos" : "oxs-neg"}>
              {t.delta >= 0 ? "+" : ""}{t.delta}
            </span>
            <span className="oxs-small">{t.reason}</span>
          </div>
        ))}
        {paperLedger.history().length === 0 && <p className="oxs-muted oxs-small">No transactions yet.</p>}
      </div>
    </div>
  );
}
