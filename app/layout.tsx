import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Orbi Demo — Send XLM',
  description: 'A minimal dApp showing how to integrate Orbi Smart Wallet.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#020817] text-slate-100 antialiased`}>
        {children}
      </body>
    </html>
  );
}
