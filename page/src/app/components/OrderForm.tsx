'use client';

import { useState, useEffect } from 'react';
import { useWallet } from '../providers/WalletProvider';
import { placeEthOrder, placeTokenOrder, approveTokens } from '../utils/contractUtils';
import { ORDER_TYPES, MARKET_CODES, CONTRACT_ADDRESSES } from '../utils/constants';

type OrderFormProps = {
  selectedMarket?: string;
};

export function OrderForm({ selectedMarket = MARKET_CODES.ETH_USDT }: OrderFormProps) {
  const { isConnected, address } = useWallet();
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [orderMode, setOrderMode] = useState<'market' | 'limit'>('limit');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [total, setTotal] = useState<number>(0);
  const [assetType, setAssetType] = useState<'eth' | 'token'>('eth');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [leverage, setLeverage] = useState<number>(1);
  const [stopPrice, setStopPrice] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [amountPercentage, setAmountPercentage] = useState<number | null>(null);
  
  // Get market pair symbols
  const getMarketSymbols = () => {
    const [base, quote] = selectedMarket.split('-');
    return { base, quote };
  };
  
  const { base, quote } = getMarketSymbols();
  
  // Mock last price and 24h change
  const mockMarketData = {
    lastPrice: selectedMarket.includes('ETH-FAKE') ? 3100.42 : selectedMarket.includes('BTC') ? 61245.80 : 3124.55,
    change: selectedMarket.includes('ETH-FAKE') ? '+1.85%' : selectedMarket.includes('BTC') ? '+3.24%' : '+2.18%',
    isPositive: true,
    volume: selectedMarket.includes('ETH-FAKE') ? '87.6M' : selectedMarket.includes('BTC') ? '325.7M' : '145.3M',
  };
  
  // Update total when price or amount changes
  useEffect(() => {
    if (price && amount) {
      const calculatedTotal = parseFloat(price) * parseFloat(amount);
      setTotal(calculatedTotal);
    } else {
      setTotal(0);
    }
  }, [price, amount]);

  // Set amount based on percentage of available balance
  const handleAmountPercentage = (percent: number) => {
    setAmountPercentage(percent);
    // In a real app, this would use the actual balance
    const mockBalance = assetType === 'eth' ? 5.5 : 1000;
    const mockPrice = price ? parseFloat(price) : mockMarketData.lastPrice;
    
    if (orderType === 'buy') {
      // For buy, calculate how much base asset we can purchase with quote asset (e.g., how much ETH with USDT)
      const maxAmount = assetType === 'eth' ? mockBalance / mockPrice * percent / 100 : mockBalance * percent / 100;
      setAmount(maxAmount.toFixed(4));
    } else {
      // For sell, simply take percentage of base asset
      const maxAmount = mockBalance * percent / 100;
      setAmount(maxAmount.toFixed(4));
    }
  };

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
      const marketCode = selectedMarket; // Use the selected market
      
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
      setAmountPercentage(null);
    } catch (err: any) {
      console.error('Transaction error:', err);
      setError(err.message || 'Transaction failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate trading fee
  const tradingFee = total * 0.001; // 0.1% fee

  return (
    <div className="bg-gray-900 rounded-lg shadow-lg border border-gray-800 p-4">
      {/* Market summary header */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-gray-800 rounded-full flex items-center justify-center">
              <span className="font-bold text-xs">{base.slice(0, 2)}</span>
            </div>
            <span className="text-lg font-bold text-white">{base}/{quote}</span>
            {selectedMarket === MARKET_CODES.ETH_FAKE && (
              <span className="text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-sm">Working</span>
            )}
          </div>
          <div className="flex items-center mt-1">
            <span className="text-xl font-bold text-white">${mockMarketData.lastPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            <span className={`ml-2 text-sm ${mockMarketData.isPositive ? 'text-green-400' : 'text-red-400'}`}>{mockMarketData.change}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">24h Volume</div>
          <div className="text-sm text-white">${mockMarketData.volume}</div>
        </div>
      </div>
      
      {/* Integrated Order Type and Mode Selectors */}
      <div className="flex flex-col space-y-3 mb-5">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">TYPE</label>
            <div className="relative flex bg-gray-800 rounded-md h-10 p-0.5 w-full">
              <button 
                className={`flex-1 flex items-center justify-center text-sm font-medium rounded transition-all duration-200 ${
                  orderType === 'buy' 
                    ? 'bg-green-600 text-white shadow-sm' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setOrderType('buy')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Buy
              </button>
              <button 
                className={`flex-1 flex items-center justify-center text-sm font-medium rounded transition-all duration-200 ${
                  orderType === 'sell' 
                    ? 'bg-red-600 text-white shadow-sm' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setOrderType('sell')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Sell
              </button>
            </div>
          </div>
          
          <div>
            <label className="block text-xs text-gray-500 mb-1.5 font-medium">ORDER</label>
            <div className="relative flex bg-gray-800 rounded-md h-10 p-0.5 w-full">
              <button 
                className={`flex-1 flex items-center justify-center text-sm font-medium rounded transition-all duration-200 ${
                  orderMode === 'limit' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setOrderMode('limit')}
              >
                Limit
              </button>
              <button 
                className={`flex-1 flex items-center justify-center text-sm font-medium rounded transition-all duration-200 ${
                  orderMode === 'market' 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-gray-400 hover:text-gray-300'
                }`}
                onClick={() => setOrderMode('market')}
              >
                Market
              </button>
            </div>
          </div>
        </div>
        
        {/* Asset Type (Coin) Selector */}
        <div>
          <label className="block text-xs text-gray-500 mb-1.5 font-medium">ASSET</label>
          <div className="grid grid-cols-2 gap-2">
            <button 
              className={`h-10 transition-all duration-200 flex items-center justify-center rounded-md ${
                assetType === 'eth' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-gray-800 text-gray-400 hover:text-gray-300'
              }`}
              onClick={() => setAssetType('eth')}
            >
              <div className="flex items-center">
                <div className="h-5 w-5 rounded-full bg-gray-700 flex items-center justify-center mr-2">
                  <span className="font-bold text-xs">{base.slice(0, 2)}</span>
                </div>
                <span className="font-medium text-sm">{base}</span>
              </div>
            </button>
            <button 
              className={`h-10 transition-all duration-200 flex items-center justify-center rounded-md ${
                assetType === 'token' 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-gray-800 text-gray-400 hover:text-gray-300'
              }`}
              onClick={() => setAssetType('token')}
            >
              <div className="flex items-center">
                <div className="h-5 w-5 rounded-full bg-gray-700 flex items-center justify-center mr-2">
                  <span className="font-bold text-xs">FK</span>
                </div>
                <span className="font-medium text-sm">FAKE</span>
              </div>
            </button>
          </div>
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        {/* Available balance indicator */}
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-400">Available:</span>
          <span className="text-xs text-gray-300 font-medium">
            {assetType === 'eth' ? `5.5 ${base}` : `1000 FAKE`}
          </span>
        </div>
        
        {orderMode === 'limit' && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">Price ({quote})</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                required={orderMode === 'limit'}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <span className="text-gray-400 text-sm">{quote}</span>
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Amount ({assetType === 'eth' ? base : 'FAKE'})
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.0001"
              placeholder="0.0000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              required
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <span className="text-gray-400 text-sm">{assetType === 'eth' ? base : 'FAKE'}</span>
            </div>
          </div>
        </div>
        
        {/* Percentage selectors */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button
            type="button"
            onClick={() => handleAmountPercentage(25)}
            className={`py-1 text-xs font-medium rounded-md transition-colors ${
              amountPercentage === 25 ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            25%
          </button>
          <button
            type="button"
            onClick={() => handleAmountPercentage(50)}
            className={`py-1 text-xs font-medium rounded-md transition-colors ${
              amountPercentage === 50 ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            50%
          </button>
          <button
            type="button"
            onClick={() => handleAmountPercentage(75)}
            className={`py-1 text-xs font-medium rounded-md transition-colors ${
              amountPercentage === 75 ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            75%
          </button>
          <button
            type="button"
            onClick={() => handleAmountPercentage(100)}
            className={`py-1 text-xs font-medium rounded-md transition-colors ${
              amountPercentage === 100 ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            100%
          </button>
        </div>
        
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Total</span>
            <button 
              type="button" 
              className="text-blue-400 hover:text-blue-300 transition-all flex items-center"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>{showAdvanced ? 'Hide Advanced' : 'Advanced'}</span>
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className={`ml-1 h-4 w-4 transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="px-3 py-2 border border-gray-700 bg-gray-800 text-gray-200 rounded-md shadow-sm">
            <div className="flex justify-between">
              <span>{total.toFixed(2)}</span>
              <span className="text-gray-400">{quote}</span>
            </div>
          </div>
        </div>
        
        {/* Order summary */}
        <div className="mb-4 bg-gray-800 bg-opacity-50 rounded-md border border-gray-700 p-3">
          <h3 className="text-xs font-medium text-gray-400 mb-2">ORDER SUMMARY</h3>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Type:</span>
              <span className={`font-medium ${orderType === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                {orderType.toUpperCase()} {orderMode === 'limit' ? 'LIMIT' : 'MARKET'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Price:</span>
              <span className="text-gray-300 font-medium">
                {orderMode === 'market' ? 'Market Price' : `$${price || '0.00'}`}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Amount:</span>
              <span className="text-gray-300 font-medium">
                {amount || '0.0000'} {assetType === 'eth' ? base : 'FAKE'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Fee (0.1%):</span>
              <span className="text-gray-300 font-medium">${tradingFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs pt-1 border-t border-gray-700 mt-1">
              <span className="text-gray-400">Total:</span>
              <span className="text-white font-medium">${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        {showAdvanced && (
          <div className="mb-6 p-3 bg-gray-800 bg-opacity-50 rounded-md border border-gray-700">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Advanced Options</h3>
            
            <div className="mb-3">
              <label className="block text-xs text-gray-400 mb-1">Leverage</label>
              <div className="flex items-center">
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="1"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full mr-2 h-1 bg-gray-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                />
                <span className="text-sm min-w-[30px] text-white">{leverage}x</span>
              </div>
            </div>
            
            <div className="mb-2">
              <label className="block text-xs text-gray-400 mb-1">Stop Price ({quote})</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-gray-200 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            
            <div className="flex justify-between mt-4 pt-3 border-t border-gray-700">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="reduceOnly"
                  className="h-3 w-3 text-blue-600 focus:ring-0"
                />
                <label htmlFor="reduceOnly" className="ml-2 text-xs text-gray-300">
                  Reduce Only
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="postOnly"
                  className="h-3 w-3 text-blue-600 focus:ring-0"
                />
                <label htmlFor="postOnly" className="ml-2 text-xs text-gray-300">
                  Post Only
                </label>
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-2 bg-red-900 bg-opacity-30 border border-red-800 rounded text-red-300 text-sm">
            {error}
          </div>
        )}
        
        {txHash && (
          <div className="mb-4 p-2 bg-green-900 bg-opacity-30 border border-green-800 rounded text-green-300 text-sm">
            Transaction submitted! Hash: {txHash.slice(0, 10)}...{txHash.slice(-6)}
          </div>
        )}
        
        <button
          type="submit"
          disabled={isLoading || !isConnected}
          className={`w-full py-3 px-4 rounded-md shadow font-medium transition-all duration-200 ${
            orderType === 'buy'
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-red-600 hover:bg-red-700 text-white'
          } ${isLoading || !isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Processing...</span>
            </div>
          ) : !isConnected ? (
            'Connect Wallet'
          ) : (
            `${orderType === 'buy' ? 'Buy' : 'Sell'} ${assetType === 'eth' ? base : 'FAKE'}`
          )}
        </button>
      </form>
      
      <div className="mt-4 pt-3 border-t border-gray-800">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Fee: 0.1%</span>
          <span className="text-blue-400">TEE Protected</span>
        </div>
      </div>
    </div>
  );
} 