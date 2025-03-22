// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OrderHandler {
    address public immutable owner;
    
    struct Order {
        uint8 orderType;
        uint256 size;
        string side;
        string marketCode;
    }
    
    event OrderPlaced(
        address indexed sender,
        address indexed token,
        uint256 amount,
        uint8 orderType,
        uint256 size,
        string side,
        string marketCode
    );
    
    event AssetWithdrawn(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    
    constructor() {
        owner = msg.sender;
    }
    
    // For ETH deposits
    function placeEthOrder(
        uint8 orderType,
        uint256 size,
        string memory side,
        string memory marketCode
    ) external payable {
        require(msg.value > 0, "Must send ETH");
        
        emit OrderPlaced(
            msg.sender,
            address(0),
            msg.value,
            orderType,
            size,
            side,
            marketCode
        );
    }
    
    // For ERC20 deposits
    function placeTokenOrder(
        address token,
        uint256 amount,
        uint8 orderType,
        uint256 size,
        string memory side,
        string memory marketCode
    ) external {
        require(token != address(0), "Invalid token address");
        require(amount > 0, "Amount must be positive");
        
        // Transfer tokens to this contract
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature(
                "transferFrom(address,address,uint256)",
                msg.sender,
                address(this),
                amount
            )
        );
        
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Token transfer failed");
        
        emit OrderPlaced(
            msg.sender,
            token,
            amount,
            orderType,
            size,
            side,
            marketCode
        );
    }
    
    // For owner withdrawals
    function withdraw(address token, address recipient, uint256 amount) external {
        require(msg.sender == owner, "Only owner can withdraw");
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        
        if (token == address(0)) {
            // Withdraw ETH
            require(address(this).balance >= amount, "Insufficient ETH balance");
            (bool sent, ) = payable(recipient).call{value: amount}("");
            require(sent, "ETH transfer failed");
        } else {
            // Withdraw ERC20 tokens
            (bool success, bytes memory data) = token.call(
                abi.encodeWithSignature(
                    "transfer(address,uint256)",
                    recipient,
                    amount
                )
            );
            require(success && (data.length == 0 || abi.decode(data, (bool))), "Token transfer failed");
        }
        
        emit AssetWithdrawn(token, recipient, amount);
    }
    

    receive() external payable {}
    
    // Fallback function
    fallback() external payable {}
} 