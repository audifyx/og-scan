import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
export const metadata = { title: 'Privacy Policy - OrbitX' };

const S = ({ n, t, children }: any) => (
  <section className="space-y-2"><h2 className="font-bold text-white text-lg">{n}. {t}</h2><div className="text-sm text-slate-400 leading-relaxed space-y-2">{children}</div></section>
);

export default function Privacy() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-16">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-8"><ArrowLeft size={14}/> Back home</Link>
      <h1 className="font-display text-4xl font-extrabold mb-2">Privacy Policy</h1>
      <p className="text-slate-500 text-sm mb-10">Last updated: June 14, 2026</p>
      <div className="glass-card rounded-2xl p-7 space-y-7">
        <S n="1" t="Information we collect">We collect: (a) your Solana wallet address and on-chain transaction signatures; (b) account details if you create one, such as username, email, and password (stored hashed); (c) gameplay and financial records such as games, bets, balances, and withdrawal requests; and (d) technical data such as IP address, device, and usage logs. Data recorded on the Solana blockchain is public by design. We do not require or collect government-issued identity documents (no KYC).</S>
        <S n="2" t="How we use information">We use information to operate the games, verify on-chain deposits, maintain balances, process and review withdrawals, prevent fraud and money laundering, comply with legal obligations, provide support, and improve the Platform.</S>
        <S n="3" t="Where data is stored">Account and gameplay data is stored in our database (PostgreSQL via Supabase) and our hosting provider (Vercel). On-chain data resides permanently on the Solana blockchain and is outside our control.</S>
        <S n="4" t="Sharing">We do not sell your personal information. We share data only with service providers that help us run the Platform (such as hosting, database, and RPC providers), and where required by law, regulation, or to investigate fraud or abuse.</S>
        <S n="5" t="Cookies and local storage">We use cookies and browser local storage for authentication sessions and to remember your acceptance of our age and terms gate. You can clear these through your browser, but parts of the Platform may stop working.</S>
        <S n="6" t="Security">We take reasonable measures to protect your data. However, no method of transmission or storage is fully secure, and you are responsible for the security of your own wallet and credentials.</S>
        <S n="7" t="Your rights">Depending on your jurisdiction, you may have rights to access, correct, or delete your personal data. To make a request, contact us through the official channels listed on the site. We may need to confirm the request genuinely comes from you (for example, via a signed message from your wallet).</S>
        <S n="8" t="Children">The Platform is strictly for adults (18+ or the age of majority where you live). We do not knowingly collect data from minors.</S>
        <S n="9" t="Changes">We may update this Policy from time to time. Material changes take effect when posted, indicated by the Last updated date.</S>
        <S n="10" t="Contact">Questions about this Policy can be directed to the operator through the official channels listed on the site.</S>
      </div>
    </div>
  );
}
