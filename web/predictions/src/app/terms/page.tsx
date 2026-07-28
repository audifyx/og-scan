import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
export const metadata = { title: 'Terms of Service - OrbitX' };

const S = ({ n, t, children }: any) => (
  <section className="space-y-2"><h2 className="font-bold text-white text-lg">{n}. {t}</h2><div className="text-sm text-slate-400 leading-relaxed space-y-2">{children}</div></section>
);

export default function Terms() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8"><ArrowLeft size={14}/> Back home</Link>
      <h1 className="font-display text-4xl font-extrabold mb-2">Terms of Service</h1>
      <p className="text-slate-500 text-sm mb-6">Last updated: June 14, 2026</p>
      <div className="flex items-start gap-3 bg-cyan/10 border border-cyan/20 rounded-xl p-4 mb-8 text-sm text-slate-300">
        <Sparkles size={18} className="text-cyan shrink-0 mt-0.5" />
        <p><b className="text-white">Experimental on-chain crypto entertainment.</b> OrbitX is peer-to-peer software on Solana. You interact directly with other users using SOL and may lose what you stake. Use it at your own risk. By using OrbitX you agree to these Terms.</p>
      </div>
      <div className="glass-card rounded-2xl p-7 space-y-7">
        <S n="1" t="Acceptance of terms">By accessing or using OrbitX (the "Platform", "we", "us") you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the Platform.</S>
        <S n="2" t="What OrbitX is">OrbitX is experimental, peer-to-peer entertainment software running on the Solana blockchain. Users create and join on-chain games and markets directly with one another using SOL. In its risk profile it is comparable to other on-chain crypto activity such as trading tokens or memecoins. OrbitX is software only. It is not a bank, broker, exchange, money transmitter, investment product, or counterparty to your activity, and it does not hold itself out as a licensed financial or gaming operator.</S>
        <S n="3" t="Not financial or investment advice">Nothing on the Platform is financial, investment, legal, or tax advice, and nothing offered is a security or investment product. Activity on the Platform is for entertainment. Any value you transfer is at your own discretion and risk.</S>
        <S n="4" t="Eligibility">You should be an adult (18 or older, or the age of majority where you live) and have the capacity to agree to these Terms. Eligibility is self-declared at sign-up. We do not collect identity documents and there is no KYC.</S>
        <S n="5" t="Your responsibility for local laws">Laws affecting crypto and online activity vary widely. You are solely responsible for knowing and complying with the laws that apply to you. If using the Platform is not permitted where you are, do not use it. You use OrbitX at your own risk and on your own initiative.</S>
        <S n="6" t="Wallets, SOL transfers and on-chain finality">You transfer SOL from a wallet you control. All blockchain transactions are final and irreversible. You are solely responsible for your wallet, your keys, and the accuracy of every transaction. We are not responsible for funds sent in error, failed transactions, or losses caused by your wallet, RPC providers, or the Solana network.</S>
        <S n="7" t="Balances and withdrawals">Your on-Platform balance is a record of amounts credited to you from winnings or refunds. To receive SOL you submit a withdrawal request with a destination wallet. Payouts are reviewed and sent manually by our team. We aim to send most withdrawals within 5 hours and, barring exceptional circumstances, within 24 hours. We may delay or decline a payout where we reasonably suspect fraud, abuse, error, or a breach of these Terms.</S>
        <S n="8" t="Fees">A small platform fee (rake) applies to activity, such as a percentage of a game pot, as shown in the app. Fees are non-refundable except where an entire stake is refunded (for example, a cancelled match).</S>
        <S n="9" t="Provably fair">Game outcomes use a commit-and-reveal scheme: a hashed server seed is committed before a round and revealed on resolution so results can be independently verified. You accept the inherent randomness of the games.</S>
        <S n="10" t="Finality and no refunds">All activity and outcomes are final. There are no chargebacks. If a pooled bet resolves with no winning participants (everyone loses), each participant is returned 65% of their stake and the platform retains the remainder. Other refunds are issued only at our discretion, for example a cancelled match or a clear technical error.</S>
        <S n="11" t="Fraud and abuse prevention">There is no KYC. We do monitor for fraud, collusion, bot or script use, multi-accounting, and exploiting bugs, and may investigate, void activity, freeze balances, or decline a payout where we reasonably detect such behavior or a breach of these Terms.</S>
        <S n="12" t="Risk disclosure">You may lose the entire amount you stake. SOL and other crypto assets are volatile. The Platform is experimental software and may contain bugs or downtime. Blockchain networks, RPC endpoints, and third-party wallets can fail or be exploited. Only use funds you can afford to lose.</S>
        <S n="13" t="Play responsibly">OrbitX is for entertainment, not income. Only stake what you can comfortably afford to lose, and stop if it stops being fun. If you feel your usage is becoming a problem, take a break or seek support in your area.</S>
        <S n="14" t="Suspension and termination">We may suspend, restrict, or terminate access at any time, with or without notice, including for suspected breach of these Terms.</S>
        <S n="15" t="No warranties">The Platform is provided on an as-is and as-available basis without warranties of any kind, express or implied. We do not warrant uninterrupted or error-free operation, the accuracy of data, or the security of third-party services or the Solana network.</S>
        <S n="16" t="Limitation of liability">To the maximum extent permitted by law, OrbitX and its operators are not liable for any indirect, incidental, special, or consequential damages, or for any loss of funds, profits, or data, arising from your use of the Platform, blockchain or network failures, wallet errors, or your own decisions. Your use of the Platform is at your sole risk.</S>
        <S n="17" t="Indemnification">You agree to indemnify and hold harmless OrbitX and its operators from any claims, losses, liabilities, and expenses arising out of your use of the Platform, your breach of these Terms, or your violation of any law or third-party right.</S>
        <S n="18" t="Privacy">Your use of the Platform is also governed by our Privacy Policy, which explains what limited information we handle and how.</S>
        <S n="19" t="Changes">We may update these Terms at any time. Material changes take effect when posted, indicated by the Last updated date. Continued use after changes constitutes acceptance.</S>
        <S n="20" t="Disputes">If a dispute arises, we encourage you to contact us first so we can try to resolve it informally. OrbitX is provided as peer-to-peer software on a best-effort basis and does not submit itself to any particular financial or gaming regulator.</S>
        <S n="21" t="Contact">Questions about these Terms can be directed to the operator through the official channels listed on the site.</S>
        <p className="text-xs text-slate-600 border-t border-white/10 pt-5">OrbitX is experimental, peer-to-peer crypto software for entertainment. It is not a regulated financial product or gambling service, and nothing here is legal advice.</p>
      </div>
    </div>
  );
}
