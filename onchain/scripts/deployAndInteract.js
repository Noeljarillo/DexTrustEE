// Script to deploy OrderHandler and TestToken contracts and interact with them
const hre = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const networkName = hre.network.name;
  console.log(`Deploying the TestToken and OrderHandler contracts to ${networkName}...`);

  // Get signers
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deployer address: ${deployer.address}`);
  console.log(`Network: ${networkName}`);

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

  // Save deployment information to a file
  const deploymentData = {
    network: networkName,
    deployer: deployer.address,
    testToken: tokenAddress,
    orderHandler: handlerAddress,
    deploymentTime: new Date().toISOString()
  };

  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)){
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  // Write deployment information to a JSON file
  const deploymentPath = path.join(deploymentsDir, `${networkName}.json`);
  fs.writeFileSync(
    deploymentPath,
    JSON.stringify(deploymentData, null, 2)
  );
  console.log(`Deployment information saved to ${deploymentPath}`);

  console.log("Deployment complete! Contract addresses:");
  console.log(`- TestToken: ${tokenAddress}`);
  console.log(`- OrderHandler: ${handlerAddress}`);
  
  // Network-specific verification instructions
  if (networkName === "sepolia") {
    console.log("Verify contracts on Sepolia Etherscan with:");
    console.log(`npx hardhat verify --network sepolia ${tokenAddress} ${initialSupply}`);
    console.log(`npx hardhat verify --network sepolia ${handlerAddress}`);
  } else if (networkName === "t1") {
    console.log("Contracts deployed on T1 network");
    console.log(`If verification is supported on T1, use:`);
    console.log(`npx hardhat verify --network t1 ${tokenAddress} ${initialSupply}`);
    console.log(`npx hardhat verify --network t1 ${handlerAddress}`);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 