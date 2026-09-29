/**
 * OrbitXCity — Vehicles module: player garage / vehicle registry.
 *
 * Local title ledger: who owns what. The integrator wires this to the
 * economy module's paperWallet for paper prices and to the burn provider for
 * ORBITX purchases. Pink-slip duels (racing module) settle against this
 * registry's transfer function.
 */
import { vehicleDef } from "./data/catalog";
import type { PaperDelta, VehicleInstance } from "./types";

export interface PurchaseRequest {
  defId: string;
  nickname?: string;
}

export interface PurchaseResult {
  instance: VehicleInstance;
  /** Paper-CITY to charge the player's wallet (0 if ORBITX purchase). */
  paperCharge: number;
  /** ORBITX to burn via the burn provider (0 if paper purchase). */
  orbitxCharge: number;
  burnReason: string;
}

function uid(): string {
  return `veh-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Prices out a purchase; the integrator charges/burns and calls addOwned. */
export function pricePurchase(req: PurchaseRequest): PurchaseResult {
  const def = vehicleDef(req.defId);
  const paperCharge = def.paperPrice;
  const orbitxCharge = def.orbitxPrice;
  if (paperCharge <= 0 && orbitxCharge <= 0) {
    throw new Error(`Vehicle ${def.id} is not purchasable (fleet/rental only)`);
  }
  if (paperCharge > 0 && orbitxCharge > 0) {
    throw new Error(`Vehicle ${def.id} misconfigured: dual pricing`);
  }
  const instance: VehicleInstance = {
    uid: uid(),
    defId: def.id,
    nickname: req.nickname?.trim() || def.name,
    condition: "pristine",
    fuel: 1,
    mods: [],
    mileage: 0,
    impounded: false,
    acquiredAt: Date.now(),
  };
  return {
    instance,
    paperCharge,
    orbitxCharge,
    burnReason: `city:vehicles:dealership:${def.id}`,
  };
}

export class Garage {
  private owned = new Map<string, VehicleInstance>();

  addOwned(instance: VehicleInstance): void {
    this.owned.set(instance.uid, instance);
  }

  remove(uid: string): VehicleInstance | undefined {
    const v = this.owned.get(uid);
    if (v) this.owned.delete(uid);
    return v;
  }

  get(uid: string): VehicleInstance | undefined {
    return this.owned.get(uid);
  }

  list(): VehicleInstance[] {
    return [...this.owned.values()];
  }

  /** Pink-slip / trade settlement: transfers ownership record to a new holder. */
  transfer(uid: string, newOwnerLabel: string): VehicleInstance | undefined {
    const v = this.owned.get(uid);
    if (!v) return undefined;
    this.owned.delete(uid);
    return { ...v, nickname: `${v.nickname} → ${newOwnerLabel}` };
  }

  serialize(): VehicleInstance[] {
    return this.list();
  }

  restore(instances: VehicleInstance[]): void {
    this.owned = new Map(instances.map((v) => [v.uid, v]));
  }
}

/** Sell-back quote: 40% of paper price, 0 for ORBITX vehicles (soulbound). */
export function sellbackQuote(instance: VehicleInstance): PaperDelta {
  const def = vehicleDef(instance.defId);
  if (def.orbitxPrice > 0) {
    return { amount: 0, label: `ORBITX vehicles are soulbound — no sellback`, source: "vehicles:sellback" };
  }
  const wear = instance.condition === "pristine" ? 1 : instance.condition === "good" ? 0.8 : instance.condition === "worn" ? 0.55 : 0.25;
  const amount = Math.floor(def.paperPrice * 0.4 * wear);
  return { amount, label: `Sellback — ${instance.nickname}`, source: "vehicles:sellback" };
}
