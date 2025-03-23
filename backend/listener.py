import sqlite3
import json
import time
import argparse
import logging
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