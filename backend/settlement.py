import json
import time
import logging
import sqlite3
import os
import requests
from web3 import Web3
from dotenv import load_dotenv
from executor import execute

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('backend/settlement.log')
    ]
)
logger = logging.getLogger('settlement')

# Load environment variables
load_dotenv()

TEE_API_ENDPOINT = os.getenv('TEE_API_ENDPOINT', 'http://172.191.42.99:8080')
TEE_API_TIMEOUT = int(os.getenv('TEE_API_TIMEOUT', '30'))
RPC_URL = os.getenv('SEPOLIA_RPC_URL')
PRIVATE_KEY = os.getenv('PRIVATE_KEY')
CONTRACT_ADDRESS = os.getenv('CONTRACT_ADDRESS')
DB_PATH = './backend/order_events.db'

# Add the TST token address constant
TST_TOKEN_ADDRESS = os.getenv('TST_TOKEN_ADDRESS', '0x77f369477a0140b30d359741f8720ee23f03ebd7')

def init_settlement_db():
    """Initialize the settlement database to track processed trades."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS processed_trades (
        id TEXT PRIMARY KEY,
        maker TEXT,
        taker TEXT,
        taker_side TEXT,
        price TEXT,
        quantity TEXT,
        timestamp INTEGER,
        settlement_tx_hash TEXT,
        processed_at INTEGER
    )
    ''')
    
    conn.commit()
    conn.close()
    logger.info("Settlement database initialized successfully.")

def get_processed_trade_ids():
    """Get a list of already processed trade IDs to avoid duplicate settlements."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('SELECT id FROM processed_trades')
    result = cursor.fetchall()
    
    conn.close()
    
    return [row[0] for row in result]

def mark_trade_as_processed(trade, tx_hash=None):
    """Mark a trade as processed in the database."""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
    INSERT INTO processed_trades (
        id, maker, taker, taker_side, price, quantity, timestamp, 
        settlement_tx_hash, processed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        trade['id'],
        trade.get('maker', ''),
        trade.get('taker', ''),
        trade.get('taker_side', ''),
        str(trade.get('price', '0')),
        str(trade.get('quantity', '0')),
        trade.get('timestamp', 0),
        tx_hash,
        int(time.time())
    ))
    
    conn.commit()
    conn.close()
    
    logger.info(f"Trade {trade['id']} marked as processed with tx_hash: {tx_hash}")

def fetch_trades():
    """Fetch trades from the TEE API."""
    try:
        response = requests.get(f"{TEE_API_ENDPOINT}/trades", timeout=TEE_API_TIMEOUT)
        response.raise_for_status()
        trades = response.json()
        logger.info(f"Fetched {len(trades)} trades from TEE API")
        return trades
    except Exception as e:
        logger.error(f"Error fetching trades from TEE API: {str(e)}")
        return []

def execute_settlement(trade):
    """Execute on-chain settlement for a trade match."""
    try:
        logger.info(f"Processing settlement for trade {trade['id']}")
        
        # Determine the recipient (based on who is receiving the tokens)
        maker = trade.get('maker', '')
        taker = trade.get('taker', '')
        taker_side = trade.get('taker_side', '').lower()
        
        # Calculate settlement amount (price * quantity)
        price = float(trade.get('price', 0))
        quantity = float(trade.get('quantity', 0))
        settlement_amount = price * quantity
        
        # If price is 0 or very small, use a reasonable default for market orders
        if settlement_amount < 0.0001:
            # For market orders, use a reasonable price (e.g., 100 tokens per ETH)
            settlement_amount = quantity * 100
        
        logger.info(f"Trade details: maker={maker}, taker={taker}, taker_side={taker_side}, price={price}, quantity={quantity}")
        
        # Use Web3 to get checksummed addresses
        w3 = Web3()
        
        # Determine token and recipient based on trade side
        if taker_side == 'buy':
            # Taker is buying ETH with TST tokens
            # Maker is selling ETH and receiving TST tokens
            token_address = w3.to_checksum_address(TST_TOKEN_ADDRESS)  # TST token
            recipient = maker  # Maker receives tokens
            logger.info(f"Buy side: Maker {maker} sells ETH and receives {settlement_amount} TST tokens")
        else:  # sell
            # Taker is selling ETH for TST tokens
            # Maker is buying ETH and sending TST tokens
            token_address = w3.to_checksum_address(TST_TOKEN_ADDRESS)  # TST token
            recipient = taker  # Taker receives tokens
            logger.info(f"Sell side: Taker {taker} sells ETH and receives {settlement_amount} TST tokens")
        
        logger.info(f"Settlement: {settlement_amount} {token_address} tokens to {recipient}")
        
        # Execute the on-chain transaction
        tx_hash = execute(
            private_key=PRIVATE_KEY,
            token_address=token_address,
            recipient=recipient, 
            amount=settlement_amount
        )
        
        if tx_hash:
            logger.info(f"Settlement successful for trade {trade['id']}, tx_hash: {tx_hash}")
            return tx_hash
        else:
            logger.error(f"Settlement failed for trade {trade['id']}")
            return None
    except Exception as e:
        logger.error(f"Error executing settlement for trade {trade['id']}: {str(e)}")
        return None

def process_new_trades():
    """Process new trades that haven't been settled yet."""
    # Initialize the settlement database
    init_settlement_db()
    
    # Get already processed trade IDs
    processed_trade_ids = get_processed_trade_ids()
    logger.info(f"Found {len(processed_trade_ids)} previously processed trades")
    
    # Fetch current trades from TEE
    trades = fetch_trades()
    
    # Filter for new trades
    new_trades = [trade for trade in trades if trade['id'] not in processed_trade_ids]
    logger.info(f"Found {len(new_trades)} new trades to process")
    
    # Process each new trade
    for trade in new_trades:
        logger.info(f"Processing trade {trade['id']}")
        
        # Execute settlement
        tx_hash = execute_settlement(trade)
        
        # Mark as processed regardless of success (to avoid retrying failed trades)
        # In a production system, you might want to retry or have manual intervention
        mark_trade_as_processed(trade, tx_hash)
    
    return len(new_trades)

def start_settlement_monitoring(interval_seconds=30, duration_seconds=None):
    """Start monitoring for trades and executing settlements.
    
    Args:
        interval_seconds: How often to check for new trades in seconds.
        duration_seconds: How long to monitor in seconds. If None, runs indefinitely.
    """
    start_time = time.time()
    end_time = start_time + duration_seconds if duration_seconds else float('inf')
    
    logger.info(f"Starting settlement monitoring for {'indefinite time' if duration_seconds is None else f'{duration_seconds} seconds'}")
    
    try:
        while time.time() < end_time:
            try:
                logger.info("Checking for new trades to settle...")
                num_processed = process_new_trades()
                logger.info(f"Processed {num_processed} new trades")
                
                # Sleep until next check
                logger.info(f"Waiting {interval_seconds} seconds before next check...")
                time.sleep(interval_seconds)
            except Exception as e:
                logger.error(f"Error in settlement monitoring loop: {str(e)}")
                logger.info(f"Retrying in {interval_seconds} seconds...")
                time.sleep(interval_seconds)
        
        if duration_seconds:
            logger.info(f"Settlement monitoring completed after {duration_seconds} seconds")
        return "Settlement monitoring completed"
    
    except KeyboardInterrupt:
        logger.info("Settlement monitoring stopped by user")
        return "Settlement monitoring stopped by user"
    except Exception as e:
        logger.error(f"Error during settlement monitoring: {str(e)}")
        return f"Error: {str(e)}"

if __name__ == "__main__":
    start_settlement_monitoring() 