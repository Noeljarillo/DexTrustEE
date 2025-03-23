'use client';

import { useState } from 'react';
import { useWallet } from '../providers/WalletProvider';

export function OrderForm() {
  const { isConnected } = useWallet();
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderMode, setOrderMode] = useState<'market' | 'limit'>('limit');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  
  // Calculate total based on price and amount
  const total = price && amount ? parseFloat(price) * parseFloat(amount) : 0;

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }
    
    if (orderMode === 'limit' && !price) {
      alert('Please specify a price for limit orders');
      return;
    }
    
    if (!amount) {
      alert('Please specify an amount');
      return;
    }
    
    // Here you would submit the order to your TEE orderbook backend
    console.log('Submitting order:', {
      type: orderType,
      mode: orderMode,
      price: orderMode === 'market' ? 'market price' : parseFloat(price),
      amount: parseFloat(amount),
      total: orderMode === 'market' ? 'determined at execution' : total
    });
    
    // Reset form
    setPrice('');
    setAmount('');
  };

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-800 p-4 max-w-md mx-auto mt-6">
      <h2 className="text-xl font-semibold text-blue-400 bg-gradient-to-r from-blue-500 to-indigo-500 text-transparent bg-clip-text mb-4">Place Order</h2>
      
      <div className="flex bg-gray-800 rounded-md p-1 mb-4">
        <button 
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${orderType === 'buy' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setOrderType('buy')}
        >
          Buy
        </button>
        <button 
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${orderType === 'sell' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setOrderType('sell')}
        >
          Sell
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        {orderMode === 'limit' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">Price (USD)</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">Amount (ETH)</label>
          <input
            type="number"
            step="0.0001"
            placeholder="0.0000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            required
          />
        </div>
        
        {orderMode === 'limit' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">Total (USD)</label>
            <div className="w-full px-3 py-2 border border-gray-700 rounded-md bg-gray-800 text-gray-200">
              {total.toFixed(2)}
            </div>
          </div>
        )}
        
        <div className="flex items-center gap-4 mb-4">
          <div className="flex bg-gray-800 rounded-md p-1 flex-grow-0">
            <button 
              type="button"
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${orderMode === 'market' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
              onClick={() => setOrderMode('market')}
            >
              Market
            </button>
            <button 
              type="button"
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-200 ${orderMode === 'limit' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
              onClick={() => setOrderMode('limit')}
            >
              Limit
            </button>
          </div>
          
          <button
            type="submit"
            disabled={!isConnected}
            className={`flex-1 py-2 px-4 rounded-md font-medium text-white ${
              orderType === 'buy' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''} transition-colors duration-200`}
          >
            {!isConnected 
              ? 'Connect Wallet' 
              : `${orderMode === 'market' ? 'Market' : 'Limit'} ${orderType === 'buy' ? 'Buy' : 'Sell'}`}
          </button>
        </div>
      </form>
    </div>
  );
} 