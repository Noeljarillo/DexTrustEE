import sqlite3
import json
import time
import argparse
import logging
from web3 import Web3
from dotenv import load_dotenv
import os
import requests
from decimal import Decimal
from requests.exceptions import RequestException

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

# Add TEE API endpoint to environment variables
TEE_API_ENDPOINT = os.getenv('TEE_API_ENDPOINT', 'http://172.191.42.99:8080')
TEE_API_TIMEOUT = int(os.getenv('TEE_API_TIMEOUT', '30'))  # Timeout in seconds
TEE_API_MAX_RETRIES = int(os.getenv('TEE_API_MAX_RETRIES', '3'))  # Maximum number of retry attempts
TEE_API_RETRY_DELAY = int(os.getenv('TEE_API_RETRY_DELAY', '5'))  # Delay between retries in seconds

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
    """Handle an OrderPlaced event by saving it to the database and forwarding to TEE."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    block = w3.eth.get_block(event['blockNumber'])
    timestamp = block.timestamp
    
    # Save the event to the database
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
    
    logger.info(f"OrderPlaced event saved: TX {event['transactionHash'].hex()} in block {event['blockNumber']}")
    
    # Forward order to TEE
    try:
        # Validate event data before forwarding
        validate_order_event(event)
        # Forward to TEE
        order_id = forward_order_to_tee(event)
        logger.info(f"Successfully forwarded order to TEE. Order ID: {order_id}")
    except Exception as e:
        logger.error(f"Failed to forward order to TEE: {str(e)}")


def validate_order_event(event):
    """Validate that an order event has all required fields with valid values."""
    required_fields = ['sender', 'token', 'amount', 'orderType', 'size', 'side', 'marketCode']
    
    # Check that all required fields exist
    for field in required_fields:
        if field not in event['args']:
            raise ValueError(f"Missing required field '{field}' in order event")
    
    # Validate sender address
    if not Web3.is_address(event['args']['sender']):
        raise ValueError(f"Invalid sender address: {event['args']['sender']}")
    
    # Validate token address
    if not Web3.is_address(event['args']['token']):
        raise ValueError(f"Invalid token address: {event['args']['token']}")
    
    # Validate amount and size are non-negative
    if int(event['args']['amount']) < 0:
        raise ValueError(f"Invalid negative amount: {event['args']['amount']}")
    
    if int(event['args']['size']) <= 0:
        raise ValueError(f"Invalid size (must be positive): {event['args']['size']}")
    
    # Validate order type
    order_type = event['args']['orderType']
    if order_type not in [0, 1]:  # Assuming 0=market, 1=limit
        raise ValueError(f"Invalid order type: {order_type}")
    
    # Validate side
    side = event['args']['side'].lower()
    if side not in ['buy', 'sell']:
        raise ValueError(f"Invalid order side: {side}")
    
    # Ensure market code is not empty
    if not event['args']['marketCode']:
        raise ValueError("Market code cannot be empty")
    
    return True


def retry_request(func, *args, max_retries=TEE_API_MAX_RETRIES, retry_delay=TEE_API_RETRY_DELAY, **kwargs):
    """Retry a function call with exponential backoff."""
    last_exception = None
    for attempt in range(max_retries):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            last_exception = e
            delay = retry_delay * (2 ** attempt)  # Exponential backoff
            logger.warning(f"Attempt {attempt + 1}/{max_retries} failed: {str(e)}. Retrying in {delay} seconds...")
            time.sleep(delay)
    
    # If we've exhausted all retries, raise the last exception
    logger.error(f"All {max_retries} attempts failed. Last error: {str(last_exception)}")
    raise last_exception


def forward_order_to_tee(event):
    """Forward an order from the blockchain to the TEE."""
    # Map order_type from the contract to what the TEE expects
    # Assuming: 0 = limit, 1 = market, etc. (corrected mapping)
    order_type_mapping = {
        1: 'market',
        0: 'limit'
        # Add more mappings as needed
    }
    
    # Extract data from the event
    sender = event['args']['sender']
    order_type_value = event['args']['orderType']
    order_type = order_type_mapping.get(order_type_value, 'limit')
    side = event['args']['side'].lower()  # Ensure side is lowercase (buy/sell)
    
    # Get the size (quantity) and ensure proper decimal format
    size = event['args']['size']
    quantity = str(Decimal(str(size)))
    
    # Build the base URL with common parameters
    url = f"{TEE_API_ENDPOINT}/order?user={sender}&type={order_type}&side={side}&quantity={quantity}"
    
    # Only add price for limit orders
    if order_type == 'limit':
        try:
            # For limit orders, use the amount field as the price
            price = str(Decimal(str(event['args']['amount'])))
            
            # Ensure proper decimal format without scientific notation
            price_decimal = Decimal(price)
            formatted_price = str(price_decimal)
            url += f"&price={formatted_price}"
            logger.info(f"Added price {formatted_price} for limit order")
        except Exception as e:
            logger.error(f"Error processing price for limit order: {str(e)}")
            raise
    else:
        logger.info(f"Market order - no price parameter needed")
    
    logger.info(f"Sending order to TEE: {url}")
    
    # Define a function to make the API call
    def make_api_call():
        response = requests.post(url, timeout=TEE_API_TIMEOUT)
        response.raise_for_status()
        result = response.json()
        return result
    
    # Use the retry mechanism to make the API call
    try:
        result = retry_request(make_api_call)
        logger.info(f"Order successfully forwarded to TEE. Order ID: {result.get('order_id')}")
        return result.get('order_id')
    except Exception as e:
        logger.error(f"Failed to forward order to TEE after retries: {str(e)}")
        raise


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


def check_tee_connection():
    """Check if the TEE endpoint is reachable."""
    try:
        # Try to connect to the TEE API endpoint
        response = requests.get(f"{TEE_API_ENDPOINT}/trades", timeout=TEE_API_TIMEOUT)
        response.raise_for_status()
        logger.info(f"TEE API connection successful at {TEE_API_ENDPOINT}")
        return True
    except Exception as e:
        logger.warning(f"Could not connect to TEE API at {TEE_API_ENDPOINT}: {str(e)}")
        logger.warning("Order forwarding to TEE will be attempted, but may fail.")
        return False


def initialize_and_process_events():
    """Initialize the database and process events."""
    # Initialize the database
    init_db()
    
    # Check TEE connection
    check_tee_connection()
    
    # Setup Web3
    w3, contract = setup_web3()
    if not w3 or not contract:
        return None
    
    # Get the current block number
    current_block = w3.eth.block_number
    
    # Get the last processed block number
    last_block = get_last_processed_block()
    if last_block is None:
        start_block = max(1, current_block - 10)
    else:
        start_block = last_block + 1
    
    # Process blocks from the last processed block to the current block
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

def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(description='Ethereum Event Listener')
    parser.add_argument('--duration', type=int, default=None, 
                        help='Duration in seconds to run the listener. If not provided, runs indefinitely.')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
                        default='INFO', help='Set the logging level')
    
    args = parser.parse_args()
    
    # Set log level

    return start_polling(duration_seconds=args.duration)

if __name__ == "__main__":
    main() 