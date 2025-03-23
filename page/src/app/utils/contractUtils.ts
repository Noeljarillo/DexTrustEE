import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, CHAIN_IDS } from './constants';

// ABI for the DexTrustEE contract (only the functions we need)
const dexTrustEEABI = [
  // placeEthOrder function
  {
    "inputs": [
      {
        "internalType": "uint8",
        "name": "orderType",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "size",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "side",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "marketCode",
        "type": "string"
      }
    ],
    "name": "placeEthOrder",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  // placeTokenOrder function
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "orderType",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "size",
        "type": "uint256"
      },
      {
        "internalType": "string",
        "name": "side",
        "type": "string"
      },
      {
        "internalType": "string",
        "name": "marketCode",
        "type": "string"
      }
    ],
    "name": "placeTokenOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// ABI for ERC20 token (for approve function)
const tokenABI = [
  // approve function
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "spender",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Helper to get the DexTrustEE contract
export async function getDexTrustEEContract() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed!');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  
  // Get the appropriate contract address based on the network
  let contractAddress;
  if (chainId === CHAIN_IDS.SEPOLIA) {
    contractAddress = CONTRACT_ADDRESSES.SEPOLIA.DEX_TRUSTEE;
  } else {
    throw new Error('Unsupported network. Please connect to Sepolia testnet.');
  }
  
  return new ethers.Contract(contractAddress, dexTrustEEABI, signer);
}

// Helper to get the ERC20 token contract
export async function getTokenContract(tokenAddress: string) {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed!');
  }
  
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  
  return new ethers.Contract(tokenAddress, tokenABI, signer);
}

// Place an ETH order
export async function placeEthOrder(
  orderType: number,  // 0 for limit, 1 for market
  size: number,       // size in base units
  side: string,       // "BUY" or "SELL"
  marketCode: string, // e.g., "ETH-USDT"
  ethAmount: string   // amount in ETH (as a string representing ether units)
) {
  try {
    const contract = await getDexTrustEEContract();
    const ethToWei = ethers.parseEther(ethAmount);
    
    const tx = await contract.placeEthOrder(
      orderType,
      size,
      side,
      marketCode,
      { value: ethToWei }
    );
    
    return await tx.wait();
  } catch (error) {
    console.error("Error placing ETH order:", error);
    throw error;
  }
}

// Approve tokens for the DexTrustEE contract
export async function approveTokens(
  tokenAddress: string,
  amount: string // amount as a string representing token units (will be converted to token wei)
) {
  try {
    const contract = await getDexTrustEEContract();
    const tokenContract = await getTokenContract(tokenAddress);
    const amountInWei = ethers.parseEther(amount);
    
    const tx = await tokenContract.approve(contract.target, amountInWei);
    return await tx.wait();
  } catch (error) {
    console.error("Error approving tokens:", error);
    throw error;
  }
}

// Place a token order
export async function placeTokenOrder(
  tokenAddress: string,
  amount: string,     // amount as a string representing token units
  orderType: number,  // 0 for limit, 1 for market
  size: number,       // size in base units
  side: string,       // "BUY" or "SELL"
  marketCode: string  // e.g., "ETH-USDT"
) {
  try {
    const contract = await getDexTrustEEContract();
    const amountInWei = ethers.parseEther(amount);
    
    const tx = await contract.placeTokenOrder(
      tokenAddress,
      amountInWei,
      orderType,
      size,
      side,
      marketCode
    );
    
    return await tx.wait();
  } catch (error) {
    console.error("Error placing token order:", error);
    throw error;
  }
} 