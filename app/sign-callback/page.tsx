'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { orbi } from '../../lib/orbi';

export default function SignCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const result = orbi.handleSignCallback();
    if (!result) { router.replace('/'); return; }

    const contractId = sessionStorage.getItem('pendingContractId');
    const functionName = sessionStorage.getItem('pendingFunctionName');
    if (!contractId || !functionName) { router.replace('/dashboard'); return; }

    sessionStorage.removeItem('pendingContractId');
    sessionStorage.removeItem('pendingFunctionName');

    orbi
      .bundle({
        walletAddress: result.walletAddress,
        quoteId: result.quoteId,
        signedAuthEntryXdr: result.signedAuthEntryXdr,
        contractId,
        functionName,
        argsXdr: result.argsXdr,
      })
      .then(({ opId }) => orbi.waitForConfirmation(opId))
      .then((status) => {
        if (status.status === 'confirmed') {
          if (status.txHash) sessionStorage.setItem('lastTxHash', status.txHash);
          router.replace('/dashboard?sent=1');
        } else {
          setError(status.error ?? 'Transaction failed');
        }
      })
      .catch((err: Error) => setError(err.message));
  }, [router]);

  if (error) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-4 px-4">
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-4 max-w-sm w-full text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
        <button
          onClick={() => router.replace('/dashboard')}
          className="text-blue-400 text-sm hover:text-blue-300 transition-colors"
        >
          Back to Dashboard
        </button>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-3">
      <svg className="animate-spin w-8 h-8 text-[#30b27c]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <p className="text-slate-400 text-sm animate-pulse">Submitting transaction…</p>
    </main>
  );
}
