import { TransactionButton } from "./TransactionButton";
import type { AttestKind } from "@/lib/orbitx/onchainAttest";

export function RewardClaimButton({
  payload,
  label = "Claim on-chain",
  disabled,
  onConfirmed,
}: {
  payload: Record<string, unknown>;
  label?: string;
  disabled?: boolean;
  onConfirmed?: (sig: string, hash: string) => void;
}) {
  const kind: AttestKind = "reward";
  return (
    <TransactionButton
      kind={kind}
      payload={payload}
      label={label}
      disabled={disabled}
      onConfirmed={onConfirmed}
    />
  );
}
