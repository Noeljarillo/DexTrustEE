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

    // Deploy the TestToken contract
    const TestToken = await ethers.getContractFactory("TestToken");
    testToken = await TestToken.deploy(initialSupply);
    
    // Deploy the OrderHandler contract
    const OrderHandler = await ethers.getContractFactory("OrderHandler");
    orderHandler = await OrderHandler.deploy();

    // Transfer some tokens to the user
    await testToken.transfer(user.address, depositAmount);
  });

  describe("ERC20 Deposit and Withdrawal", function () {
    it("Should allow users to deposit ERC20 tokens", async function () {
      // Approve orderHandler to spend user's tokens
      await testToken.connect(user).approve(orderHandler.address, depositAmount);
      
      // Prepare order details
      const orderType = 1;  // Example order type
      const size = 10;      // Example size
      const side = "buy";   // Example side
      const marketCode = "ETH-USD"; // Example market
      
      // Check for OrderPlaced event emission
      await expect(orderHandler.connect(user).placeTokenOrder(
        testToken.address,
        depositAmount,
        orderType,
        size,
        side,
        marketCode
      ))
        .to.emit(orderHandler, "OrderPlaced")
        .withArgs(
          user.address,
          testToken.address,
          depositAmount,
          orderType,
          size,
          side,
          marketCode
        );
        
      // Verify the tokens were transferred to the contract
      expect(await testToken.balanceOf(orderHandler.address)).to.equal(depositAmount);
    });

    it("Should allow owner to withdraw ERC20 tokens", async function () {
      // First deposit tokens
      await testToken.connect(user).approve(orderHandler.address, depositAmount);
      await orderHandler.connect(user).placeTokenOrder(
        testToken.address,
        depositAmount,
        1, // orderType
        10, // size
        "buy", // side
        "ETH-USD" // marketCode
      );
      
      // Record initial balances
      const initialContractBalance = await testToken.balanceOf(orderHandler.address);
      const initialOwnerBalance = await testToken.balanceOf(owner.address);
      
      // Withdraw tokens to owner
      await expect(orderHandler.connect(owner).withdraw(
        testToken.address,
        owner.address,
        depositAmount
      ))
        .to.emit(orderHandler, "AssetWithdrawn")
        .withArgs(
          testToken.address,
          owner.address,
          depositAmount
        );
      
      // Verify balances after withdrawal
      expect(await testToken.balanceOf(orderHandler.address)).to.equal(initialContractBalance - depositAmount);
      expect(await testToken.balanceOf(owner.address)).to.equal(initialOwnerBalance + depositAmount);
    });

    it("Should revert if non-owner tries to withdraw", async function () {
      // First deposit tokens
      await testToken.connect(user).approve(orderHandler.address, depositAmount);
      await orderHandler.connect(user).placeTokenOrder(
        testToken.address,
        depositAmount,
        1, // orderType
        10, // size
        "buy", // side
        "ETH-USD" // marketCode
      );
      
      // Try to withdraw as non-owner, should fail
      await expect(orderHandler.connect(user).withdraw(
        testToken.address,
        user.address,
        depositAmount
      )).to.be.revertedWith("Only owner can withdraw");
    });
  });
}); 