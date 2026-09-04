import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Back soon — OrbitX' };

const DEFAULT_MSG = 'Hello community, we are currently working on updating the platform. The site will be back soon.';

export default async function MaintenancePage() {
  let message = DEFAULT_MSG;
  try {
    const { data } = await supabaseAdmin.from('site_settings').select('message').eq('id', 1).maybeSingle();
    if (data?.message) message = data.message;
  } catch {}

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center text-center px-6 bg-[#0b0f1a]">
      <div className="max-w-lg">
        <img src="/orbitx-mark.png" alt="OrbitX" className="h-16 w-16 mx-auto mb-6" />
        <div className="inline-flex items-center gap-2 bg-cyan/10 border border-cyan/20 rounded-full px-4 py-1.5 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan" />
          </span>
          <span className="text-xs text-cyan font-semibold">Under maintenance</span>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold text-white leading-tight mb-4">We&rsquo;ll be right back</h1>
        <p className="text-slate-300 text-lg leading-relaxed">{message}</p>
        <p className="text-slate-500 text-sm mt-8">— The OrbitX Team</p>
        <a href="https://x.com/solnobet" target="_blank" rel="noopener noreferrer" className="inline-block mt-6 text-cyan text-sm font-semibold hover:underline">Follow @solnobet for updates</a>
      </div>
    </div>
  );
}
