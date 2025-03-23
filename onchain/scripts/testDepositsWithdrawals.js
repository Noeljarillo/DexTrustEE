// Script to test deposits and withdrawals with the OrderHandler contract
const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const networkName = hre.network.name;
  console.log(`Testing deposits and withdrawals on ${networkName}...`);

  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Your address: ${deployer.address}`);
  console.log(`Network: ${networkName}`);

  // Try to get contract addresses from deployment artifacts if available
  let tokenAddress, handlerAddress;
  
  try {
    // Look for deployment artifacts
    const artifactsPath = path.join(__dirname, `../deployments/${networkName}.json`);
    if (fs.existsSync(artifactsPath)) {
      const artifacts = JSON.parse(fs.readFileSync(artifactsPath, 'utf8'));
      tokenAddress = artifacts.testToken;
      handlerAddress = artifacts.orderHandler;
      console.log("Found deployment artifacts!");
    }
  } catch (error) {
    console.log("Could not load deployment artifacts: ", error.message);
  }

  // Use provided addresses if artifacts not found
  tokenAddress = tokenAddress 
  handlerAddress = handlerAddress

  // Validate addresses
  if (tokenAddress === "YOUR_TEST_TOKEN_ADDRESS" || handlerAddress === "YOUR_ORDER_HANDLER_ADDRESS") {
    console.error("Please update the contract addresses in the script or deploy the contracts first!");
    console.error(`You can deploy the contracts using: npx hardhat run scripts/deployAndInteract.js --network ${networkName}`);
    process.exit(1);
  }

  // Connect to deployed contracts
  const testToken = await hre.ethers.getContractAt("TestToken", tokenAddress);
  const orderHandler = await hre.ethers.getContractAt("OrderHandler", handlerAddress);

  console.log("\n--- Contract Information ---");
  console.log(`TestToken address: ${tokenAddress}`);
  console.log(`OrderHandler address: ${handlerAddress}`);

  // Check for leftover funds from previous test runs and withdraw them first
  console.log("\n--- Checking for leftover funds in contract ---");
  const initialContractEthBalance = await hre.ethers.provider.getBalance(handlerAddress);
  const initialContractTokenBalance = await testToken.balanceOf(handlerAddress);
  
  console.log(`Found ETH in contract: ${hre.ethers.formatEther(initialContractEthBalance)} ETH`);
  console.log(`Found Tokens in contract: ${hre.ethers.formatEther(initialContractTokenBalance)} TEST`);
  
  // Withdraw any existing ETH
  if (initialContractEthBalance > 0) {
    console.log("\n--- Withdrawing leftover ETH from previous tests ---");
    try {
      const withdrawExistingEthTx = await orderHandler.withdraw(
        "0x0000000000000000000000000000000000000000", // address(0) for ETH
        deployer.address,
        initialContractEthBalance
      );
      await withdrawExistingEthTx.wait();
      console.log(`Initial ETH withdrawal transaction: ${withdrawExistingEthTx.hash}`);
    } catch (error) {
      console.log(`Failed to withdraw ETH: ${error.message}`);
    }
  }
  
  // Withdraw any existing tokens
  if (initialContractTokenBalance > 0) {
    console.log("\n--- Withdrawing leftover Tokens from previous tests ---");
    try {
      const withdrawExistingTokenTx = await orderHandler.withdraw(
        tokenAddress,
        deployer.address,
        initialContractTokenBalance
      );
      await withdrawExistingTokenTx.wait();
      console.log(`Initial Token withdrawal transaction: ${withdrawExistingTokenTx.hash}`);
    } catch (error) {
      console.log(`Failed to withdraw Tokens: ${error.message}`);
    }
  }

  // Check balances before operations
  const initialEthBalance = await hre.ethers.provider.getBalance(deployer.address);
  const initialTokenBalance = await testToken.balanceOf(deployer.address);
  console.log("\n--- Initial Balances ---");
  console.log(`ETH Balance: ${hre.ethers.formatEther(initialEthBalance)} ETH`);
  console.log(`Token Balance: ${hre.ethers.formatEther(initialTokenBalance)} TEST`);

  // Define test parameters
  const ethDepositAmount = hre.ethers.parseEther("0.001");
  const tokenDepositAmount = hre.ethers.parseEther("100"); // 100 TEST tokens per deposit
  const numDeposits = 20; 
  
  // Test parameters for orders
  const orderType = 1; // Market order
  const orderSize = 100; // Size in base units
  const side = "BUY"; // BUY or SELL
  const marketCode = "ETH-TST"; // Market identifier

  // Approve tokens for OrderHandler
  const totalTokensNeeded = tokenDepositAmount * BigInt(numDeposits);
  console.log(`\n--- Approving ${hre.ethers.formatEther(totalTokensNeeded)} tokens for OrderHandler ---`);
  const approveTx = await testToken.approve(handlerAddress, totalTokensNeeded);
  await approveTx.wait();
  console.log(`Approval transaction: ${approveTx.hash}`);

  // Test ETH deposits
  console.log("\n--- Testing ETH Deposits (0.1 ETH each) ---");
  for (let i = 0; i < numDeposits; i++) {
    console.log(`Making ETH deposit ${i+1}/${numDeposits}...`);
    const ethTx = await orderHandler.placeEthOrder(
      orderType,
      orderSize,
      side,
      marketCode,
      { value: ethDepositAmount }
    );
    await ethTx.wait();
    console.log(`ETH deposit transaction: ${ethTx.hash}`);
  }

  // Test ERC20 deposits
  console.log("\n--- Testing ERC20 Token Deposits ---");
  for (let i = 0; i < numDeposits; i++) {
    console.log(`Making token deposit ${i+1}/${numDeposits}...`);
    const tokenTx = await orderHandler.placeTokenOrder(
      tokenAddress,
      tokenDepositAmount,
      orderType,
      orderSize,
      side,
      marketCode
    );
    await tokenTx.wait();
    console.log(`Token deposit transaction: ${tokenTx.hash}`);
  }

  // Check contract balances
  const contractEthBalance = await hre.ethers.provider.getBalance(handlerAddress);
  const contractTokenBalance = await testToken.balanceOf(handlerAddress);
  console.log("\n--- Contract Balances After Deposits ---");
  console.log(`ETH in contract: ${hre.ethers.formatEther(contractEthBalance)} ETH`);
  console.log(`Tokens in contract: ${hre.ethers.formatEther(contractTokenBalance)} TEST`);

  // Withdraw all ETH
  console.log("\n--- Withdrawing ETH Back to Your Address ---");
  const withdrawEthTx = await orderHandler.withdraw(
    "0x0000000000000000000000000000000000000000", // address(0) for ETH
    deployer.address,
    contractEthBalance
  );
  await withdrawEthTx.wait();
  console.log(`ETH withdrawal transaction: ${withdrawEthTx.hash}`);

  // Withdraw all tokens
  console.log("\n--- Withdrawing Tokens Back to Your Address ---");
  const withdrawTokenTx = await orderHandler.withdraw(
    tokenAddress,
    deployer.address,
    contractTokenBalance
  );
  await withdrawTokenTx.wait();
  console.log(`Token withdrawal transaction: ${withdrawTokenTx.hash}`);

  // Check final balances
  const finalEthBalance = await hre.ethers.provider.getBalance(deployer.address);
  const finalTokenBalance = await testToken.balanceOf(deployer.address);
  const finalContractEthBalance = await hre.ethers.provider.getBalance(handlerAddress);
  const finalContractTokenBalance = await testToken.balanceOf(handlerAddress);
  
  console.log("\n--- Final Balances ---");
  console.log(`Your ETH Balance: ${hre.ethers.formatEther(finalEthBalance)} ETH`);
  console.log(`Your Token Balance: ${hre.ethers.formatEther(finalTokenBalance)} TEST`);
  console.log(`Contract ETH Balance: ${hre.ethers.formatEther(finalContractEthBalance)} ETH`);
  console.log(`Contract Token Balance: ${hre.ethers.formatEther(finalContractTokenBalance)} TEST`);

  // Calculate gas spent
  const ethSpent = initialEthBalance - finalEthBalance;
  console.log(`\nTotal ETH spent on gas: ${hre.ethers.formatEther(ethSpent)} ETH`);

  console.log("\n--- Test Complete ---");
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 