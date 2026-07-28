import Link from 'next/link';
import { ArrowLeft, ArrowRight, FileText } from 'lucide-react';

export const metadata = { title: 'Whitepaper — OrbitX' };

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl font-extrabold text-white mt-12 mb-3">{children}</h2>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="font-bold text-white mt-6 mb-1.5">{children}</h3>;
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-slate-300 leading-relaxed mb-4">{children}</p>;
}

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8"><ArrowLeft size={14} /> Back home</Link>

      <div className="flex items-center gap-2 text-xs text-purple font-semibold mb-3"><FileText size={14} /> Whitepaper</div>
      <h1 className="font-display text-4xl font-extrabold mb-2">OrbitX <span className="gradient-text">Whitepaper</span></h1>
      <p className="text-slate-400 text-sm mb-2">The prediction-market protocol of the OrbitX ecosystem on Solana. Formerly SOLNO, now rebuilt as OrbitX Prediction Market.</p>

      <H>Introduction</H>
      <P>OrbitX Prediction Market is the prediction-market pillar of OrbitX (orbitx.world), the on-chain OS for Solana. The platform was previously known as SOLNO and has been rebuilt and rebranded under the OrbitX name. The peer-to-pool model, on-chain settlement, and manual-treasury payouts remain the same; only the brand and links have changed.</P>
      <P>OrbitX is a decentralized prediction market protocol built on the Solana blockchain. The platform enables users to create, participate in, and settle prediction markets through a transparent peer-to-pool model designed to remove many of the limitations found in traditional betting and prediction platforms.</P>
      <P>Most existing betting platforms operate through a centralized structure in which operators create markets, determine odds, manage liquidity, and profit from user activity. This model introduces conflicts of interest between participants and platform operators while limiting transparency regarding market mechanics and payout calculations.</P>
      <P>OrbitX was created with a different objective. Rather than positioning the platform as a counterparty to users, OrbitX serves as infrastructure that enables participants to engage directly with one another. Markets are formed by the community, liquidity is provided by participants, and rewards are distributed according to the outcome of each market.</P>
      <P>Built on Solana, OrbitX leverages high transaction throughput, low network costs, and rapid settlement speeds to create an efficient environment for prediction markets. The protocol is designed to support a broad range of market categories including cryptocurrency events, financial markets, sports, politics, entertainment, internet culture, and community-driven events.</P>
      <P>The long-term vision extends beyond prediction markets. OrbitX aims to become a comprehensive ecosystem for decentralized participation, incorporating prediction markets, peer-to-peer escrow services, community incentives, and advanced trading infrastructure within a unified platform.</P>

      <H>What is OrbitX</H>
      <P>OrbitX is a fully on-chain peer-to-pool prediction market platform that allows users to express views on future outcomes through transparent market participation.</P>
      <P>Participants may create markets around specific events and outcomes, while other users can join those markets by contributing liquidity to the outcome they believe will occur. Once a market reaches resolution, the pool is settled and rewards are distributed among successful participants according to the protocol&rsquo;s distribution model.</P>
      <P>Unlike traditional sportsbooks or betting platforms, OrbitX does not rely on market makers to establish odds and does not function as a bookmaker taking positions against users. Instead, participants interact directly within a shared pool structure where rewards are derived from collective market participation.</P>
      <P>This approach creates a system in which users compete against the collective opinion of other participants rather than against a centralized operator.</P>
      <P>The platform is designed around several core principles:</P>
      <Sub>Transparency</Sub>
      <P>All market activity occurs on-chain and can be independently verified. Market creation, participation, settlements, and distributions are visible through blockchain records.</P>
      <Sub>Accessibility</Sub>
      <P>Any user can create and participate in markets without requiring approval from centralized intermediaries.</P>
      <Sub>Community Ownership</Sub>
      <P>Markets are driven by users rather than platform operators. The community determines which events deserve attention and participation.</P>
      <Sub>Efficiency</Sub>
      <P>Through Solana&rsquo;s infrastructure, users benefit from rapid transaction processing and low operational costs.</P>
      <Sub>Fairness</Sub>
      <P>Market outcomes are determined according to predefined rules, while rewards are distributed through transparent mechanisms that do not depend on bookmaker-controlled odds.</P>

      <H>The Problem</H>
      <P>Prediction markets have historically demonstrated significant potential as mechanisms for aggregating information and forecasting future outcomes. Despite this potential, existing platforms face several challenges.</P>
      <P>Centralization remains one of the largest obstacles. Most platforms maintain complete control over market creation, liquidity management, odds calculation, and settlement procedures. Participants must trust operators to act fairly and transparently.</P>
      <P>Additionally, many betting platforms generate revenue through models that inherently place users and operators on opposite sides of the transaction. In such systems, participant losses contribute directly to operator profits.</P>
      <P>Traditional platforms also limit creativity by restricting the types of markets that can be created. Users often have little influence over available opportunities and must choose from options predetermined by the platform.</P>
      <P>These limitations reduce transparency, discourage innovation, and prevent communities from creating markets around events that matter most to them.</P>
      <P>OrbitX addresses these challenges through decentralized infrastructure that prioritizes transparency, community participation, and open market creation.</P>

      <H>Vision</H>
      <P>The vision of OrbitX is to become the leading decentralized prediction market ecosystem on Solana.</P>
      <P>The protocol seeks to establish an environment where individuals can create, participate in, and settle markets without reliance on centralized intermediaries. Through transparent infrastructure and community-driven participation, OrbitX aims to transform prediction markets into a more accessible and efficient form of digital coordination.</P>
      <P>Over time, the platform intends to expand beyond prediction markets and develop a broader ecosystem of decentralized financial tools and services.</P>
      <P>This includes community incentive systems, peer-to-peer escrow infrastructure for Solana-based assets, and a perpetual futures trading environment integrated directly into the OrbitX application.</P>
      <P>The objective is to create a unified platform where users can participate in prediction markets, facilitate secure peer-to-peer transactions, and access advanced trading tools through a seamless experience built entirely on Solana.</P>
      <P>Rather than becoming another standalone betting application, OrbitX aims to establish itself as foundational infrastructure for decentralized participation, forecasting, trading, and economic coordination.</P>

      <div className="mt-14 flex items-center gap-4 flex-wrap border-t border-white/10 pt-8">
        <Link href="/roadmap" className="btn-ghost">View the roadmap <ArrowRight size={15} /></Link>
        <Link href="/app" className="btn-primary">Enter the app <ArrowRight size={15} /></Link>
      </div>
    </div>
  );
}
