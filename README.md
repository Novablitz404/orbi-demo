# Orbi Points — Example dApp

A complete, minimal **reference dApp** showing how to integrate [Orbi Smart Wallet](https://orbiwallet.xyz) into a Stellar app using [`@orbi-wallet/sdk`](https://www.npmjs.com/package/@orbi-wallet/sdk).

Users connect their Orbi wallet, then **claim 100 "Orbi Points"** by signing a custom Soroban contract call with their passkey — gas sponsored, no seed phrase, no extension. It exercises the entire SDK flow end to end and is meant to be **forked as a starting point**.

> **Live demo:** [demo.orbiwallet.xyz](https://demo.orbiwallet.xyz)
> **Docs:** [developers.orbiwallet.xyz/docs](https://developers.orbiwallet.xyz/docs)

---

## What it demonstrates

| SDK capability | Where |
| --- | --- |
| Connect a wallet (redirect flow) | `app/page.tsx` → `app/orbi-callback/page.tsx` |
| Sign a **custom contract call** with a passkey | `app/page.tsx` (`handleClaim`) → `app/sign-callback/page.tsx` |
| Sponsor gas (gasless for the user) | `lib/orbi.ts` (`apiKey`) |
| Submit + await on-chain confirmation | `app/sign-callback/page.tsx` + `app/page.tsx` |
| Read on-chain contract state | `app/page.tsx` (`fetchPoints` via Soroban RPC) |
| Disconnect (clear Orbi session) | `app/page.tsx` (`handleDisconnect`) |

---

## The 3 files every Orbi integration needs

Everything else is your own app. These three are the integration:

```
lib/orbi.ts                  # the OrbiClient singleton — import `orbi` everywhere
app/orbi-callback/page.tsx   # handles the return after connect()
app/sign-callback/page.tsx   # handles the return after sign()
```

### `lib/orbi.ts`

```ts
import { OrbiClient } from '@orbi-wallet/sdk';

export const orbi = new OrbiClient({
  apiUrl: process.env.NEXT_PUBLIC_ORBI_API_URL ?? 'https://api.orbiwallet.xyz',
  apiKey: process.env.NEXT_PUBLIC_ORBI_API_KEY, // omit to make the user pay gas
});
```

---

## How the flow works

Orbi uses a **redirect flow** (not popups), so it works on every browser including mobile. The user is sent to `keys.orbiwallet.xyz`, authenticates with their device passkey, and is redirected back to your app with the result in the URL.

### 1. Connect

```ts
orbi.connect({ redirectUrl: `${window.location.origin}/orbi-callback` });
```

On return, `app/orbi-callback/page.tsx` exchanges the token and stores the wallet address:

```ts
const wallet = await orbi.handleCallback(); // { walletAddress, passkeyId, email }
localStorage.setItem('walletAddress', wallet.walletAddress);
```

### 2. Sign a contract call

The demo claims points by calling `mint(to, amount)` on the points contract. Arguments are base64 XDR-encoded `ScVal`s:

```ts
const toArg = Buffer.from(new Address(walletAddress).toScVal().toXDR()).toString('base64');
const argsXdr = [toArg, i128ScValBase64(100n)];

sessionStorage.setItem('pendingContractId', POINTS_CONTRACT_ID);
sessionStorage.setItem('pendingFunctionName', 'mint');

orbi.sign({
  walletAddress,
  contractId: POINTS_CONTRACT_ID,
  functionName: 'mint',
  argsXdr,
  redirectUrl: `${window.location.origin}/sign-callback`,
});
```

### 3. Submit + confirm

On return, `app/sign-callback/page.tsx` reads the signed entry, submits it, and hands the operation back to the dashboard to confirm in the background:

```ts
const result = orbi.handleSignCallback();
const { opId } = await orbi.bundle({
  walletAddress: result.walletAddress,
  quoteId: result.quoteId,
  signedAuthEntryXdr: result.signedAuthEntryXdr,
  contractId,
  functionName,
  argsXdr: result.argsXdr,
});
// hand off so the user lands on the dashboard, not a spinner page
router.replace(`/?pending=${opId}`);
```

The dashboard then awaits confirmation over SSE:

```ts
const status = await orbi.waitForConfirmation(opId); // resolves in ~5s
```

---

## Running locally

```bash
git clone https://github.com/Novablitz404/orbi-demo
cd orbi-demo
npm install
cp .env.local.example .env.local   # optional — see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You'll need an Orbi wallet — create one free at [account.orbiwallet.xyz](https://account.orbiwallet.xyz).

### Environment variables

All are optional — the demo works on testnet with public defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_ORBI_API_URL` | `https://api.orbiwallet.xyz` | Orbi relay API |
| `NEXT_PUBLIC_ORBI_API_KEY` | _(none)_ | Set it to **sponsor gas** for your users. Get one at [developers.orbiwallet.xyz](https://developers.orbiwallet.xyz). Without it, the user pays their own fee. |
| `NEXT_PUBLIC_STELLAR_NETWORK` | `testnet` | `testnet` or `mainnet` |

---

## The contract

A deliberately tiny Soroban contract (`contract/src/lib.rs`) — just an `address → points` map, no token standard:

```rust
pub fn mint(env: Env, to: Address, amount: i128) {
    to.require_auth();                  // the user's passkey authorizes this
    let current = env.storage().persistent().get(&DataKey::Balance(to.clone())).unwrap_or(0);
    env.storage().persistent().set(&DataKey::Balance(to), &(current + amount));
}

pub fn balance(env: Env, addr: Address) -> i128 { /* ... */ }
```

Deployed on **testnet** at:

```
CB44L2DCDAEOLGC2444FN2J22KBDQ6SP24VBMWXJTFM6XEM3LV4KG6EA
```

Rebuild and redeploy your own:

```bash
cd contract
stellar contract build
wasm-opt -Oz --enable-bulk-memory \
  -o target/wasm32v1-none/release/orbi_points.wasm \
  target/wasm32v1-none/release/orbi_points.wasm
stellar contract deploy \
  --wasm target/wasm32v1-none/release/orbi_points.wasm \
  --network testnet --source-account <your-account>
```

---

## Gotchas worth knowing

- **Orbi wallet addresses are Soroban contracts (`C...`), not classic accounts (`G...`).** Horizon's `/accounts/{address}` won't return their balance. Use the relay endpoint instead — no API key required:
  ```
  GET https://api.orbiwallet.xyz/v1/wallet/balance/{address}  →  { "xlm": "..." }
  ```
- **Reading custom contract state** (the points balance) is done directly against Soroban RPC with `getLedgerEntries` — its `xdr` field is a `LedgerEntryData` (not a full `LedgerEntry`). See `fetchPoints` in `app/page.tsx`.
- **`sign()` works with any contract + function**, not just token transfers. `mint(to, amount)` here is the same pattern you'd use for `stake`, `vote`, `swap`, etc.

---

## Project structure

```
app/
  page.tsx                 # connect screen + dashboard (address, XLM, points, claim)
  orbi-callback/page.tsx   # ← required: handles connect() return
  sign-callback/page.tsx   # ← required: handles sign() return
  layout.tsx
lib/
  orbi.ts                  # ← required: OrbiClient singleton
contract/
  src/lib.rs               # the Orbi Points Soroban contract
```

---

## Stack

[Next.js](https://nextjs.org) (App Router) · [`@orbi-wallet/sdk`](https://www.npmjs.com/package/@orbi-wallet/sdk) · [`@stellar/stellar-sdk`](https://www.npmjs.com/package/@stellar/stellar-sdk) · Tailwind CSS · Soroban (Rust)

## License

MIT
