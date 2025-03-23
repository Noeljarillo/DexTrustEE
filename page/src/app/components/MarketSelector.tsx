'use client';

import { useState } from 'react';
import { MARKET_CODES } from '../utils/constants';

type Market = {
  id: string;
  name: string;
  baseAsset: string;
  quoteAsset: string;
  price: string;
  change: string;
  isPositive: boolean;
  volume: string;
};

// Mock market data
const MARKETS: Market[] = [
  {
    id: MARKET_CODES.ETH_FAKE,
    name: 'Ethereum FAKE',
    baseAsset: 'ETH',
    quoteAsset: 'FAKE',
    price: '3,100.42',
    change: '+1.85%',
    isPositive: true,
    volume: '87.6M'
  },
  {
    id: MARKET_CODES.ETH_USDT,
    name: 'Ethereum',
    baseAsset: 'ETH',
    quoteAsset: 'USDT',
    price: '3,124.55',
    change: '+2.18%',
    isPositive: true,
    volume: '145.3M'
  },
  {
    id: MARKET_CODES.BTC_USDT,
    name: 'Bitcoin',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    price: '61,245.80',
    change: '+3.24%',
    isPositive: true,
    volume: '325.7M'
  },
  {
    id: MARKET_CODES.SOL_USDT,
    name: 'Solana',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    price: '178.32',
    change: '+4.56%',
    isPositive: true,
    volume: '98.4M'
  },
  {
    id: MARKET_CODES.AVAX_USDT,
    name: 'Avalanche',
    baseAsset: 'AVAX',
    quoteAsset: 'USDT',
    price: '39.85',
    change: '-1.23%',
    isPositive: false,
    volume: '55.1M'
  },
  {
    id: MARKET_CODES.ARB_USDT,
    name: 'Arbitrum',
    baseAsset: 'ARB',
    quoteAsset: 'USDT',
    price: '1.58',
    change: '+0.87%',
    isPositive: true,
    volume: '28.3M'
  }
];

type MarketSelectorProps = {
  selectedMarket?: string;
  onMarketSelect?: (marketId: string) => void;
};

export function MarketSelector({ 
  selectedMarket = MARKET_CODES.ETH_USDT,
  onMarketSelect = () => {}
}: MarketSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'defi' | 'layer1'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // In a real app, you would filter based on categories and search from your API
  const filteredMarkets = MARKETS.filter(market => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        market.name.toLowerCase().includes(query) || 
        market.baseAsset.toLowerCase().includes(query) ||
        market.id.toLowerCase().includes(query)
      );
    }
    return true;
  });
  
  // Handle market selection
  const handleMarketSelect = (marketId: string) => {
    onMarketSelect(marketId);
  };
  
  return (
    <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-800 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-blue-400 bg-gradient-to-r from-blue-500 to-indigo-500 text-transparent bg-clip-text">Markets</h2>
        <div className="flex bg-gray-800 rounded-md p-1">
          <button 
            className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${selectedCategory === 'all' ? 'bg-gray-700 shadow-md text-white' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setSelectedCategory('all')}
          >
            All
          </button>
          <button 
            className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${selectedCategory === 'defi' ? 'bg-gray-700 shadow-md text-white' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setSelectedCategory('defi')}
          >
            DeFi
          </button>
          <button 
            className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${selectedCategory === 'layer1' ? 'bg-gray-700 shadow-md text-white' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setSelectedCategory('layer1')}
          >
            Layer-1
          </button>
        </div>
        <div className="relative">
          <input 
            type="text" 
            placeholder="Search markets..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-1 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="text-xs text-gray-400 border-b border-gray-800">
              <th className="py-2 text-left">Market</th>
              <th className="py-2 text-right">Price</th>
              <th className="py-2 text-right">24h Change</th>
              <th className="py-2 text-right">24h Volume</th>
              <th className="py-2 text-right">Trade</th>
            </tr>
          </thead>
          <tbody>
            {filteredMarkets.length > 0 ? (
              filteredMarkets.map((market) => (
                <tr 
                  key={market.id} 
                  className={`text-sm border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition-colors duration-150 ${selectedMarket === market.id ? 'bg-gray-800 bg-opacity-50' : ''}`}
                  onClick={() => handleMarketSelect(market.id)}
                >
                  <td className="py-3">
                    <div className="flex items-center">
                      <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center mr-2">
                        <span className="font-bold text-xs">{market.baseAsset.slice(0, 2)}</span>
                      </div>
                      <div>
                        <div className="font-medium text-white">{market.baseAsset}/{market.quoteAsset}</div>
                        <div className="text-xs text-gray-400">{market.name}</div>
                        {market.id === MARKET_CODES.ETH_FAKE && (
                          <div className="text-xs text-blue-400 flex items-center mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-0.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Working Market
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-right font-medium text-white">${market.price}</td>
                  <td className={`py-3 text-right font-medium ${market.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {market.change}
                  </td>
                  <td className="py-3 text-right text-gray-300">${market.volume}</td>
                  <td className="py-3 text-right">
                    <button 
                      className={`px-3 py-1 text-xs rounded ${selectedMarket === market.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarketSelect(market.id);
                      }}
                    >
                      Select
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="py-4 text-center text-gray-400">
                  No markets found matching your search
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 