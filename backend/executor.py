import json
from web3 import Web3
from eth_account import Account
import time
from dotenv import load_dotenv
import os


load_dotenv()

RPC_URL = os.getenv('SEPOLIA_RPC_URL')
PRIVATE_KEY = os.getenv('PRIVATE_KEY')
CONTRACT_ADDRESS = os.getenv('CONTRACT_ADDRESS')

ABI = [
    {
        "inputs": [
            {"internalType": "address", "name": "token", "type": "address"},
            {"internalType": "address", "name": "recipient", "type": "address"},
            {"internalType": "uint256", "name": "amount", "type": "uint256"}
        ],
        "name": "withdraw",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "owner",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "stateMutability": "view",
        "type": "function"
    }
]

def execute_withdrawal(private_key, token_address, recipient_address, amount_in_ether):


    w3 = Web3(Web3.HTTPProvider(RPC_URL))
    if not w3.is_connected():
        print("Failed to connect to Ethereum network")
        return None
    
    print(f"Connected to network. Current block: {w3.eth.block_number}")
    
    # Setup account from private key
    account = Account.from_key(private_key)
    print(f"Using account: {account.address}")
    
    # Initialize contract
    contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=ABI)
    
    # Check if user is the owner
    owner = contract.functions.owner().call()
    if owner.lower() != account.address.lower():
        print(f"Error: Only the contract owner can withdraw. Owner is {owner}")
        return None
    
    # Convert amount to Wei
    amount_in_wei = w3.to_wei(amount_in_ether, 'ether')
    

    if token_address.lower() in ['0x0', '0x0000000000000000000000000000000000000000', 'eth']:
        token_address = '0x0000000000000000000000000000000000000000'
        asset_type = 'ETH'
    else:
        asset_type = 'Token'
        
    # Print withdrawal details
    print(f"\nWithdrawal Details:")
    print(f"- Asset: {asset_type}")
    print(f"- Token Address: {token_address}")
    print(f"- Recipient: {recipient_address}")
    print(f"- Amount: {amount_in_ether} ({amount_in_wei} Wei)")
    
    try:
        # Prepare transaction
        tx = contract.functions.withdraw(
            token_address,
            recipient_address,
            amount_in_wei
        ).build_transaction({
            'from': account.address,
            'nonce': w3.eth.get_transaction_count(account.address),
            'gas': 200000,  # Adjust gas as needed
            'gasPrice': w3.eth.gas_price
        })
        
        # Sign transaction
        signed_tx = w3.eth.account.sign_transaction(tx, private_key)
        
        # Send transaction
        print("\nSending transaction...")
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        tx_hash_hex = tx_hash.hex()
        print(f"Transaction sent! Hash: {tx_hash_hex}")
        

        print("Waiting for confirmation...")
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash)        

        if tx_receipt.status == 1:
            print(f"Success! Transaction confirmed in block {tx_receipt.blockNumber}")
            print(f"Gas used: {tx_receipt.gasUsed}")
            return tx_hash_hex
        else:
            print("Transaction failed!")
            return None
        
    except Exception as e:
        print(f"Error executing withdrawal: {e}")
        return None


def execute(private_key, token_address, recipient, amount):

    return execute_withdrawal(
        private_key=private_key,
        token_address=token_address, 
        recipient_address=recipient,
        amount_in_ether=amount
    )

