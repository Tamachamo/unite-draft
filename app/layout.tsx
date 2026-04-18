import type { Metadata } from 'next'
import './globals.css' // Tailwindの読み込み

export const metadata: Metadata = {
  title: 'UNITE DRAFT ANALYZER',
  description: 'Pokémon UNITE Draft Supporter Tool with AI Analysis',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="bg-slate-900 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  )
}
