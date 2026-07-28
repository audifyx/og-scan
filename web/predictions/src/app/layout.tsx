import type { Metadata, Viewport } from 'next'
import { Inter, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { WalletContextProvider } from '@/components/WalletContextProvider'
import { PWA } from '@/components/PWA'
import { SupportWidget } from '@/components/SupportWidget'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' })
const grotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500','600','700'], variable: '--font-display', display: 'swap' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' })

export const metadata: Metadata = {
  title: 'OrbitX Prediction Market — Pick a side. Stake SOL. Win the pool.',
  description: 'OrbitX Prediction Market (orbitx.world) — on-chain, peer-to-pool prediction markets on Solana. Trade real-world outcomes across crypto, sports, politics, entertainment and more. No house, no hidden odds, fully on-chain settlement.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'OrbitX', statusBarStyle: 'black-translucent' },
  metadataBase: new URL('https://orbitx.world'),
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  openGraph: { title: 'OrbitX Prediction Market', description: 'On-chain peer-to-pool prediction markets on Solana. Pick a side. Stake SOL. Win the pool.', url: 'https://orbitx.world', siteName: 'OrbitX Prediction Market', images: ['/orbitx-banner.jpg'], type: 'website' },
  twitter: { card: 'summary_large_image', title: 'OrbitX Prediction Market', description: 'On-chain peer-to-pool prediction markets on Solana. Pick a side. Stake SOL. Win the pool.', images: ['/orbitx-banner.jpg'] },
}

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable} ${mono.variable}`}>
      <body className="text-white antialiased">
        <PWA />
        <WalletContextProvider>
          {children}
          <SupportWidget />
        </WalletContextProvider>
      </body>
    </html>
  )
}
