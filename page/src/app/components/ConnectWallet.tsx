'use client';

import { useState } from 'react';
import { useWallet } from '../providers/WalletProvider';

export function ConnectWallet() {
  const { address, isConnected, connectWallet, disconnectWallet } = useWallet();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Format address for display (0x1234...5678)
  const formatAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (isConnected && address) {
    return (
      <div className="relative">
        <button 
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-center gap-2 px-4 py-2 font-medium text-sm rounded-full text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors"
        >
          {formatAddress(address)}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
        
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg py-1 z-10">
            <button 
              onClick={() => {
                disconnectWallet();
                setIsDropdownOpen(false);
              }}
              className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          connectWallet();
          setIsDropdownOpen(false);
        }}
        className="flex items-center justify-center gap-2 px-4 py-2 font-medium text-sm rounded-full text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors"
      >
        Connect Wallet
      </button>
    </div>
  );
} 