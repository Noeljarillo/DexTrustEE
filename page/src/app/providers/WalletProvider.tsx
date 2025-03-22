'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';

// Add Ethereum provider types
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
      removeListener: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

type WalletContextType = {
  address: string | null;
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  chainId: number | null;
};

const WalletContext = createContext<WalletContextType>({
  address: null,
  isConnected: false,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  chainId: null,
});

export const useWallet = () => useContext(WalletContext);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);

  // Connect wallet
  const connectWallet = async () => {
    if (typeof window.ethereum === 'undefined') {
      alert('Please install MetaMask to use this application');
      return;
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const provider = new ethers.BrowserProvider(window.ethereum);
      const network = await provider.getNetwork();
      
      setAddress(accounts[0]);
      setChainId(Number(network.chainId));
      setIsConnected(true);
      
      // Save connection state to localStorage
      localStorage.setItem('walletConnected', 'true');
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAddress(null);
    setChainId(null);
    setIsConnected(false);
    localStorage.removeItem('walletConnected');
  };

  // Check if wallet was previously connected
  useEffect(() => {
    const checkConnection = async () => {
      const wasConnected = localStorage.getItem('walletConnected') === 'true';
      
      if (wasConnected && typeof window.ethereum !== 'undefined') {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const provider = new ethers.BrowserProvider(window.ethereum);
            const network = await provider.getNetwork();
            
            setAddress(accounts[0]);
            setChainId(Number(network.chainId));
            setIsConnected(true);
          } else {
            // If no accounts returned, clear the connection state
            localStorage.removeItem('walletConnected');
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error);
          localStorage.removeItem('walletConnected');
        }
      }
    };

    checkConnection();
  }, []);

  // Handle account and chain changes
  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected their wallet
        disconnectWallet();
      } else if (isConnected) {
        // User switched accounts
        setAddress(accounts[0]);
      }
    };

    const handleChainChanged = (chainIdHex: string) => {
      if (isConnected) {
        setChainId(parseInt(chainIdHex, 16));
      }
    };

    // Add null check before adding event listeners
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      
      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
    
    return undefined;
  }, [isConnected]);

  return (
    <WalletContext.Provider
      value={{
        address,
        isConnected,
        connectWallet,
        disconnectWallet,
        chainId,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
} 