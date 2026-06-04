'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { orbi } from '../../lib/orbi';

export default function OrbiCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    orbi.handleCallback()
      .then((wallet) => {
        if (!wallet) { router.replace('/'); return; }
        localStorage.setItem('walletAddress', wallet.walletAddress);
        router.replace('/dashboard');
      })
      .catch(() => router.replace('/'));
  }, [router]);

  return (
    <main className="flex items-center justify-center min-h-screen">
      <p className="text-slate-400 text-sm animate-pulse">Connecting…</p>
    </main>
  );
}
