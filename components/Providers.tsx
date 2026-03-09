'use client';

import { OnchainKitProvider } from '@coinbase/onchainkit';
import { MiniKitProvider } from '@coinbase/onchainkit/minikit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { base } from 'viem/chains';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { coinbaseWallet, walletConnect, injected } from 'wagmi/connectors';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';
import { type ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [config] = useState(() =>
    createConfig({
      chains: [citrea],
      connectors: [
        farcasterMiniApp(), // First for Farcaster auto-connect
        coinbaseWallet({
          appName: 'Citrea Archery',
          preference: 'all', // Single connector for both Smart Wallet and regular wallet
        }),
        walletConnect({
          projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '0',
          metadata: {
            name: 'Citrea Archery',
            description: 'Become a Citrea Legend',
            url: 'https://citrea-archery-game.vercel.app',
            icons: ['https://citrea-archery-game.vercel.app/logo.png'],
          },
          showQrModal: true,
        }),
        injected(),
      ],
      transports: {
        [base.id]: http(),
      },
    })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
          chain={citrea}
        >
          <MiniKitProvider chain={citrea}>
            {children}
          </MiniKitProvider>
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}