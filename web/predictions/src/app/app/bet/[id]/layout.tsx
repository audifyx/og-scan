import type { Metadata } from 'next';

const SB = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const r = await fetch(`${SB}/rest/v1/bets?id=eq.${params.id}&select=title,description,image_url`, {
      headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` }, cache: 'no-store',
    });
    const rows = await r.json();
    const bet = rows?.[0];
    if (bet) {
      const desc = (bet.description || bet.title || '').slice(0, 160);
      const images = bet.image_url ? [bet.image_url] : [];
      return {
        title: `${bet.title} — OrbitX`,
        description: desc,
        openGraph: { title: bet.title, description: desc, images, type: 'website' },
        twitter: { card: 'summary_large_image', title: bet.title, description: desc, images },
      };
    }
  } catch {}
  return { title: 'Bet — OrbitX' };
}

export default function BetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
