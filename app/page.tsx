'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { orbi } from '../lib/orbi';

export default function ConnectPage() {
  const router = useRouter();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('walletAddress')) setConnected(true);
  }, []);

  function handleConnect() {
    orbi.connect({ redirectUrl: `${window.location.origin}/orbi-callback` });
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm text-center">

        <div className="flex justify-center mb-8">
          <img
            src="https://account.orbiwallet.xyz/Orbi%20logo%20-%20Landscape%20white.png"
            alt="Orbi"
            className="h-9"
          />
        </div>

        <h1 className="text-2xl font-bold text-white mb-2">Send XLM Demo</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          A minimal dApp built with{' '}
          <code className="text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded text-xs">@orbi-wallet/sdk</code>.<br className="hidden sm:block" />
          {' '}No extension. No seed phrase. Just your passkey.
        </p>

        {connected ? (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full bg-[#30b27c] hover:bg-[#28a06e] text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Open Dashboard
            </button>
            <button
              onClick={() => { localStorage.clear(); setConnected(false); }}
              className="w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            className="w-full bg-[#30b27c] hover:bg-[#28a06e] text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Connect with Orbi
          </button>
        )}

        <div className="mt-10 pt-8 border-t border-[#1e293b] text-xs text-slate-600 flex flex-col gap-1.5">
          <p>
            Powered by{' '}
            <a href="https://orbiwallet.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors underline">
              orbiwallet.xyz
            </a>
          </p>
          <p>
            <a href="https://developers.orbiwallet.xyz/docs" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors underline">
              View SDK docs ↗
            </a>
            {' · '}
            <a href="https://github.com/Novablitz404/orbi-demo" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors underline">
              View source ↗
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
