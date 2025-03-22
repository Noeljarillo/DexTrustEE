const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderHandler", function () {
  let orderHandler;
  let testToken;
  let owner;
  let user;
  const initialSupply = ethers.parseEther("1000000");
  const depositAmount = ethers.parseEther("1000");

  beforeEach(async function () {
    // Get signers
    [owner, user] = await ethers.getSigners();
    console.log("Owner address:", owner.address);
    console.log("User address:", user.address);

    // Deploy the TestToken contract
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(initialSupply);
    await testToken.waitForDeployment();
    console.log("TestToken address:", await testToken.getAddress());
    
    // Deploy the OrderHandler contract with fully qualified name
    const OrderHandler = await ethers.getContractFactory("contracts/OrderHandler.sol:OrderHandler");
    orderHandler = await OrderHandler.deploy();
    await orderHandler.waitForDeployment();
    console.log("OrderHandler address:", await orderHandler.getAddress());

    // Transfer some tokens to the user
    await testToken.transfer(user.address, depositAmount);
    console.log("User token balance:", await testToken.balanceOf(user.address));
  });

  describe("ERC20 Deposit and Withdrawal", function () {
    it("Should allow users to deposit ERC20 tokens", async function () {
      const tokenAddress = await testToken.getAddress();
      console.log("TestToken address in test:", tokenAddress);
      
      // Approve orderHandler to spend user's tokens
      await testToken.connect(user).approve(await orderHandler.getAddress(), depositAmount);
      console.log("Approved", depositAmount.toString(), "tokens for OrderHandler");
      
      // Prepare order details
      const orderType = 1;  // Example order type
      const size = 10;      // Example size
      const side = "buy";   // Example side
      const marketCode = "ETH-USD"; // Example market
      
      // Check for OrderPlaced event emission
      await expect(orderHandler.connect(user).placeTokenOrder(
        tokenAddress,
        depositAmount,
        orderType,
        size,
        side,
        marketCode
      ))
        .to.emit(orderHandler, "OrderPlaced")
        .withArgs(
          user.address,
          tokenAddress,
          depositAmount,
          orderType,
          size,
          side,
          marketCode
        );
        
      // Verify the tokens were transferred to the contract
      expect(await testToken.balanceOf(await orderHandler.getAddress())).to.equal(depositAmount);
    });

    it("Should allow owner to withdraw ERC20 tokens", async function () {
      const tokenAddress = await testToken.getAddress();
      
      // First deposit tokens
      await testToken.connect(user).approve(await orderHandler.getAddress(), depositAmount);
      await orderHandler.connect(user).placeTokenOrder(
        tokenAddress,
        depositAmount,
        1, // orderType
        10, // size
        "buy", // side
        "ETH-USD" // marketCode
      );
      
      // Record initial balances
      const contractAddress = await orderHandler.getAddress();
      const initialContractBalance = await testToken.balanceOf(contractAddress);
      const initialOwnerBalance = await testToken.balanceOf(owner.address);
      
      // Withdraw tokens to owner
      await expect(orderHandler.connect(owner).withdraw(
        tokenAddress,
        owner.address,
        depositAmount
      ))
        .to.emit(orderHandler, "AssetWithdrawn")
        .withArgs(
          tokenAddress,
          owner.address,
          depositAmount
        );
      
      // Verify balances after withdrawal
      expect(await testToken.balanceOf(contractAddress)).to.equal(initialContractBalance - depositAmount);
      expect(await testToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + depositAmount);
    });

    it("Should revert if non-owner tries to withdraw", async function () {
      const tokenAddress = await testToken.getAddress();
      
      // First deposit tokens
      await testToken.connect(user).approve(await orderHandler.getAddress(), depositAmount);
      await orderHandler.connect(user).placeTokenOrder(
        tokenAddress,
        depositAmount,
        1, // orderType
        10, // size
        "buy", // side
        "ETH-USD" // marketCode
      );
      
      // Try to withdraw as non-owner, should fail
      await expect(orderHandler.connect(user).withdraw(
        tokenAddress,
        user.address,
        depositAmount
      )).to.be.revertedWith("Only owner can withdraw");
    });
  });
}); 