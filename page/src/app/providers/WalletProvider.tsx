'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { 
  WagmiProvider, 
  createConfig, 
  http, 
  type Config
} from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { injected, walletConnect } from 'wagmi/connectors';

// Create a query client for React Query
const queryClient = new QueryClient();

// Configure Wagmi
const config: Config = createConfig({
  chains: [mainnet, sepolia],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
  connectors: [
    injected(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YOUR_PROJECT_ID', // You'll need to obtain this from WalletConnect
    }),
  ],
});

// Provider component that wraps the children with necessary providers
export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
} 