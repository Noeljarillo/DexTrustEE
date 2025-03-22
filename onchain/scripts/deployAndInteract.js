// Script to deploy OrderHandler and TestToken contracts and interact with them
const hre = require("hardhat");

async function main() {
  console.log("Deploying the TestToken and OrderHandler contracts...");

  // Get signers
  const [deployer, user] = await hre.ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`User address: ${user.address}`);

  // Deploy TestToken with initial supply
  const initialSupply = hre.ethers.parseEther("1000000");
  const TestToken = await hre.ethers.getContractFactory("TestToken");
  const testToken = await TestToken.deploy(initialSupply);
  await testToken.waitForDeployment();
  const tokenAddress = await testToken.getAddress();
  console.log(`TestToken deployed to: ${tokenAddress}`);

  // Deploy OrderHandler contract
  const OrderHandler = await hre.ethers.getContractFactory("contracts/OrderHandler.sol:OrderHandler");
  const orderHandler = await OrderHandler.deploy();
  await orderHandler.waitForDeployment();
  const handlerAddress = await orderHandler.getAddress();
  console.log(`OrderHandler deployed to: ${handlerAddress}`);

  // Transfer some tokens to the user
  const transferAmount = hre.ethers.parseEther("10000");
  await testToken.transfer(user.address, transferAmount);
  console.log(`Transferred ${hre.ethers.formatEther(transferAmount)} tokens to ${user.address}`);
  console.log(`User token balance: ${hre.ethers.formatEther(await testToken.balanceOf(user.address))}`);

  // Place an order with the tokens
  const depositAmount = hre.ethers.parseEther("5000");
  
  // First approve the OrderHandler to transfer tokens
  await testToken.connect(user).approve(handlerAddress, depositAmount);
  console.log(`Approved OrderHandler to spend ${hre.ethers.formatEther(depositAmount)} tokens from user`);
  
  // Place the token order
  const orderType = 1; // Example order type
  const size = 10;     // Example size
  const side = "buy";  // Example side
  const marketCode = "ETH-USD"; // Example market code
  
  const placeOrderTx = await orderHandler.connect(user).placeTokenOrder(
    tokenAddress,
    depositAmount,
    orderType,
    size,
    side,
    marketCode
  );
  await placeOrderTx.wait();
  console.log(`Order placed with ${hre.ethers.formatEther(depositAmount)} tokens`);
  
  // Check OrderHandler token balance
  const handlerBalance = await testToken.balanceOf(handlerAddress);
  console.log(`OrderHandler token balance: ${hre.ethers.formatEther(handlerBalance)}`);
  
  // Owner withdraws tokens
  const withdrawTx = await orderHandler.connect(deployer).withdraw(
    tokenAddress,
    deployer.address,
    handlerBalance
  );
  await withdrawTx.wait();
  console.log(`Owner withdrew ${hre.ethers.formatEther(handlerBalance)} tokens from OrderHandler`);
  
  // Verify final balances
  console.log(`OrderHandler final balance: ${hre.ethers.formatEther(await testToken.balanceOf(handlerAddress))}`);
  console.log(`Owner final balance: ${hre.ethers.formatEther(await testToken.balanceOf(deployer.address))}`);
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 