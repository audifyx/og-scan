import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OrbitX Prediction Market',
    short_name: 'OrbitX',
    description: 'On-chain peer-to-pool prediction markets on Solana. Pick a side. Stake SOL. Win the pool.',
    start_url: '/app',
    scope: '/',
    display: 'standalone',
    background_color: '#131826',
    theme_color: '#131826',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
