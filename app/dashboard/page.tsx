'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Address, Asset, Networks, nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { orbi } from '../../lib/orbi';

const NETWORK = (process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const HORIZON_URL = NETWORK === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
const NATIVE_SAC_ID = Asset.native().contractId(NETWORK_PASSPHRASE);
const EXPLORER_BASE = NETWORK === 'mainnet'
  ? 'https://stellar.expert/explorer/public/tx'
  : 'https://stellar.expert/explorer/testnet/tx';

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

interface HorizonBalance {
  asset_type: string;
  balance: string;
}

function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    const addr = localStorage.getItem('walletAddress');
    if (!addr) { router.replace('/'); return; }
    setWalletAddress(addr);

    fetch(`${HORIZON_URL}/accounts/${addr}`)
      .then(r => r.json())
      .then((data: { balances?: HorizonBalance[] }) => {
        const xlm = data.balances?.find(b => b.asset_type === 'native')?.balance ?? '0';
        setBalance(xlm);
      })
      .catch(() => setBalance('—'));

    if (searchParams.get('sent') === '1') {
      setJustSent(true);
      const hash = sessionStorage.getItem('lastTxHash');
      if (hash) setTxHash(hash);
      sessionStorage.removeItem('lastTxHash');
      const t = setTimeout(() => setJustSent(false), 8000);
      return () => clearTimeout(t);
    }
  }, [router, searchParams]);

  function handleCopy() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleSend() {
    if (!walletAddress || !to.trim() || !amount) return;
    setSendError('');

    let amountUnits: number;
    try {
      amountUnits = Math.round(parseFloat(amount) * 1e7);
      if (isNaN(amountUnits) || amountUnits <= 0) throw new Error('Invalid amount');
    } catch {
      setSendError('Enter a valid amount greater than 0');
      return;
    }

    const args: xdr.ScVal[] = [
      new Address(walletAddress).toScVal(),
      new Address(to.trim()).toScVal(),
      nativeToScVal(BigInt(amountUnits), { type: 'i128' }),
    ];
    const argsXdr = args.map(a => Buffer.from(a.toXDR()).toString('base64'));

    sessionStorage.setItem('pendingContractId', NATIVE_SAC_ID);
    sessionStorage.setItem('pendingFunctionName', 'transfer');

    setSending(true);
    orbi.sign({
      walletAddress,
      contractId: NATIVE_SAC_ID,
      functionName: 'transfer',
      argsXdr,
      redirectUrl: `${window.location.origin}/sign-callback`,
    });
  }

  function handleDisconnect() {
    localStorage.clear();
    router.replace('/');
  }

  if (!walletAddress) return null;

  const isValidTo = to.trim().length >= 56;
  const isValidAmount = amount.length > 0 && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
  const canSend = isValidTo && isValidAmount && !sending;

  return (
    <main className="flex flex-col min-h-screen px-4 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between py-5 max-w-md mx-auto w-full">
        <img
          src="https://account.orbiwallet.xyz/Orbi%20logo%20-%20Landscape%20white.png"
          alt="Orbi"
          className="h-7"
        />
        <button
          onClick={handleDisconnect}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Disconnect
        </button>
      </div>

      <div className="w-full max-w-md mx-auto flex flex-col gap-4">

        {/* Success banner */}
        {justSent && (
          <div className="bg-[#30b27c]/10 border border-[#30b27c]/30 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 text-[#30b27c] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-[#30b27c] text-sm font-medium">Transaction confirmed</p>
            </div>
            {txHash && (
              <a
                href={`${EXPLORER_BASE}/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors shrink-0"
              >
                View ↗
              </a>
            )}
          </div>
        )}

        {/* Wallet address */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl px-4 py-3.5">
          <p className="text-xs text-slate-500 mb-1.5">Wallet</p>
          <button onClick={handleCopy} className="flex items-center gap-2.5 group">
            <span className="font-mono text-sm text-white">{truncate(walletAddress)}</span>
            <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </button>
        </div>

        {/* XLM Balance */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl px-4 py-4">
          <p className="text-xs text-slate-500 mb-1">Balance</p>
          {balance === null ? (
            <div className="h-8 w-36 bg-slate-800 rounded-lg animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-white">
              {balance === '—' ? '—' : `${parseFloat(balance).toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM`}
            </p>
          )}
          {NETWORK === 'testnet' && (
            <p className="text-xs text-slate-600 mt-1">Testnet</p>
          )}
        </div>

        {/* Send form */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5">
          <p className="text-sm font-semibold text-white mb-4">Send XLM</p>

          <div className="flex flex-col gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Recipient address</label>
              <input
                type="text"
                placeholder="G... or C..."
                value={to}
                onChange={e => setTo(e.target.value)}
                disabled={sending}
                className="w-full bg-[#020817] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 text-sm font-mono focus:outline-none focus:border-[#30b27c] transition-colors disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1.5">Amount (XLM)</label>
              <input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                disabled={sending}
                min="0"
                step="0.0000001"
                className="w-full bg-[#020817] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 text-lg font-semibold focus:outline-none focus:border-[#30b27c] transition-colors disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>

            {sendError && (
              <p className="text-red-400 text-xs">{sendError}</p>
            )}

            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full bg-[#30b27c] hover:bg-[#28a06e] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors mt-1"
            >
              {sending ? 'Redirecting to sign…' : 'Send with Orbi'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-2">
          Built with{' '}
          <code className="text-slate-500">@orbi-wallet/sdk</code>
          {' · '}
          <a
            href="https://developers.orbiwallet.xyz/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-400 transition-colors"
          >
            Docs ↗
          </a>
        </p>
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
