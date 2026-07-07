import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";

const SLIDES: { title: string; body: string }[] = [
  {
    title: "Welcome to OG Scan",
    body: "Scan any token to get an instant on-chain read: OG holder detection, wallet intel, and risk signals in one place.",
  },
  {
    title: "Track wallets & PnL",
    body: "Follow smart-money wallets, review trade history, and pull deep PnL breakdowns — swaps, ATH market cap, liquidity, breakeven.",
  },
  {
    title: "AI analyst reports",
    body: "Generate a shareable AI-written report or PDF for any token or wallet, straight from your scan results.",
  },
  {
    title: "Build your watchlist",
    body: "Star tokens and wallets to keep them in your watchlist, and jump back into recent scans from your history any time.",
  },
];

/**
 * Purely additive first-run welcome tour. Mounted once at the app root;
 * renders nothing until a logged-in user with no `og-onboarding-seen-v1`
 * flag is present. Does not read or write any other app state.
 */
export function OnboardingTour() {
  const { open, dismiss } = useOnboardingTour();
  const [step, setStep] = useState(0);

  if (!open) return null;

  const isLast = step === SLIDES.length - 1;
  const slide = SLIDES[step];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{slide.title}</DialogTitle>
          <DialogDescription>{slide.body}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center gap-1.5 py-2">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={dismiss}>
            Skip
          </Button>
          <Button
            onClick={() => {
              if (isLast) {
                dismiss();
              } else {
                setStep((s) => s + 1);
              }
            }}
          >
            {isLast ? "Get started" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
