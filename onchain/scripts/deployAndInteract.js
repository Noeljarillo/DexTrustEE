// Script to deploy OrderHandler and TestToken contracts and interact with them
const hre = require("hardhat");

async function main() {
  console.log("Deploying the TestToken and OrderHandler contracts to Sepolia...");

  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Network: ${hre.network.name}`);

  // Deploy TestToken with initial supply
  const initialSupply = hre.ethers.parseEther("1000000");
  const TestToken = await hre.ethers.getContractFactory("TestToken");
  const testToken = await TestToken.deploy(initialSupply);
  await testToken.waitForDeployment();
  const tokenAddress = await testToken.getAddress();
  console.log(`TestToken deployed to: ${tokenAddress}`);

  // Deploy OrderHandler contract
  const OrderHandler = await hre.ethers.getContractFactory("OrderHandler");
  const orderHandler = await OrderHandler.deploy();
  await orderHandler.waitForDeployment();
  const handlerAddress = await orderHandler.getAddress();
  console.log(`OrderHandler deployed to: ${handlerAddress}`);

  console.log("Deployment complete! Contract addresses:");
  console.log(`- TestToken: ${tokenAddress}`);
  console.log(`- OrderHandler: ${handlerAddress}`);
  console.log("Verify contracts on Sepolia Etherscan with:");
  console.log(`npx hardhat verify --network sepolia ${tokenAddress} ${initialSupply}`);
  console.log(`npx hardhat verify --network sepolia ${handlerAddress}`);
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 