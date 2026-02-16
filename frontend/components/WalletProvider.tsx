'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/lib/wallet';
import { createContext, useContext, ReactNode, useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { setWalletAddress } from '@/lib/api';

import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient();

// Context for wallet address to be used in API calls
interface WalletContextType {
  address: string | undefined;
  isConnected: boolean;
}

const WalletContext = createContext<WalletContextType>({
  address: undefined,
  isConnected: false,
});

export function useWallet() {
  return useContext(WalletContext);
}

// Inner component that has access to wagmi hooks
function WalletContextProvider({ children }: { children: ReactNode }) {
  const { address, isConnected } = useAccount();

  // Sync wallet address with API client
  useEffect(() => {
    setWalletAddress(address);
  }, [address]);

  return (
    <WalletContext.Provider value={{ address, isConnected }}>
      {children}
    </WalletContext.Provider>
  );
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => {
      setMounted(true);
    });
  }, []);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#06b6d4', // cyan-500 to match Trende theme
            accentColorForeground: 'white',
            borderRadius: 'medium',
            fontStack: 'system',
            overlayBlur: 'small',
          })}
          modalSize="compact"
        >
          <WalletContextProvider>
            {mounted ? children : null}
          </WalletContextProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
