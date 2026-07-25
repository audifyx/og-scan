import { ITEMS, getItem } from "../../catalogs/classesItems";
import { buyWithShards, consumeItem } from "../../systems/economy";
import { useGameProfile } from "../../state/useGameProfile";
import { pushNotification } from "../../state/GameProfileStore";

export function PlayInventoryPage() {
  const { profile, updateProfile } = useGameProfile();
  const shop = ITEMS.filter((i) => typeof i.priceShards === "number");

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div>
        <div className="gx-kicker">Player economy</div>
        <h1 className="gx-title" style={{ fontSize: "1.7rem" }}>
          Gear & shards
        </h1>
        <p className="gx-lead">
          Soft-currency loops and digital item ownership (cosmetics, keys, emotes). Not crypto trading.
        </p>
      </div>

      <div className="gx-panel">
        <div className="gx-stat">
          <span>Wallet · shards</span>
          <span>{profile.progression.shards}</span>
        </div>
      </div>

      <div className="gx-panel">
        <div className="gx-kicker">Inventory</div>
        <div className="gx-list" style={{ marginTop: "0.65rem" }}>
          {profile.inventory.map((s) => {
            const def = getItem(s.itemId);
            return (
              <div key={s.itemId} className="gx-row">
                <div>
                  <strong style={{ fontFamily: "var(--gx-display)", fontSize: "0.8rem" }}>{def?.name ?? s.itemId}</strong>
                  <div style={{ color: "var(--gx-muted)", fontSize: "0.75rem" }}>
                    {def?.kind} · x{s.qty} {s.equippedSlot ? `· equipped ${s.equippedSlot}` : ""}
                  </div>
                </div>
                {def?.kind === "consumable" && (
                  <button
                    type="button"
                    className="gx-btn gx-btn-primary"
                    style={{ padding: "0.35rem 0.7rem" }}
                    onClick={() =>
                      updateProfile((p) => {
                        const res = consumeItem(p, s.itemId);
                        if (res.ok) pushNotification({ kind: "reward", title: "Item used", body: def.name });
                        return res.profile;
                      })
                    }
                  >
                    Use
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="gx-panel">
        <div className="gx-kicker">Shard shop</div>
        <div className="gx-grid gx-grid-3" style={{ marginTop: "0.65rem" }}>
          {shop.map((item) => (
            <button
              key={item.id}
              type="button"
              className="gx-card"
              onClick={() =>
                updateProfile((p) => {
                  const res = buyWithShards(p, item.id);
                  if (res.ok) pushNotification({ kind: "reward", title: "Purchased", body: item.name });
                  return res.profile;
                })
              }
            >
              <strong>{item.name}</strong>
              <span>{item.rarity} · {item.priceShards} shards</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
