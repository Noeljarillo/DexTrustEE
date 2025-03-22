// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract OrderBook {
    // Event emitted when a deposit order is received.
    event OrderDeposited(
        address indexed sender,
        uint256 value,
        uint8 orderType,
        uint256 size,
        string side,
        string marketCode
    );

    function depositOrder(
        uint8 orderType,
        uint256 size,
        string calldata side,
        string calldata marketCode
    ) external payable {
        require(msg.value > 0, "Deposit must be greater than 0");

        // Emit the order details along with the sender and deposit amount.
        emit OrderDeposited(msg.sender, msg.value, orderType, size, side, marketCode);
    }
}
