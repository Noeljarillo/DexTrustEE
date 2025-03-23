import sqlite3
import json
import time
import argparse
import logging
import requests
from web3 import Web3
from dotenv import load_dotenv
import os

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('listener.log')
    ]
)
logger = logging.getLogger('eth_listener')

# Load environment variables
load_dotenv()

RPC_URL = os.getenv('SEPOLIA_RPC_URL')
CONTRACT_ADDRESS = os.getenv('CONTRACT_ADDRESS')
DB_PATH = './backend/order_events.db'
TEE_URL = os.getenv('TEE_URL', 'http://172.191.42.99:8080')


ABI_JSON = '''[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":true,"internalType":"address","name":"recipient","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"AssetWithdrawn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":true,"internalType":"address","name":"token","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"},{"indexed":false,"internalType":"uint8","name":"orderType","type":"uint8"},{"indexed":false,"internalType":"uint256","name":"size","type":"uint256"},{"indexed":false,"internalType":"string","name":"side","type":"string"},{"indexed":false,"internalType":"string","name":"marketCode","type":"string"}],"name":"OrderPlaced","type":"event"},{"stateMutability":"payable","type":"fallback"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint8","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"size","type":"uint256"},{"internalType":"string","name":"side","type":"string"},{"internalType":"string","name":"marketCode","type":"string"}],"name":"placeEthOrder","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint8","name":"orderType","type":"uint8"},{"internalType":"uint256","name":"size","type":"uint256"},{"internalType":"string","name":"side","type":"string"},{"internalType":"string","name":"marketCode","type":"string"}],"name":"placeTokenOrder","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"},{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}]'''
ABI = json.loads(ABI_JSON)


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS order_placed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_number INTEGER,
        transaction_hash TEXT,
        sender TEXT,
        token TEXT,
        amount TEXT,
        order_type INTEGER,
        size TEXT,
        side TEXT,
        market_code TEXT,
        timestamp INTEGER
    )
    ''')
    

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS asset_withdrawn (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_number INTEGER,
        transaction_hash TEXT,
        token TEXT,
        recipient TEXT,
        amount TEXT,
        timestamp INTEGER
    )
    ''')
    

    cursor.execute('''
    CREATE TABLE IF NOT EXISTS last_processed_block (
        id INTEGER PRIMARY KEY,
        block_number INTEGER
    )
    ''')
    
    conn.commit()
    conn.close()
    logger.info("Database initialized successfully.")


def save_last_processed_block(block_number):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM last_processed_block')
    cursor.execute('INSERT INTO last_processed_block (id, block_number) VALUES (1, ?)', (block_number,))
    
    conn.commit()
    conn.close()


def get_last_processed_block():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT block_number FROM last_processed_block WHERE id = 1')
    result = cursor.fetchone()
    
    conn.close()
    
    if result:
        return result[0]
    return None


def handle_order_placed(event, w3):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    block = w3.eth.get_block(event['blockNumber'])
    timestamp = block.timestamp
    
    cursor.execute('''
    INSERT INTO order_placed (
        block_number, transaction_hash, sender, token, amount, order_type, 
        size, side, market_code, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        event['blockNumber'],
        event['transactionHash'].hex(),
        event['args']['sender'],
        event['args']['token'],
        str(event['args']['amount']),
        event['args']['orderType'],
        str(event['args']['size']),
        event['args']['side'],
        event['args']['marketCode'],
        timestamp
    ))
    
    conn.commit()
    conn.close()
    
    # Post order to TEE
    try:
        # Map blockchain order parameters to TEE API parameters
        # The order_type from the blockchain is a uint8, convert it to 'limit' or 'market'
        order_type = 'limit' if event['args']['orderType'] == 0 else 'market'
        
        # Use Web3 to convert the amount to a more readable format (ETH instead of Wei)
        # This might need adjustment depending on token decimals
        price = 100  # Default price for market orders
        quantity = float(w3.from_wei(event['args']['size'], 'ether'))
        
        # For limit orders, try to extract price from market code or other parameters
        # This is a placeholder logic - adjust based on your actual implementation
        if order_type == 'limit' and ':' in event['args']['marketCode']:
            try:
                price = float(event['args']['marketCode'].split(':')[1])
            except (IndexError, ValueError):
                logger.warning(f"Couldn't extract price from market code: {event['args']['marketCode']}")
        
        tee_payload = {
            'user': event['args']['sender'],
            'type': order_type,
            'side': event['args']['side'].lower(),  # Ensure lowercase for API compatibility
            'quantity': quantity
        }
        
        # Add price for limit orders
        if order_type == 'limit':
            tee_payload['price'] = price
        
        logger.info(f"Posting order to TEE: {tee_payload}")
        tee_response = requests.post(
            f"{TEE_URL}/order", 
            params=tee_payload
        )
        
        if tee_response.status_code == 200:
            order_id = tee_response.json().get('order_id')
            logger.info(f"Order successfully posted to TEE. Order ID: {order_id}")
        else:
            logger.error(f"Failed to post order to TEE: Status {tee_response.status_code}, Response: {tee_response.text}")
    
    except Exception as e:
        logger.error(f"Error posting order to TEE: {str(e)}")
    
    logger.info(f"OrderPlaced event saved: TX {event['transactionHash'].hex()} in block {event['blockNumber']}")


def handle_asset_withdrawn(event, w3):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    block = w3.eth.get_block(event['blockNumber'])
    timestamp = block.timestamp
    
    cursor.execute('''
    INSERT INTO asset_withdrawn (
        block_number, transaction_hash, token, recipient, amount, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        event['blockNumber'],
        event['transactionHash'].hex(),
        event['args']['token'],
        event['args']['recipient'],
        str(event['args']['amount']),
        timestamp
    ))
    
    conn.commit()
    conn.close()
    
    logger.info(f"AssetWithdrawn event saved: TX {event['transactionHash'].hex()} in block {event['blockNumber']}")


def process_blocks(contract, w3, from_block, to_block):
    logger.info(f"Processing blocks {from_block} to {to_block}")
    

    order_placed_events = contract.events.OrderPlaced().get_logs(
        from_block=from_block, to_block=to_block
    )
    

    asset_withdrawn_events = contract.events.AssetWithdrawn().get_logs(
        from_block=from_block, to_block=to_block
    )
    

    for event in order_placed_events:
        handle_order_placed(event, w3)
    
    for event in asset_withdrawn_events:
        handle_asset_withdrawn(event, w3)
    
    total_events = len(order_placed_events) + len(asset_withdrawn_events)
    if total_events > 0:
        logger.info(f"Processed {len(order_placed_events)} OrderPlaced and {len(asset_withdrawn_events)} AssetWithdrawn events")
    else:
        logger.info("No new events found")
    

    save_last_processed_block(to_block)
    
    return to_block


def setup_web3():
    try:
        w3 = Web3(Web3.HTTPProvider(RPC_URL))
        

        try:
            from web3.middleware import geth_poa_middleware
            w3.middleware_onion.inject(geth_poa_middleware, layer=0)
        except ImportError:
            try:
                from web3.middleware.geth import geth_poa_middleware
                w3.middleware_onion.inject(geth_poa_middleware, layer=0)
            except ImportError:
                print("Could not import geth_poa_middleware, continuing without it")
        
        if not w3.is_connected():
            logger.error("Failed to connect to Ethereum network")
            return None, None
        
        logger.info(f"Connected to Ethereum network. Current block: {w3.eth.block_number}")
        

        contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=ABI)
        
        return w3, contract
    except Exception as e:
        logger.error(f"Error setting up Web3: {str(e)}")
        return None, None


def initialize_and_process_events():

    init_db()
    

    w3, contract = setup_web3()
    if not w3 or not contract:
        return None
    

    current_block = w3.eth.block_number
    

    last_block = get_last_processed_block()
    if last_block is None:
        start_block = max(1, current_block - 100)
    else:
        start_block = last_block + 1
    

    if start_block <= current_block:
        last_block = process_blocks(contract, w3, start_block, current_block)
    else:
        print(f"No new blocks to process. Last processed: {start_block-1}, Current: {current_block}")
        last_block = current_block
    
    return {
        'web3': w3,
        'contract': contract,
        'last_processed_block': last_block
    }


def fetch_tee_trades():
    """Fetch executed trades from the TEE."""
    try:
        response = requests.get(f"{TEE_URL}/trades")
        if response.status_code == 200:
            trades = response.json()
            logger.info(f"Successfully fetched {len(trades)} trades from TEE")
            return trades
        else:
            logger.error(f"Failed to fetch trades from TEE: Status {response.status_code}, Response: {response.text}")
            return []
    except Exception as e:
        logger.error(f"Error fetching trades from TEE: {str(e)}")
        return []


def reconcile_trades():
    """Reconcile trades between blockchain events and TEE trades.
    
    This function can be called periodically to check for trades that have been executed
    in the TEE but haven't been settled on-chain yet.
    """
    trades = fetch_tee_trades()
    if not trades:
        logger.info("No trades to reconcile")
        return
    
    # In a real implementation, you would:
    # 1. Check which trades have been executed in the TEE but not yet on-chain
    # 2. Initiate on-chain settlement for those trades
    # 3. Update the local database to mark those trades as reconciled
    
    # For now, we'll just log the trades
    logger.info(f"Trades to reconcile: {trades}")
    
    # TODO: Implement actual reconciliation logic
    # This might involve calling the executor.py to send on-chain transactions
    # for each trade that needs settlement


def start_polling(duration_seconds=None):
    """Start polling for new events.
    
    Args:
        duration_seconds: How long to poll in seconds. If None, runs indefinitely.
    """
    context = initialize_and_process_events()
    if not context:
        logger.error("Failed to initialize")
        return "Failed to initialize"
    
    w3 = context['web3']
    contract = context['contract']
    last_processed_block = context['last_processed_block']
    
    start_time = time.time()
    end_time = start_time + duration_seconds if duration_seconds else float('inf')
    
    try:
        logger.info(f"Starting polling loop for {'indefinite time' if duration_seconds is None else f'{duration_seconds} seconds'}")
        while time.time() < end_time:
            try:
                logger.debug("Waiting 15 seconds before next check...")
                time.sleep(15)
                
                # Reconcile trades every polling cycle
                reconcile_trades()
                
                current_block = w3.eth.block_number
                
                if last_processed_block < current_block:
                    last_processed_block = process_blocks(
                        contract, w3, last_processed_block + 1, current_block
                    )
                else:
                    logger.debug(f"No new blocks. Still at block {current_block}")
            except Exception as e:
                logger.error(f"Error in polling loop: {str(e)}")
                logger.info("Attempting to reconnect in 30 seconds...")
                time.sleep(30)
                # Try to reconnect
                new_context = initialize_and_process_events()
                if new_context:
                    w3 = new_context['web3']
                    contract = new_context['contract']
                    last_processed_block = new_context['last_processed_block']
        
        if duration_seconds:
            logger.info(f"Polling completed after {duration_seconds} seconds")
        return "Polling completed"
    
    except KeyboardInterrupt:
        logger.info("Polling stopped by user")
        return "Polling stopped by user"
    except Exception as e:
        logger.error(f"Error during polling: {str(e)}")
        return f"Error: {str(e)}"

def test_tee_integration(order_type="limit", side="buy", price=100, quantity=0.2):
    """Test the TEE integration by simulating an order and posting it to the TEE.
    
    Args:
        order_type: Either 'limit' or 'market'
        side: Either 'buy' or 'sell'
        price: The price for limit orders (ignored for market orders)
        quantity: The quantity of the order
    
    Returns:
        The response from the TEE, or None if there was an error
    """
    try:
        # Prepare the payload
        tee_payload = {
            'user': "0x" + "0" * 40,  # Dummy address
            'type': order_type,
            'side': side,
            'quantity': quantity
        }
        
        # Add price for limit orders
        if order_type.lower() == 'limit':
            tee_payload['price'] = price
        
        logger.info(f"Testing TEE integration with payload: {tee_payload}")
        
        # Send the order to the TEE
        response = requests.post(
            f"{TEE_URL}/order", 
            params=tee_payload
        )
        
        if response.status_code == 200:
            order_id = response.json().get('order_id')
            logger.info(f"Test order successfully posted to TEE. Order ID: {order_id}")
            
            # Fetch trades to see if any were created
            trades = fetch_tee_trades()
            logger.info(f"Current trades after test order: {trades}")
            
            return response.json()
        else:
            logger.error(f"Failed to post test order to TEE: Status {response.status_code}, Response: {response.text}")
            return None
    
    except Exception as e:
        logger.error(f"Error testing TEE integration: {str(e)}")
        return None


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description='Ethereum Event Listener')
    parser.add_argument('--duration', type=int, default=None, 
                        help='Duration in seconds to run the listener. If not provided, runs indefinitely.')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
                        default='INFO', help='Set the logging level')
    parser.add_argument('--test-tee', action='store_true',
                        help='Test the TEE integration with a simulated order')
    parser.add_argument('--order-type', choices=['limit', 'market'], default='limit',
                        help='Order type for testing (limit or market)')
    parser.add_argument('--side', choices=['buy', 'sell'], default='buy',
                        help='Order side for testing (buy or sell)')
    parser.add_argument('--price', type=float, default=100.0,
                        help='Price for limit orders (ignored for market orders)')
    parser.add_argument('--quantity', type=float, default=0.2,
                        help='Quantity for the test order')
    
    args = parser.parse_args()
    
    # Set log level
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    # Test the TEE integration if requested
    if args.test_tee:
        result = test_tee_integration(
            order_type=args.order_type,
            side=args.side,
            price=args.price,
            quantity=args.quantity
        )
        if result:
            print(f"Test successful! Response: {result}")
        else:
            print("Test failed. Check the logs for details.")
        return

    return start_polling(duration_seconds=args.duration)

if __name__ == "__main__":
    main() 