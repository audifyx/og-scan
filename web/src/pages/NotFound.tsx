import { Link } from "react-router-dom";
import { Radar } from "lucide-react";

const NotFound = () => {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-og-ink px-4 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--og-lime)/0.16),transparent_32%),linear-gradient(transparent_0_96%,hsl(var(--og-cyan)/0.08)_97%)] bg-[length:100%_100%,100%_18px]" />
      <section className="relative max-w-md border border-og-grid bg-og-ink/80 p-6 text-center shadow-og">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center border border-og-lime bg-og-lime/10 text-og-lime">
          <Radar className="h-6 w-6" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.4em] text-og-cyan">signal lost</p>
        <h1 className="mt-2 font-display text-5xl font-bold text-og-gold text-glow-gold">404</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This route is off-chain. Jump back to the live ogscan.fun dashboard.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex border border-og-lime bg-og-lime px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-og-ink transition hover:bg-transparent hover:text-og-lime"
        >
          Return to scanner
        </Link>
      </section>
    </main>
  );
};

export default NotFound;
