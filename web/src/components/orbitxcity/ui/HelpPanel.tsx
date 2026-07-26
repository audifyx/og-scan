import { Gamepad2, Keyboard, MessageSquare, MousePointer2, Smartphone } from "lucide-react";

const DESKTOP_CONTROLS = [
  ["WASD", "Move through city streets"],
  ["Mouse", "Look around"],
  ["E", "Interact with nearby prompts"],
  ["Shift", "Sprint"],
  ["Space", "Jump"],
  ["Enter", "Open world chat"],
  ["B", "Dance emote"],
  ["Esc", "Close panels"],
];

const MOBILE_TIPS = [
  "Turn on touch controls from Settings or the HUD gamepad button.",
  "Use the left joystick to move and drag the screen to look around.",
  "Tap E near prompts for shops, lobbies, voice, tokens, and portals.",
  "Use Lite graphics if your phone heats up or frames dip.",
];

export function HelpPanel() {
  return (
    <section className="oxc-help-panel">
      <div className="oxc-menu-section-head">
        <span className="oxc-kicker">Help</span>
        <h2>City controls</h2>
        <p>Move, chat, sprint, jump, and interact with OrbitX plazas on desktop or phone.</p>
      </div>

      <div className="oxc-help-grid">
        <div className="oxc-help-card">
          <div className="oxc-settings-title">
            <Keyboard className="h-4 w-4" /> Keyboard
          </div>
          <div className="oxc-control-list">
            {DESKTOP_CONTROLS.map(([key, label]) => (
              <div key={key} className="oxc-control-row">
                <kbd>{key}</kbd>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="oxc-help-card cyan">
          <div className="oxc-settings-title">
            <Smartphone className="h-4 w-4" /> Mobile touch
          </div>
          <ul className="oxc-menu-list">
            {MOBILE_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>

        <div className="oxc-help-card gold">
          <div className="oxc-settings-title">
            <MessageSquare className="h-4 w-4" /> Social flow
          </div>
          <p>Join a lobby, walk into the Social District, press Enter for chat, or open Voice from the HUD dock.</p>
        </div>

        <div className="oxc-help-card lime">
          <div className="oxc-settings-title">
            <MousePointer2 className="h-4 w-4" /> Quick start
          </div>
          <p>Start Game drops you into Main Lobby. Join Lobby lets you browse public rooms or create private password rooms.</p>
        </div>

        <div className="oxc-help-card cyan">
          <div className="oxc-settings-title">
            <Gamepad2 className="h-4 w-4" /> Gamepad-style taps
          </div>
          <p>Large menu buttons and HUD controls are tuned for thumbs first, then desktop.</p>
        </div>
      </div>
    </section>
  );
}
