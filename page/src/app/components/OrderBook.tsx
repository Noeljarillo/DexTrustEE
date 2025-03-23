'use client';

import { useState, useEffect } from 'react';
import { MARKET_CODES } from '../utils/constants';

// Mock data generators for different markets
const generateMockOrders = (marketId: string) => {
  const basePrice = 
    marketId === MARKET_CODES.BTC_USDT ? 61245.80 :
    marketId === MARKET_CODES.ETH_USDT ? 3124.55 :
    marketId === MARKET_CODES.SOL_USDT ? 178.32 :
    marketId === MARKET_CODES.AVAX_USDT ? 39.85 :
    marketId === MARKET_CODES.ARB_USDT ? 1.58 : 
    marketId === MARKET_CODES.ETH_FAKE ? 3100.42 :
    1000.00; // Default fallback
  
  // Generate buy orders (slightly below base price)
  const buyOrders = Array.from({ length: 7 }, (_, i) => {
    const priceDrop = (i + 1) * (basePrice * 0.0005); // Small percentage drops
    const price = basePrice - priceDrop;
    const amount = parseFloat((Math.random() * 5 + 0.5).toFixed(4));
    return {
      id: `b${i+1}`,
      price,
      amount,
      total: price * amount
    };
  }).sort((a, b) => b.price - a.price); // Sort by highest buy price first
  
  // Generate sell orders (slightly above base price)
  const sellOrders = Array.from({ length: 7 }, (_, i) => {
    const priceIncrease = (i + 1) * (basePrice * 0.0005); // Small percentage increases
    const price = basePrice + priceIncrease;
    const amount = parseFloat((Math.random() * 5 + 0.5).toFixed(4));
    return {
      id: `s${i+1}`,
      price,
      amount,
      total: price * amount
    };
  }).sort((a, b) => a.price - b.price); // Sort by lowest sell price first
  
  return { buyOrders, sellOrders, basePrice };
};

type Order = {
  id: string;
  price: number;
  amount: number;
  total: number;
};

type OrderBookProps = {
  selectedMarket?: string;
};

export function OrderBook({ selectedMarket = MARKET_CODES.ETH_USDT }: OrderBookProps) {
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [basePrice, setBasePrice] = useState(0);
  const [selectedTab, setSelectedTab] = useState<'buy' | 'sell' | 'both'>('both');
  const [depthView, setDepthView] = useState<boolean>(true);
  
  useEffect(() => {
    // In a real app, you would fetch from an API based on the selected market
    const { buyOrders, sellOrders, basePrice } = generateMockOrders(selectedMarket);
    setBuyOrders(buyOrders);
    setSellOrders(sellOrders);
    setBasePrice(basePrice);
  }, [selectedMarket]);
  
  // Format number with specific decimal places
  const formatNumber = (num: number, precision: number = 2) => {
    return num.toFixed(precision);
  };

  // Get market pair symbols
  const getMarketSymbols = () => {
    const [base, quote] = selectedMarket.split('-');
    return { base, quote };
  };
  
  const { base, quote } = getMarketSymbols();
  
  // Calculate depth for visualization (max is 100%)
  const calculateDepth = (orders: Order[], isAsk: boolean) => {
    if (orders.length === 0) return new Array(orders.length).fill(0);
    const maxTotal = Math.max(...orders.map(o => o.total));
    const percentages = orders.map(order => (order.total / maxTotal) * 100);
    return percentages;
  };
  
  const buyDepths = calculateDepth(buyOrders, false);
  const sellDepths = calculateDepth(sellOrders, true);

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-800 p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-blue-400 bg-gradient-to-r from-blue-500 to-indigo-500 text-transparent bg-clip-text">
          {base}/{quote} OrderBook
        </h2>
        <div className="flex space-x-4 items-center">
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
          <div className="flex items-center">
            <button 
              className={`text-xs flex items-center ${depthView ? 'text-blue-400' : 'text-gray-400'} hover:text-blue-300 transition-colors`}
              onClick={() => setDepthView(!depthView)}
            >
              <span className="mr-1">Depth</span>
              <svg 
                className={`h-4 w-4 transition-transform ${depthView ? 'text-blue-400' : 'text-gray-500'}`}
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden">
        <div className="grid grid-cols-3 gap-2 font-medium text-xs uppercase text-gray-400 mb-2 px-2 border-b border-gray-800 pb-2">
          <div>Price ({quote})</div>
          <div>Amount ({base})</div>
          <div>Total ({quote})</div>
        </div>

        {(selectedTab === 'sell' || selectedTab === 'both') && (
          <div className="mb-2">
            {sellOrders.map((order, index) => (
              <div key={order.id} className="grid grid-cols-3 gap-2 text-sm py-1 px-2 hover:bg-gray-800 transition-colors duration-150 rounded relative">
                {depthView && (
                  <div 
                    className="absolute inset-y-0 right-0 bg-red-500 bg-opacity-10 z-0 rounded-r"
                    style={{ width: `${typeof sellDepths === 'number' ? 0 : sellDepths[index] || 0}%` }}
                  />
                )}
                <div className="text-red-400 z-10">{formatNumber(order.price, 2)}</div>
                <div className="text-gray-300 z-10">{formatNumber(order.amount, 4)}</div>
                <div className="text-gray-300 z-10">{formatNumber(order.total, 2)}</div>
              </div>
            ))}
          </div>
        )}

        <div className="py-2 px-2 bg-gray-800 text-center font-medium mb-2 rounded border-l-4 border-blue-500 flex justify-between items-center">
          <div className="text-xs text-gray-400">
            <span className="mr-1">Spread:</span>
            <span className="text-blue-400">
              {sellOrders.length && buyOrders.length ? 
                formatNumber(sellOrders[0].price - buyOrders[0].price, 2) : '0.00'}
            </span>
          </div>
          <div>
            <span className="text-green-400 mr-1 text-lg">{formatNumber(basePrice, 2)} {quote}</span>
            <span className="text-gray-400 text-xs">Last Price</span>
          </div>
          <div className="text-xs text-gray-400">
            <span className="mr-1">24h Vol:</span>
            <span className="text-blue-400">{formatNumber(basePrice * 100, 0)} {quote}</span>
          </div>
        </div>

        {(selectedTab === 'buy' || selectedTab === 'both') && (
          <div>
            {buyOrders.map((order, index) => (
              <div key={order.id} className="grid grid-cols-3 gap-2 text-sm py-1 px-2 hover:bg-gray-800 transition-colors duration-150 rounded relative">
                {depthView && (
                  <div 
                    className="absolute inset-y-0 right-0 bg-green-500 bg-opacity-10 z-0 rounded-r"
                    style={{ width: `${typeof buyDepths === 'number' ? 0 : buyDepths[index] || 0}%` }}
                  />
                )}
                <div className="text-green-400 z-10">{formatNumber(order.price, 2)}</div>
                <div className="text-gray-300 z-10">{formatNumber(order.amount, 4)}</div>
                <div className="text-gray-300 z-10">{formatNumber(order.total, 2)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between text-xs text-gray-400">
        <div>TEE Protected Execution</div>
        <div>
          <span className="text-blue-400 mr-1">#{selectedMarket}</span>
          <span>Private OrderBook</span>
        </div>
      </div>
    </div>
  );
} 