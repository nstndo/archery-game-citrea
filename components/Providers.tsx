'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { walletConnect, injected } from 'wagmi/connectors';
import { type ReactNode, useState } from 'react';
import { defineChain } from 'viem';

export const citrea = defineChain({
  id: 4114,
  name: 'Citrea Mainnet',
  nativeCurrency: { name: 'cBTC', symbol: 'cBTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.citrea.xyz'] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://explorer.mainnet.citrea.xyz' },
  },
});

export const config = createConfig({
  chains: [citrea],
  ssr: true,
  connectors: [
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '0',
      metadata: {
        name: 'Citrea Archery',
        description: 'Become a Citrea Legend',
        url: 'https://citrea-archery-game.vercel.app',
        icons: ['https://citrea-archery-game.vercel.app/favicon.svg'],
      },
    }),
    injected(),
  ],
  transports: {
    [citrea.id]: http('https://rpc.mainnet.citrea.xyz'),
  },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
