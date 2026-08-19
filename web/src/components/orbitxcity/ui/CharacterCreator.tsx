import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import type {
  AvatarAppearance,
  FaceStyle,
  HairStyle,
  OutfitStyle,
} from "@/lib/orbitxcity/types";
import { SHOP_HAIR, SHOP_OUTFITS, getShopItem } from "@/lib/orbitxcity/cityShop";
import { useCity } from "@/pages/orbitxcity/CityProvider";

const BODY_PRESETS = ["#1a2438", "#2a1f3d", "#1e4436", "#3d2a1e", "#1a3040", "#3a1f28"];
const SKIN_PRESETS = ["#e8d5c0", "#c9a07a", "#8d5524", "#f0d5b8", "#5c3a21", "#ffdbac"];
const ACCENT_PRESETS = ["#17ff4d", "#3de7ff", "#f5c542", "#ff4d9a", "#ff6b35", "#8cffd2"];
const HAIR_PRESETS = ["#101014", "#3a2318", "#f5c542", "#d9d0c3", "#17ff4d", "#3de7ff"];
const FACE_STYLES: FaceStyle[] = ["neutral", "cool", "smile"];

const AVATAR_FALLBACK: AvatarAppearance = {
  name: "Traveler",
  bodyColor: "#1a2438",
  accentColor: "#17ff4d",
  skinColor: "#e8d5c0",
  hairStyle: "short",
  hairColor: "#101014",
  outfit: "street",
  faceStyle: "cool",
};

function completeAvatar(avatar: AvatarAppearance): AvatarAppearance {
  return { ...AVATAR_FALLBACK, ...avatar };
}

function optionLabel(value: string): string {
  return value.replace(/_/g, " ");
}

export function CharacterCreator({ onDone }: { onDone?: () => void }) {
  const { avatar, setAvatar, shopPurchases } = useCity();
  const { profile } = useAuth();
  const HAIR_STYLES: HairStyle[] = useMemo(() => {
    const owned = new Set(
      shopPurchases.map((p) => getShopItem(p.itemId)?.appearance?.hairStyle).filter(Boolean),
    );
    return SHOP_HAIR.filter((h) => h === "short" || h === "long" || h === "buzz" || h === "bun" || h === "mohawk" || owned.has(h));
  }, [shopPurchases]);
  const OUTFITS: OutfitStyle[] = useMemo(() => {
    const owned = new Set(
      shopPurchases.map((p) => getShopItem(p.itemId)?.appearance?.outfit).filter(Boolean),
    );
    return SHOP_OUTFITS.filter(
      (o) => o === "street" || o === "suit" || o === "sport" || o === "neon" || owned.has(o),
    );
  }, [shopPurchases]);
  const [draft, setDraft] = useState<AvatarAppearance>(() =>
    completeAvatar({ ...avatar, name: avatar.name || profile?.username || AVATAR_FALLBACK.name }),
  );

  const previewStyle = useMemo(
    () => ({
      ["--skin" as string]: draft.skinColor,
      ["--body" as string]: draft.bodyColor,
      ["--accent" as string]: draft.accentColor,
      ["--hair" as string]: draft.hairColor,
    }),
    [draft],
  );

  const update = <K extends keyof AvatarAppearance>(key: K, value: AvatarAppearance[K]) => {
    const next = completeAvatar({ ...draft, [key]: value });
    setDraft(next);
    setAvatar(next);
  };

  return (
    <section className="oxc-character">
      <div className="oxc-menu-section-head">
        <span className="oxc-kicker">Character creator</span>
        <h2>Sims-style city identity</h2>
        <p>Tune your look before you hit the plaza. Changes update your local avatar preview immediately.</p>
      </div>

      <div className="oxc-character-layout">
        <div className="oxc-character-preview" style={previewStyle}>
          <div className={`oxc-character-doll hair-${draft.hairStyle} outfit-${draft.outfit} face-${draft.faceStyle}`}>
            <div className="oxc-char-hair" />
            <div className="oxc-char-head">
              <span className="oxc-char-eye left" />
              <span className="oxc-char-eye right" />
              <span className="oxc-char-mouth" />
            </div>
            <div className="oxc-char-neck" />
            <div className="oxc-char-body">
              <span className="oxc-char-jacket" />
            </div>
            <div className="oxc-char-arm left" />
            <div className="oxc-char-arm right" />
            <div className="oxc-char-leg left" />
            <div className="oxc-char-leg right" />
          </div>
          <div className="oxc-character-name">@{draft.name.trim() || "traveler"}</div>
          <div className="oxc-character-tags">
            <span>{draft.hairStyle} hair</span>
            <span>{draft.outfit}</span>
            <span>{draft.faceStyle}</span>
          </div>
        </div>

        <div className="oxc-character-controls">
          <label className="oxc-menu-field">
            <span>Name</span>
            <input
              value={draft.name}
              onChange={(e) => update("name", e.target.value.slice(0, 24))}
              maxLength={24}
              placeholder="Traveler"
            />
          </label>

          <ColorGroup label="Skin" value={draft.skinColor} presets={SKIN_PRESETS} onChange={(color) => update("skinColor", color)} />
          <ColorGroup label="Body" value={draft.bodyColor} presets={BODY_PRESETS} onChange={(color) => update("bodyColor", color)} />
          <ColorGroup label="Neon accent" value={draft.accentColor} presets={ACCENT_PRESETS} onChange={(color) => update("accentColor", color)} />
          <ColorGroup label="Hair color" value={draft.hairColor} presets={HAIR_PRESETS} onChange={(color) => update("hairColor", color)} />

          <OptionGroup<HairStyle>
            label="Hair style"
            value={draft.hairStyle}
            options={HAIR_STYLES}
            onChange={(value) => update("hairStyle", value)}
          />
          <OptionGroup<OutfitStyle>
            label="Outfit"
            value={draft.outfit}
            options={OUTFITS}
            onChange={(value) => update("outfit", value)}
          />
          <OptionGroup<FaceStyle>
            label="Face"
            value={draft.faceStyle}
            options={FACE_STYLES}
            onChange={(value) => update("faceStyle", value)}
          />

          {onDone && (
            <button type="button" className="oxc-btn primary oxc-menu-wide" onClick={onDone}>
              Save character
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ColorGroup({
  label,
  value,
  presets,
  onChange,
}: {
  label: string;
  value: string;
  presets: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="oxc-menu-control">
      <span>{label}</span>
      <div className="oxc-menu-swatches">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            className={value === color ? "on" : ""}
            style={{ background: color }}
            onClick={() => onChange(color)}
            aria-label={`${label} ${color}`}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label} custom color`} />
      </div>
    </div>
  );
}

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="oxc-menu-control">
      <span>{label}</span>
      <div className="oxc-menu-segmented">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={value === option ? "on" : ""}
            onClick={() => onChange(option)}
          >
            {optionLabel(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
