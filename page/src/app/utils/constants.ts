// Contract addresses (update these with your actual deployed addresses)
export const CONTRACT_ADDRESSES = {
  // Sepolia testnet
  SEPOLIA: {
    DEX_TRUSTEE: "0x6e70b715531BC3aAbD5F26762973d8A1070c5bFD", 
    TEST_TOKEN: "0x77f369477A0140b30D359741F8720EE23f03eBD7"  
  }
};

// Order types
export const ORDER_TYPES = {
  LIMIT: 0,
  MARKET: 1
};

// Market codes
export const MARKET_CODES = {
  ETH_USDT: "ETH-USDT",
  BTC_USDT: "BTC-USDT",
  SOL_USDT: "SOL-USDT",
  AVAX_USDT: "AVAX-USDT",
  ARB_USDT: "ARB-USDT",
  ETH_FAKE: "ETH-FAKE"
};

// Chain IDs
export const CHAIN_IDS = {
  SEPOLIA: 11155111
};

// Market categories
export const MARKET_CATEGORIES = {
  ALL: 'all',
  DEFI: 'defi',
  LAYER1: 'layer1'
};

// Etherscan URLs
export const ETHERSCAN_URLS = {
  SEPOLIA: 'https://sepolia.etherscan.io'
};

// Helper function to create Etherscan transaction link
export const getEtherscanTxLink = (txHash: string, chainId: number = CHAIN_IDS.SEPOLIA): string => {
  // Default to Sepolia
  const baseUrl = ETHERSCAN_URLS.SEPOLIA;
  return `${baseUrl}/tx/${txHash}`;
}; 