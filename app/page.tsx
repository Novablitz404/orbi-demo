'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Address, xdr } from '@stellar/stellar-sdk';
import { orbi } from '../lib/orbi';

const POINTS_CONTRACT_ID = 'CB44L2DCDAEOLGC2444FN2J22KBDQ6SP24VBMWXJTFM6XEM3LV4KG6EA';
const CLAIM_AMOUNT = 100n;

// Encode ScVal::scvI128(value) using DataView — works natively in all browsers
// without needing the Buffer BigInt64 polyfill that js-xdr relies on.
function i128ScValBase64(value: bigint): string {
  const buf = new Uint8Array(20);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 10, false);           // discriminant: scvI128 = 10
  view.setBigInt64(4, 0n, false);          // hi = 0 (positive values only)
  view.setBigUint64(12, value, false);     // lo = value
  return btoa(String.fromCharCode(...Array.from(buf)));
}
const SOROBAN_RPC = 'https://soroban-testnet.stellar.org';

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
  const ledgerEntry = xdr.LedgerEntry.fromXDR(data.result.entries[0].xdr, 'base64');
  const val = ledgerEntry.data().contractData().val();
  if (val.switch().name === 'scvI128') {
    const hi = BigInt(val.i128().hi().toString());
    const lo = BigInt(val.i128().lo().toString());
    return Number((hi << 64n) | lo);
  }
  return 0;
}

function MintPage() {
  const searchParams = useSearchParams();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);

  useEffect(() => {
    const addr = localStorage.getItem('walletAddress');
    if (addr) {
      setWalletAddress(addr);
      fetchPoints(addr).then(setPoints).catch(() => setPoints(0));
    }

    if (searchParams.get('claimed') === '1') {
      setJustClaimed(true);
      setTimeout(() => setJustClaimed(false), 6000);
    }
  }, [searchParams]);

  function handleConnect() {
    orbi.connect({ redirectUrl: `${window.location.origin}/orbi-callback` });
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

  const isConnected = !!walletAddress;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">

        {/* Logo */}
        <img
          src="https://account.orbiwallet.xyz/Orbi%20logo%20-%20Landscape%20white.png"
          alt="Orbi"
          className="h-8"
        />

        {/* Token card */}
        <div className="w-full bg-[#0f172a] border border-[#1e293b] rounded-3xl p-6 flex flex-col items-center gap-4 text-center">

          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#30b27c]/30 to-[#30b27c]/5 border border-[#30b27c]/20 flex items-center justify-center">
            <svg className="w-9 h-9 text-[#30b27c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">Orbi Points</h1>
            <p className="text-slate-400 text-sm mt-1 leading-relaxed">
              Earn points in the Orbi ecosystem.<br />Claim {Number(CLAIM_AMOUNT)} points per transaction.
            </p>
          </div>

          {/* Points balance */}
          {isConnected && (
            <div className="w-full bg-[#020817] border border-[#1e293b] rounded-2xl py-3 px-4">
              <p className="text-xs text-slate-500 mb-0.5">Your balance</p>
              {points === null ? (
                <div className="h-7 w-24 bg-slate-800 rounded animate-pulse mx-auto" />
              ) : (
                <p className="text-2xl font-bold text-white">{points.toLocaleString()} <span className="text-sm font-normal text-slate-500">pts</span></p>
              )}
            </div>
          )}

          {/* Success banner */}
          {justClaimed && (
            <div className="w-full flex items-center gap-2.5 bg-[#30b27c]/10 border border-[#30b27c]/30 rounded-xl px-4 py-3">
              <svg className="w-4 h-4 text-[#30b27c] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-[#30b27c] text-sm font-medium">+{Number(CLAIM_AMOUNT)} points claimed!</p>
            </div>
          )}

          {/* Action button */}
          {!isConnected ? (
            <button
              onClick={handleConnect}
              className="w-full bg-[#30b27c] hover:bg-[#28a06e] text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Connect & Claim
            </button>
          ) : (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className="w-full bg-[#30b27c] hover:bg-[#28a06e] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {claiming ? 'Redirecting to sign…' : `Claim ${Number(CLAIM_AMOUNT)} Points`}
            </button>
          )}
        </div>

        {/* Disconnect / footer */}
        {isConnected ? (
          <button
            onClick={handleDisconnect}
            className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <p className="text-xs text-slate-600">
            No wallet yet?{' '}
            <a href="https://account.orbiwallet.xyz" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors underline">
              Create one free ↗
            </a>
          </p>
        )}

        <p className="text-xs text-slate-700">
          Built with{' '}
          <code className="text-slate-600">@orbi-wallet/sdk</code>
          {' · '}
          <a href="https://developers.orbiwallet.xyz/docs" target="_blank" rel="noopener noreferrer" className="hover:text-slate-500 transition-colors">
            Docs ↗
          </a>
        </p>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense>
      <MintPage />
    </Suspense>
  );
}
