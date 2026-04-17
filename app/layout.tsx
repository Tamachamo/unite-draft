import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unite Draft Analyzer",
  description: "Pokemon Unite Draft Tool synced with Google Sheets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
