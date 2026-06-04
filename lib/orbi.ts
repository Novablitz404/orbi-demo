import { OrbiClient } from '@orbi-wallet/sdk';

export const orbi = new OrbiClient({
  apiUrl: process.env.NEXT_PUBLIC_ORBI_API_URL ?? 'https://api.orbiwallet.xyz',
  apiKey: process.env.NEXT_PUBLIC_ORBI_API_KEY,
});
