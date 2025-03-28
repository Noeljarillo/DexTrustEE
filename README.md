#  BlackBook

![BlackBook Logo](logobb.png)

## Secure Decentralized Exchange with Trusted Execution Environments

![Built for ETH Global](https://img.shields.io/badge/Built%20for-ETH%20Global-blue)

BlackBook combines the transparency of blockchain with the privacy of secure enclaves to create a revolutionary decentralized exchange platform. Our solution leverages Intel SGX (Software Guard Extensions) technology to execute trades in a trusted and secure environment.

[View Presentation](https://docs.google.com/presentation/d/1234567890/edit)
## ✨ Key Features

- 🔒 **Secure Trade Execution**: Orders processed in trusted SGX enclaves
- 🌐 **On-chain Settlement**: All transactions settled transparently on Ethereum
- 💰 **Multi-asset Support**: Trade with ETH and ERC-20 tokens
- ⚡ **Fast Order Processing**: Efficient off-chain order matching
- 🛡️ **Privacy-Preserving**: Order details protected until execution

## 🏗️ Architecture

![DexTrustEE Architecture](diagram.png)

BlackBook consists of three main components:

1. **Smart Contracts**: Handle deposits, withdrawals, and settlement on-chain
2. **Event Listener**: Monitors blockchain for new orders and other events
3. **Secure Enclave**: Executes trades in a trusted environment using Intel SGX
4. **On chain settlement**: Settles trades on-chain

## ⚡ T1 Protocol Integration

BlackBook is deployed on T1 Protocol - [View Contract on T1 Scan Explorer](https://explorer.v006.t1protocol.com/address/0x934F38B0B492d77bdD4d2e5800476e514fe89437?tab=contract), leveraging its incredible fast block times to enhance our DEX capabilities:

- **Increased Throughput**: T1's superior block time dramatically increases the maximum number of orders processed per second compared to Ethereum mainnet
- **Rapid Order Matching**: Eliminates slowness inherent in Ethereum's block time, enabling near-instant trade matching
- **Dual Attestation**: Enables double attestation for both on-chain and off-chain computation, enhancing security guarantees
- **Cost Efficiency**: Lower gas costs for trade settlement and other operations
- **Complementary to TEE**: Works alongside our Trusted Execution Environment to create a truly secure yet high-performance trading platform

This technology integration allows BlackBook to achieve the security benefits of decentralization while maintaining the performance characteristics traders expect from centralized platforms.

## Order Book Design
The order book implementation is separated into two components:

1. **Trusted Environment**: The order book is implemented in a trusted environment using Intel SGX. This ensures that the order book is secure and tamper-resistant. Calculations and data are store in the enclave. This order book supports market and limit orders.
2. **Application Layer**: The application layer consists of an API written in C++, and includes 3 endpoints: 
    - Create order
    - Read trades
    - Read trades per user

From the application layer the back-end is able to read the trades from the trusted environment and execute the transactions on-chain.

![alt text](image.png)

## 💡 Built at ETH Global

BlackBook was developed during ETH Global hackathon, combining the best of blockchain technology with trusted execution environments to solve real-world problems in decentralized finance.

## 📄 License

MIT 