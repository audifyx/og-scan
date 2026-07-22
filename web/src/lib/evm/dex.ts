/**
 * OrbitX Curve — graduation -> DEX migration (keyless).
 *
 * Drives contracts/evm/OrbitXCurveMigrator.sol: an ownerless, CREATE2-
 * deterministic contract (same address on every chain) that pulls a graduated
 * curve's raised native + reserved LP tokens and seeds a Uniswap-v2-style pool
 * via addLiquidityETH, burning the LP (liquidity locked). Set
 * VITE_ORBITX_CURVE_MIGRATOR to predictMigratorAddress() and bake it into the
 * curve factory so graduated tokens accept this migrator.
 *
 * Routers are supplied per chain from env (VITE_DEX_ROUTER_<chainId decimal>)
 * so no router address is hardcoded/guessed. See .env.example for the canonical
 * v2 routers to fill in per chain (verify before enabling).
 */
import {
  CREATE2_PROXY, predictCreate2Address, buildProxyDeployData, isProxyDeployed,
} from "./create2";
import { waitForReceipt, type Eip1193Provider } from "./wallet";

export const MIGRATOR_BYTECODE = "0x6080806040523461001b57600160005561062c90816100218239f35b600080fdfe60806040818152600480361015610021575b505050361561001f57600080fd5b005b600092833560e01c918263a79721fe1461006657505063c0a2526c146100475780610011565b346100625781600319360112610062576020905161dead8152f35b5080fd5b83853461059e57608036600319011261059e576001600160a01b039383358581169081900361059a5760249485359287841680940361059657604490606490600187540361056d5750600286558651637cd07e4760e01b81526020998a828681895afa91821561037b578892610535575b50309116036105035786516373e15bb960e11b815289818581885afa9081156104535787916104e6575b50156104b857841561048e57833b1561048a57865163318fc0d760e11b8152308482015286818a8183895af180156104535761045d575b5086516370a0823160e01b815230848201529289848a81885afa938415610453578794610420575b50479284151580610417575b156103e45788519463095ea7b360e01b958681528884820152818c8201528c8184818d8c5af1908115610329578a916103c7575b5015610397576104b0420194854211610385579060c48c6060938d51988994859363f305d71960e01b85528d8a86015284015286358784015288358984015261dead608484015260a48301528b5af1998a1561037b57889589958a9c610333575b508a51908152888482015289828201528c8184818d8c5af18015610329576102fc575b50478061026f575b8c8c8c60018d8d8d7f57aa04076c8e8e00f17b6f082eb7c65ec1aa90f07da036638ccfcb07dcae6cc860608f8f88519182528a8201528888820152a35551908152f35b8980808093335af13d156102f7573d67ffffffffffffffff81116102e5578a8e8d51926102a582601f19601f84011601856105a1565b83523d92013e5b156102b7578061022c565b895162461bcd60e51b81529283018c9052600d908301526c1c99599d5b990819985a5b1959609a1b90820152fd5b634e487b7160e01b8b5260418552828bfd5b6102ac565b61031b908d803d10610322575b61031381836105a1565b8101906105d9565b508c610224565b503d610309565b8b513d8c823e3d90fd5b96509a5093506060853d606011610373575b81610352606093836105a1565b8101031261036f57845193898c8701519601519495949a8d610201565b8780fd5b3d9150610345565b89513d8a823e3d90fd5b634e487b7160e01b8a52601184528b8afd5b50885162461bcd60e51b81529182018b9052600e828b01526d185c1c1c9bdd994819985a5b195960921b90820152fd5b6103de91508d803d106103225761031381836105a1565b8d6101a0565b885162461bcd60e51b81529182018b90526012828b0152716e6f7468696e6720746f206d69677261746560701b90820152fd5b5083151561016c565b9093508981813d831161044c575b61043881836105a1565b810103126104485751928a610160565b8680fd5b503d61042e565b88513d89823e3d90fd5b67ffffffffffffffff81979297116104785787529489610138565b634e487b7160e01b8252604184528882fd5b8580fd5b865162461bcd60e51b81528084018a90526009818a0152683737903937baba32b960b91b81840152fd5b865162461bcd60e51b81528084018a9052600d818a01526c1b9bdd0819dc98591d585d1959609a1b81840152fd5b6104fd91508a3d8c116103225761031381836105a1565b8a610101565b865162461bcd60e51b81528084018a90526011818a0152703737ba103a3434b99036b4b3b930ba37b960791b81840152fd5b9091508a81813d8311610566575b61054d81836105a1565b8101031261036f5751818116810361036f57908b6100d7565b503d610543565b62461bcd60e51b8152602081850152600a818a0152697265656e7472616e637960b01b81840152fd5b8480fd5b8280fd5b80fd5b90601f8019910116810190811067ffffffffffffffff8211176105c357604052565b634e487b7160e01b600052604160045260246000fd5b908160209103126105f1575180151581036105f15790565b600080fdfea26469706673582212201e1f4092c9cbee73ed27ff04bdef895c346654eee507af72e2b40b4e1ca28af164736f6c63430008180033";
export const MIGRATOR_SALT = "0x" + "00".repeat(31) + "02";
const MIGRATE_SELECTOR = "a79721fe"; // migrate(address,address,uint256,uint256)

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};

function u256(v: bigint): string { return v.toString(16).padStart(64, "0"); }
function addr(a: string): string {
  const h = a.replace(/^0x/, "").toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(h)) throw new Error(`bad address: ${a}`);
  return h.padStart(64, "0");
}

/** Deterministic migrator address (same on every chain — no constructor args). */
export function predictMigratorAddress(): string {
  return predictCreate2Address(MIGRATOR_SALT, MIGRATOR_BYTECODE);
}

/** Router for a chain, from env VITE_DEX_ROUTER_<chainId decimal>. "" if unset. */
export function getRouter(chainIdDecimal: number): string {
  return (env[`VITE_DEX_ROUTER_${chainIdDecimal}`] ?? "").trim();
}

async function codeExists(provider: Eip1193Provider, address: string): Promise<boolean> {
  const code = (await provider.request({ method: "eth_getCode", params: [address, "latest"] })) as string;
  return typeof code === "string" && code.length > 2;
}

/** Deploy the shared migrator on this chain if absent (keyless via CREATE2 proxy). */
export async function ensureMigrator(provider: Eip1193Provider, from: string): Promise<{ migrator: string; deployed: boolean }> {
  const migrator = predictMigratorAddress();
  if (await codeExists(provider, migrator)) return { migrator, deployed: false };
  if (!(await isProxyDeployed(provider).catch(() => false))) {
    throw new Error("CREATE2 proxy not present on this chain — migrator can't be deployed keyless here");
  }
  const data = buildProxyDeployData(MIGRATOR_SALT, MIGRATOR_BYTECODE);
  const hash = (await provider.request({ method: "eth_sendTransaction", params: [{ from, to: CREATE2_PROXY, data }] })) as string;
  await waitForReceipt(provider, hash);
  if (!(await codeExists(provider, migrator))) throw new Error("Migrator deploy confirmed but no code at predicted address");
  return { migrator, deployed: true };
}

export function encodeMigrate(token: string, router: string, minTokenLP = 0n, minEthLP = 0n): string {
  return "0x" + MIGRATE_SELECTOR + addr(token) + addr(router) + u256(minTokenLP) + u256(minEthLP);
}

export interface MigrateResult { txHash: string; migrator: string; router: string }

/** Seed a v2 pool from a graduated curve. Ensures the migrator, then calls migrate(). */
export async function migrateCurve(
  provider: Eip1193Provider, from: string, token: string, chainIdDecimal: number,
): Promise<MigrateResult> {
  const router = getRouter(chainIdDecimal);
  if (!router) throw new Error(`No DEX router configured for chain ${chainIdDecimal} (set VITE_DEX_ROUTER_${chainIdDecimal})`);
  const { migrator } = await ensureMigrator(provider, from);
  const hash = (await provider.request({
    method: "eth_sendTransaction",
    params: [{ from, to: migrator, data: encodeMigrate(token, router) }],
  })) as string;
  const receipt = await waitForReceipt(provider, hash);
  if (receipt.status !== "0x1") throw new Error("Migration reverted — check the tx in the explorer");
  return { txHash: hash, migrator, router };
}
