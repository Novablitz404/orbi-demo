'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { orbi } from '../../lib/orbi';

export default function SignCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    // User cancelled at the passkey screen — Orbi redirects back with ?cancelled=1.
    if (new URLSearchParams(window.location.search).get('cancelled') === '1') {
      router.replace('/');
      return;
    }

    const result = orbi.handleSignCallback();
    if (!result) { router.replace('/'); return; }

    const contractId = sessionStorage.getItem('pendingContractId');
    const functionName = sessionStorage.getItem('pendingFunctionName');
    if (!contractId || !functionName) { router.replace('/'); return; }

    sessionStorage.removeItem('pendingContractId');
    sessionStorage.removeItem('pendingFunctionName');

    // Submit the signed op, then hand off to the dashboard immediately with the
    // opId — confirmation is awaited there in the background so the user lands
    // back on the dashboard instead of staring at a submitting screen.
    orbi
      .bundle({
        walletAddress: result.walletAddress,
        quoteId: result.quoteId,
        signedAuthEntryXdr: result.signedAuthEntryXdr,
        contractId,
        functionName,
        argsXdr: result.argsXdr,
      })
      .then(({ opId }) => router.replace(`/?pending=${opId}`))
      .catch((err: Error) => setError(err.message));
  }, [router]);

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 max-w-sm w-full text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
        <button
          onClick={() => router.replace('/')}
          className="text-blue-400 text-sm hover:text-blue-300 transition-colors"
        >
          Back
        </button>
      </main>
    );
  }

  // Brief, quiet hand-off (the bundle call is ~1s) — just the logo, no stage.
  return (
    <main className="flex items-center justify-center min-h-screen">
      <img
        src="https://account.orbiwallet.xyz/Orbi%20logo%20-%20Landscape%20white.png"
        alt="Orbi"
        className="h-7 opacity-60 animate-pulse"
      />
    </main>
  );
}
