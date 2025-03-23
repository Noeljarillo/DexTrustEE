'use client';

import { useState } from 'react';
import { ConnectWallet } from './components/ConnectWallet';
import { OrderBook } from './components/OrderBook';
import { OrderForm } from './components/OrderForm';
import { MarketSelector } from '@/app/components/MarketSelector';
import { MARKET_CODES } from './utils/constants';
import Image from 'next/image';

export default function Home() {
  const [selectedMarket, setSelectedMarket] = useState(MARKET_CODES.ETH_FAKE);

  // Handle market selection
  const handleMarketSelect = (marketId: string) => {
    setSelectedMarket(marketId);
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="w-full bg-gray-900 border-b border-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-black border-2 border-gray-700 rounded-md flex items-center justify-center">
              <span className="text-white font-extrabold text-lg">BB</span>
            </div>
            <div className="flex flex-col">
              <h1 className="text-2xl font-black text-white tracking-tight">BLACK-BOOK</h1>
              <div className="h-0.5 w-full bg-gradient-to-r from-gray-500 to-transparent"></div>
            </div>
          </div>
          <ConnectWallet />
        </div>
      </header>

      {/* Hero Section */}
      <div className="w-full bg-gradient-to-b from-gray-900 to-gray-950 py-12 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-10">
            <div className="md:w-1/2">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                <span className="bg-gradient-to-r from-blue-500 to-indigo-500 text-transparent bg-clip-text">Secure</span> &{' '}
                <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-transparent bg-clip-text">Private</span>
                <br />
                DEX Orderbook
              </h1>
              <p className="text-gray-300 text-lg mb-6">
                Powered by Trusted Execution Environment technology for unmatched security and privacy. 
                Trade with confidence across multiple markets.
              </p>
              <div className="flex gap-4 mb-6">
                <div className="px-4 py-3 bg-gray-800 rounded-lg flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-300">Trustless Privacy</span>
                </div>
                <div className="px-4 py-3 bg-gray-800 rounded-lg flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-400 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-gray-300">Confidential Computing</span>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <div className="w-full max-w-md p-6 bg-gray-800 rounded-lg border border-gray-700 shadow-2xl relative">
                <div className="absolute -top-3 -right-3 bg-blue-600 text-white px-3 py-1 text-xs font-bold rounded-full">TEE Protected</div>
                <div className="mb-4 pb-4 border-b border-gray-700">
                  <h3 className="text-white font-medium mb-1">Market Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-400">ETH-FAKE</div>
                      <div className="text-xl font-bold text-white">$3,100.42</div>
                      <div className="text-xs text-green-400">+1.85%</div>
                      <div className="text-xs bg-blue-500 text-white mt-1 rounded-full px-2 py-0.5 inline-block">Active</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-400">BTC-USDT</div>
                      <div className="text-xl font-bold text-white">$61,245.80</div>
                      <div className="text-xs text-green-400">+3.24%</div>
                    </div>
                    <div className="mt-3">
                      <div className="text-sm text-gray-400">ETH-USDT</div>
                      <div className="text-xl font-bold text-white">$3,124.55</div>
                      <div className="text-xs text-green-400">+2.18%</div>
                    </div>
                  </div>
                  <div className="mt-3 bg-blue-900 bg-opacity-20 rounded p-2 border border-blue-800">
                    <div className="text-sm text-gray-300 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-400 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">ETH-FAKE is the only real working market</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-400">24h Volume</div>
                  <div className="text-xs text-blue-400">All markets available</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <MarketSelector onMarketSelect={handleMarketSelect} selectedMarket={selectedMarket} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2">
            <OrderBook selectedMarket={selectedMarket} />
          </div>
          <div>
            <OrderForm selectedMarket={selectedMarket} />
          </div>
        </div>
      </main>

      <footer className="bg-gray-900 border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-lg font-medium text-white mb-4">BLACK-BOOK</h3>
              <p className="text-sm text-gray-400 mb-4">
                A cutting-edge trading platform with enhanced privacy and security through Trusted Execution Environment technology.
              </p>
              <div className="flex space-x-4">
                <a href="#" className="text-gray-400 hover:text-white">
                  <span className="sr-only">Twitter</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                  </svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <span className="sr-only">GitHub</span>
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </a>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-4">Resources</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Documentation</a></li>
                <li><a href="#" className="hover:text-white">API Reference</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-4">Contact</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  support@blackbook.io
                </li>
                <li className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                  Live Chat Support
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6">
            <p className="text-center text-sm text-gray-400">
              &copy; {new Date().getFullYear()} Black-Book. All rights reserved.
              <br />
              <span className="text-xs text-gray-500">
                Transactions are processed in a private TEE environment for enhanced security and privacy.
              </span>
              <br />
              <span className="text-xs text-blue-400 mt-2 inline-block">
                Currently, only the ETH-FAKE market is fully operational with our deployed token
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
