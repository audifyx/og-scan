import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles } from "lucide-react";

/** Scroll-reveal wrapper: fades/slides content in as it enters viewport. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVis(true); io.disconnect(); } },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: vis ? 1 : 0,
        transform: vis ? "translateY(0)" : "translateY(36px)",
        transition: `opacity 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms, transform 0.8s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/** Rotating word carousel. */
export function RotatingWords({ words, className = "" }: { words: string[]; className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % words.length), 2400);
    return () => clearInterval(t);
  }, [words.length]);
  return (
    <span className={`rot-words ${className}`}>
      <span key={i} className="rot-words__word">{words[i]}</span>
      <style>{`
        .rot-words { display: inline-block; position: relative; }
        .rot-words__word {
          display: inline-block;
          background: linear-gradient(135deg, #5aa2ff, #f0c75e);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: rotIn 0.6s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes rotIn {
          from { opacity: 0; transform: translateY(18px) rotateX(40deg); }
          to { opacity: 1; transform: translateY(0) rotateX(0); }
        }
      `}</style>
    </span>
  );
}

/** Marquee sliding text band. */
export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items, ...items];
  return (
    <div className="premium-marquee">
      <div className="premium-marquee__track">
        {row.map((t, i) => (
          <span key={i} className="premium-marquee__item">
            <Sparkles size={14} /> {t}
          </span>
        ))}
      </div>
      <style>{`
        .premium-marquee {
          overflow: hidden;
          border-top: 1px solid rgba(255,255,255,0.08);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
          padding: 14px 0;
          margin: 48px 0;
        }
        .premium-marquee__track {
          display: flex;
          gap: 48px;
          width: max-content;
          animation: marquee 28s linear infinite;
        }
        .premium-marquee__item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          white-space: nowrap;
        }
        .premium-marquee__item svg { color: #f0c75e; }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}

interface Props {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
  rotatingWords: string[];
  marqueeItems: string[];
  children: ReactNode;
}

/** Premium document page shell: hero banner, rotating headline, marquee, scroll reveals. */
export default function PremiumDocPage({ eyebrow, title, subtitle, rotatingWords, marqueeItems, children }: Props) {
  return (
    <div className="premium-doc">
      {/* Hero banner */}
      <div className="premium-doc__hero">
        <div className="premium-doc__hero-bg" />
        <div className="premium-doc__hero-grid" />
        <Link to="/" className="premium-doc__back">
          <ArrowLeft size={16} /> Back to OrbitX
        </Link>
        <div className="premium-doc__hero-inner">
          <Reveal>
            <div className="premium-doc__eyebrow">{eyebrow}</div>
          </Reveal>
          <Reveal delay={100}>
            <h1 className="premium-doc__title">{title}</h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="premium-doc__rot">
              Built for <RotatingWords words={rotatingWords} />
            </p>
          </Reveal>
          <Reveal delay={300}>
            <p className="premium-doc__subtitle">{subtitle}</p>
          </Reveal>
        </div>
        <div className="premium-doc__scroll-hint">
          <span /> Scroll
        </div>
      </div>

      <Marquee items={marqueeItems} />

      <div className="premium-doc__body">
        {children}
      </div>

      <style>{`
        .premium-doc { background: #000; color: #fff; min-height: 100vh; }
        .premium-doc__hero {
          position: relative;
          min-height: 72vh;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 80px 24px 60px;
        }
        .premium-doc__hero-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(60% 50% at 20% 20%, rgba(59,130,246,0.22), transparent 60%),
            radial-gradient(50% 45% at 85% 75%, rgba(240,199,94,0.14), transparent 60%),
            radial-gradient(40% 40% at 60% 40%, rgba(90,162,255,0.1), transparent 60%),
            #000;
          animation: heroDrift 14s ease-in-out infinite alternate;
        }
        @keyframes heroDrift {
          from { transform: scale(1) translate(0,0); }
          to { transform: scale(1.12) translate(-2%, 2%); }
        }
        .premium-doc__hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 56px 56px;
          mask-image: radial-gradient(70% 70% at 50% 45%, #000 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(70% 70% at 50% 45%, #000 30%, transparent 75%);
        }
        .premium-doc__back {
          position: absolute;
          top: 24px;
          left: 24px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 999px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.75);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          z-index: 2;
          transition: background 0.2s;
        }
        .premium-doc__back:hover { background: rgba(255,255,255,0.12); color: #fff; }
        .premium-doc__hero-inner {
          position: relative;
          z-index: 1;
          text-align: center;
          max-width: 860px;
        }
        .premium-doc__eyebrow {
          display: inline-block;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: #5aa2ff;
          padding: 8px 20px;
          border: 1px solid rgba(90,162,255,0.35);
          border-radius: 999px;
          background: rgba(59,130,246,0.1);
          margin-bottom: 28px;
        }
        .premium-doc__title {
          font-size: clamp(44px, 8vw, 88px);
          font-weight: 900;
          letter-spacing: -0.03em;
          line-height: 1.02;
          margin: 0 0 20px;
          background: linear-gradient(180deg, #fff 30%, rgba(255,255,255,0.55));
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .premium-doc__rot {
          font-size: clamp(18px, 3vw, 26px);
          font-weight: 600;
          color: rgba(255,255,255,0.65);
          margin: 0 0 18px;
        }
        .premium-doc__subtitle {
          font-size: 16px;
          line-height: 1.7;
          color: rgba(255,255,255,0.5);
          max-width: 620px;
          margin: 0 auto;
        }
        .premium-doc__scroll-hint {
          position: absolute;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          z-index: 1;
        }
        .premium-doc__scroll-hint span {
          width: 22px;
          height: 36px;
          border: 2px solid rgba(255,255,255,0.25);
          border-radius: 12px;
          position: relative;
        }
        .premium-doc__scroll-hint span::after {
          content: "";
          position: absolute;
          top: 7px;
          left: 50%;
          width: 4px;
          height: 8px;
          margin-left: -2px;
          border-radius: 2px;
          background: #5aa2ff;
          animation: scrollDot 1.8s ease-in-out infinite;
        }
        @keyframes scrollDot {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(12px); opacity: 0.3; }
        }
        .premium-doc__body {
          max-width: 780px;
          margin: 0 auto;
          padding: 20px 24px 120px;
        }
        .premium-section {
          background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015));
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 22px;
          padding: 32px 32px;
          margin-bottom: 22px;
          position: relative;
          overflow: hidden;
          transition: border-color 0.25s, transform 0.25s;
        }
        .premium-section:hover {
          border-color: rgba(90,162,255,0.35);
          transform: translateY(-2px);
        }
        .premium-section::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(90,162,255,0.5), transparent);
        }
        .premium-section__num {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.2em;
          color: #f0c75e;
          margin-bottom: 10px;
        }
        .premium-section__title {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.01em;
          margin: 0 0 14px;
          color: #fff;
        }
        .premium-section__body {
          font-size: 15.5px;
          line-height: 1.75;
          color: rgba(255,255,255,0.68);
        }
        .premium-section__body p { margin: 0 0 12px; }
        .premium-section__body p:last-child { margin-bottom: 0; }
        .premium-section__body ul { margin: 12px 0; padding-left: 20px; }
        .premium-section__body li { margin-bottom: 8px; }
        @media (max-width: 640px) {
          .premium-doc__hero { min-height: 62vh; padding: 70px 20px 50px; }
          .premium-section { padding: 24px 22px; }
        }
      `}</style>
    </div>
  );
}
