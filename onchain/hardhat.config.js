require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ;
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY;
const T1_RPC_URL = process.env.T1_RPC_URL;

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      // Local test network
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 11155111,
    },
    t1: {
      url: T1_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 299792,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      t1: 'empty'  // T1 doesn't require an actual API key
    },
    customChains: [
      {
        network: "t1",
        chainId: 299792,
        urls: {
          apiURL: "https://explorer.v006.t1protocol.com/api",
          browserURL: "https://explorer.v006.t1protocol.com"
        }
      }
    ]
  },
  paths: {
    sources: "./onchain/contracts",
    tests: "./onchain/test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};