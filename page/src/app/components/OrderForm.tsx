'use client';

import { useState } from 'react';
import { useWallet } from '../providers/WalletProvider';
import { placeEthOrder, placeTokenOrder, approveTokens } from '../utils/contractUtils';
import { ORDER_TYPES, MARKET_CODES, CONTRACT_ADDRESSES } from '../utils/constants';

export function OrderForm() {
  const { isConnected, address } = useWallet();
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderMode, setOrderMode] = useState<'market' | 'limit'>('limit');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [assetType, setAssetType] = useState<'eth' | 'token'>('eth');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Calculate total based on price and amount
  const total = price && amount ? parseFloat(price) * parseFloat(amount) : 0;

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setTxHash(null);
    
    if (!isConnected) {
      setError('Please connect your wallet first');
      setIsLoading(false);
      return;
    }
    
    if (orderMode === 'limit' && !price) {
      setError('Please specify a price for limit orders');
      setIsLoading(false);
      return;
    }
    
    if (!amount) {
      setError('Please specify an amount');
      setIsLoading(false);
      return;
    }
    
    try {
      const orderModeValue = orderMode === 'market' ? ORDER_TYPES.MARKET : ORDER_TYPES.LIMIT;
      const orderSize = 100; // Define your order size logic here
      const orderSide = orderType.toUpperCase();
      const marketCode = MARKET_CODES.ETH_USDT; // Use appropriate market code
      
      let transaction;
      
      if (assetType === 'eth') {
        // Place ETH order
        transaction = await placeEthOrder(
          orderModeValue,
          orderSize,
          orderSide,
          marketCode,
          amount // ETH amount
        );
      } else {
        // For token orders, first approve then place order
        const tokenAddress = CONTRACT_ADDRESSES.SEPOLIA.TEST_TOKEN;
        
        // First approve
        await approveTokens(tokenAddress, amount);
        
        // Then place token order
        transaction = await placeTokenOrder(
          tokenAddress,
          amount,
          orderModeValue,
          orderSize,
          orderSide,
          marketCode
        );
      }
      
      setTxHash(transaction.hash);
      console.log('Transaction successful:', transaction);
      
      // Reset form on success
      setPrice('');
      setAmount('');
    } catch (err: any) {
      console.error('Transaction error:', err);
      setError(err.message || 'Transaction failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
      
      <div className="flex bg-gray-800 rounded-md p-1 mb-4">
        <button 
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${assetType === 'eth' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setAssetType('eth')}
        >
          ETH
        </button>
        <button 
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-all duration-200 ${assetType === 'token' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-300'}`}
          onClick={() => setAssetType('token')}
        >
          TEST Token
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
              required={orderMode === 'limit'}
            />
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Amount ({assetType === 'eth' ? 'ETH' : 'TEST'})
          </label>
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
            disabled={!isConnected || isLoading}
            className={`flex-1 py-2 px-4 rounded-md font-medium text-white ${
              orderType === 'buy' 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            } ${(!isConnected || isLoading) ? 'opacity-50 cursor-not-allowed' : ''} transition-colors duration-200`}
          >
            {!isConnected 
              ? 'Connect Wallet' 
              : isLoading
                ? 'Processing...'
                : `${orderMode === 'market' ? 'Market' : 'Limit'} ${orderType === 'buy' ? 'Buy' : 'Sell'}`}
          </button>
        </div>
      </form>
      
      {error && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-200 text-sm">
          {error}
        </div>
      )}
      
      {txHash && (
        <div className="mt-4 p-3 bg-green-900/30 border border-green-800 rounded-md text-green-200 text-sm">
          <p>Transaction submitted!</p>
          <a 
            href={`https://sepolia.etherscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline break-all"
          >
            View on Etherscan: {txHash.substring(0, 10)}...{txHash.substring(txHash.length - 10)}
          </a>
        </div>
      )}
    </div>
  );
} 