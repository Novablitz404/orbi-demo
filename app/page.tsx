'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Address, xdr } from '@stellar/stellar-sdk';
import { orbi } from '../lib/orbi';

const POINTS_CONTRACT_ID = 'CB44L2DCDAEOLGC2444FN2J22KBDQ6SP24VBMWXJTFM6XEM3LV4KG6EA';
const API_URL = process.env.NEXT_PUBLIC_ORBI_API_URL ?? 'https://api.orbiwallet.xyz';
const CLAIM_AMOUNT = 100n;
const SOROBAN_RPC = 'https://soroban-testnet.stellar.org';

function i128ScValBase64(value: bigint): string {
  const buf = new Uint8Array(20);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 10, false);
  view.setBigInt64(4, 0n, false);
  view.setBigUint64(12, value, false);
  return btoa(String.fromCharCode(...Array.from(buf)));
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

async function fetchXlm(walletAddress: string): Promise<string> {
  const res = await fetch(`${API_URL}/v1/wallet/balance/${walletAddress}`);
  const data = await res.json() as { xlm?: string };
  return data.xlm ?? '0';
}

async function fetchPoints(walletAddress: string): Promise<number> {
  const key = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol('Balance'),
    new Address(walletAddress).toScVal(),
  ]);
  const ledgerKey = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(POINTS_CONTRACT_ID).toScVal().address(),
      key,
      durability: xdr.ContractDataDurability.persistent(),
    })
  );
  const res = await fetch(SOROBAN_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'getLedgerEntries',
      params: { keys: [ledgerKey.toXDR('base64')] },
    }),
  });
  const data = await res.json() as { result?: { entries?: { xdr: string }[] } };
  if (!data.result?.entries?.length) return 0;
  // Soroban RPC getLedgerEntries returns LedgerEntryData (not a full LedgerEntry).
  const entryData = xdr.LedgerEntryData.fromXDR(data.result.entries[0].xdr, 'base64');
  const val = entryData.contractData().val();
  if (val.switch().name === 'scvI128') {
    const hi = BigInt(val.i128().hi().toString());
    const lo = BigInt(val.i128().lo().toString());
    return Number((hi << 64n) | lo);
  }
  return 0;
}

function ConnectScreen() {
  function handleConnect() {
    orbi.connect({ redirectUrl: `${window.location.origin}/orbi-callback` });
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <img
          src="https://account.orbiwallet.xyz/Orbi%20logo%20-%20Landscape%20white.png"
          alt="Orbi"
          className="h-8"
        />
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Orbi Points</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Connect your Orbi wallet to start earning points.
          </p>
        </div>
        <button
          onClick={handleConnect}
          className="w-full bg-[#30b27c] hover:bg-[#28a06e] text-white font-semibold py-3 rounded-xl transition-colors"
        >
          Connect Wallet
        </button>
        <p className="text-xs text-slate-600">
          No wallet yet?{' '}
          <a href="https://account.orbiwallet.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors underline">
            Create one free ↗
          </a>
        </p>
      </div>
    </main>
  );
}

function Dashboard({
  walletAddress,
  xlm,
  points,
  claiming,
  justClaimed,
  copied,
  onCopy,
  onClaim,
  onDisconnect,
}: {
  walletAddress: string;
  xlm: string | null;
  points: number | null;
  claiming: boolean;
  justClaimed: boolean;
  copied: boolean;
  onCopy: () => void;
  onClaim: () => void;
  onDisconnect: () => void;
}) {
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
          onClick={onDisconnect}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Disconnect
        </button>
      </div>

      <div className="w-full max-w-md mx-auto flex flex-col gap-4">

        {/* Wallet address */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl px-4 py-3.5">
          <p className="text-xs text-slate-500 mb-1.5">Wallet</p>
          <button onClick={onCopy} className="flex items-center gap-2.5 group">
            <span className="font-mono text-sm text-white">{truncate(walletAddress)}</span>
            <span className="text-xs text-slate-600 group-hover:text-slate-400 transition-colors">
              {copied ? 'Copied!' : 'Copy'}
            </span>
          </button>
        </div>

        {/* XLM Balance */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl px-4 py-4">
          <p className="text-xs text-slate-500 mb-1">XLM Balance</p>
          {xlm === null ? (
            <div className="h-8 w-36 bg-slate-800 rounded-lg animate-pulse" />
          ) : (
            <p className="text-2xl font-bold text-white">
              {parseFloat(xlm).toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
            </p>
          )}
          <p className="text-xs text-slate-600 mt-1">Testnet</p>
        </div>

        {/* Orbi Points */}
        <div className="bg-[#0f172a] border border-[#1e293b] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[#30b27c]/10 border border-[#30b27c]/20 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#30b27c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Orbi Points</p>
              <p className="text-xs text-slate-500">Earn points in the Orbi ecosystem</p>
            </div>
          </div>

          <div className="bg-[#020817] border border-[#1e293b] rounded-xl px-4 py-3 mb-4">
            <p className="text-xs text-slate-500 mb-0.5">Your balance</p>
            {points === null ? (
              <div className="h-7 w-24 bg-slate-800 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-white">
                {points.toLocaleString()} <span className="text-sm font-normal text-slate-500">pts</span>
              </p>
            )}
          </div>

          {justClaimed && (
            <div className="flex items-center gap-2.5 bg-[#30b27c]/10 border border-[#30b27c]/30 rounded-xl px-4 py-3 mb-4">
              <svg className="w-4 h-4 text-[#30b27c] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-[#30b27c] text-sm font-medium">+{Number(CLAIM_AMOUNT)} points claimed!</p>
            </div>
          )}

          <button
            onClick={onClaim}
            disabled={claiming}
            className="w-full bg-[#30b27c] hover:bg-[#28a06e] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {claiming ? 'Redirecting to sign…' : `Claim ${Number(CLAIM_AMOUNT)} Points`}
          </button>
        </div>

        <p className="text-center text-xs text-slate-600 mt-2">
          Built with{' '}
          <code className="text-slate-500">@orbi-wallet/sdk</code>
          {' · '}
          <a href="https://developers.orbiwallet.xyz/docs" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
            Docs ↗
          </a>
        </p>
      </div>
    </main>
  );
}

function App() {
  const searchParams = useSearchParams();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [xlm, setXlm] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const addr = localStorage.getItem('walletAddress');
    if (!addr) return;
    setWalletAddress(addr);
    fetchXlm(addr).then(setXlm).catch(() => setXlm('—'));
    fetchPoints(addr).then(setPoints).catch(() => setPoints(0));

    if (searchParams.get('claimed') === '1') {
      setJustClaimed(true);
      const t = setTimeout(() => setJustClaimed(false), 6000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  function handleCopy() {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleClaim() {
    if (!walletAddress) return;
    setClaiming(true);
    const toArg = Buffer.from(new Address(walletAddress).toScVal().toXDR()).toString('base64');
    const argsXdr = [toArg, i128ScValBase64(CLAIM_AMOUNT)];
    sessionStorage.setItem('pendingContractId', POINTS_CONTRACT_ID);
    sessionStorage.setItem('pendingFunctionName', 'mint');
    orbi.sign({
      walletAddress,
      contractId: POINTS_CONTRACT_ID,
      functionName: 'mint',
      argsXdr,
      redirectUrl: `${window.location.origin}/sign-callback`,
    });
  }

  function handleDisconnect() {
    localStorage.removeItem('walletAddress');
    orbi.disconnect(window.location.origin);
  }

  if (!walletAddress) return <ConnectScreen />;

  return (
    <Dashboard
      walletAddress={walletAddress}
      xlm={xlm}
      points={points}
      claiming={claiming}
      justClaimed={justClaimed}
      copied={copied}
      onCopy={handleCopy}
      onClaim={handleClaim}
      onDisconnect={handleDisconnect}
    />
  );
}

export default function Page() {
  return (
    <Suspense>
      <App />
    </Suspense>
  );
}
