'use client';

import { useState } from 'react';

// Mock data for orderbook - in a real app, this would come from your API
const mockBuyOrders = [
  { id: 'b1', price: 1850.45, amount: 1.25, total: 2313.06 },
  { id: 'b2', price: 1849.32, amount: 0.75, total: 1386.99 },
  { id: 'b3', price: 1848.10, amount: 2.50, total: 4620.25 },
  { id: 'b4', price: 1847.75, amount: 1.00, total: 1847.75 },
  { id: 'b5', price: 1846.80, amount: 3.15, total: 5817.42 },
];

const mockSellOrders = [
  { id: 's1', price: 1851.20, amount: 0.50, total: 925.60 },
  { id: 's2', price: 1852.30, amount: 1.75, total: 3241.53 },
  { id: 's3', price: 1853.15, amount: 1.30, total: 2409.10 },
  { id: 's4', price: 1854.40, amount: 2.00, total: 3708.80 },
  { id: 's5', price: 1855.60, amount: 0.90, total: 1670.04 },
];

type Order = {
  id: string;
  price: number;
  amount: number;
  total: number;
};

export function OrderBook() {
  const [buyOrders] = useState<Order[]>(mockBuyOrders);
  const [sellOrders] = useState<Order[]>(mockSellOrders);
  const [selectedTab, setSelectedTab] = useState<'buy' | 'sell' | 'both'>('both');
  
  // Format number with 2 decimal places
  const formatNumber = (num: number, precision: number = 2) => {
    return num.toFixed(precision);
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-800 p-4 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-blue-400 bg-gradient-to-r from-blue-500 to-indigo-500 text-transparent bg-clip-text">Private TEE OrderBook</h2>
        <div className="flex bg-gray-800 rounded-md p-1">
          <button 
            className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${selectedTab === 'buy' ? 'bg-gray-700 shadow-md text-green-400' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setSelectedTab('buy')}
          >
            Buy
          </button>
          <button 
            className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${selectedTab === 'sell' ? 'bg-gray-700 shadow-md text-red-400' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setSelectedTab('sell')}
          >
            Sell
          </button>
          <button 
            className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${selectedTab === 'both' ? 'bg-gray-700 shadow-md text-blue-400' : 'text-gray-400 hover:text-gray-300'}`}
            onClick={() => setSelectedTab('both')}
          >
            Both
          </button>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="grid grid-cols-3 gap-2 font-medium text-sm text-gray-400 mb-2 px-2 border-b border-gray-800 pb-2">
          <div>Price (USD)</div>
          <div>Amount (ETH)</div>
          <div>Total (USD)</div>
        </div>

        {(selectedTab === 'sell' || selectedTab === 'both') && (
          <div className="mb-2">
            {sellOrders.map((order) => (
              <div key={order.id} className="grid grid-cols-3 gap-2 text-sm py-1 px-2 hover:bg-gray-800 transition-colors duration-150 rounded">
                <div className="text-red-400">{formatNumber(order.price, 2)}</div>
                <div className="text-gray-300">{formatNumber(order.amount, 4)}</div>
                <div className="text-gray-300">{formatNumber(order.total, 2)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="py-2 px-2 bg-gray-800 text-center font-medium mb-2 rounded border-l-4 border-blue-500">
          <span className="text-green-400 mr-1">1850.80 USD</span>
          <span className="text-gray-400 text-xs">Last Price</span>
        </div>

        {(selectedTab === 'buy' || selectedTab === 'both') && (
          <div>
            {buyOrders.map((order) => (
              <div key={order.id} className="grid grid-cols-3 gap-2 text-sm py-1 px-2 hover:bg-gray-800 transition-colors duration-150 rounded">
                <div className="text-green-400">{formatNumber(order.price, 2)}</div>
                <div className="text-gray-300">{formatNumber(order.amount, 4)}</div>
                <div className="text-gray-300">{formatNumber(order.total, 2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 