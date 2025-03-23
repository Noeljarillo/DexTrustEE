import argparse
import threading
import logging
from dotenv import load_dotenv
import os

# Import the modules
from listener import start_polling as start_listener
from settlement import start_settlement_monitoring

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('backend/dextrust.log')
    ]
)
logger = logging.getLogger('dextrust_main')

# Load environment variables
load_dotenv()

def run_listener(duration=None):
    """Run the blockchain listener as a separate thread."""
    logger.info("Starting blockchain event listener...")
    start_listener(duration_seconds=duration)

def run_settlement(interval=30, duration=None):
    """Run the settlement process as a separate thread."""
    logger.info("Starting settlement monitoring...")
    start_settlement_monitoring(interval_seconds=interval, duration_seconds=duration)

def main():
    """Main entry point for the DexTrustEE system."""
    parser = argparse.ArgumentParser(description='DexTrustEE - Decentralized Trading Platform')
    parser.add_argument('--duration', type=int, default=None, 
                        help='Duration in seconds to run the system. If not provided, runs indefinitely.')
    parser.add_argument('--settlement-interval', type=int, default=30,
                        help='Interval in seconds between settlement checks. Default is 30 seconds.')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
                        default='INFO', help='Set the logging level')
    
    args = parser.parse_args()
    
    # Set log level based on argument
    logging_level = getattr(logging, args.log_level)
    logger.setLevel(logging_level)
    
    # Start the listener in a separate thread
    listener_thread = threading.Thread(
        target=run_listener,
        args=(args.duration,),
        daemon=True
    )
    
    # Start the settlement in a separate thread
    settlement_thread = threading.Thread(
        target=run_settlement,
        args=(args.settlement_interval, args.duration),
        daemon=True
    )
    
    logger.info("Starting DexTrustEE system...")
    
    # Start threads
    listener_thread.start()
    settlement_thread.start()
    
    try:
        # Wait for threads to complete if duration is specified
        if args.duration:
            listener_thread.join()
            settlement_thread.join()
            logger.info(f"DexTrustEE system completed after {args.duration} seconds")
        else:
            # For indefinite running, we need to keep the main thread alive
            while True:
                # Check if threads are still alive
                if not listener_thread.is_alive() and not settlement_thread.is_alive():
                    logger.error("Both threads have unexpectedly terminated. Exiting.")
                    break
                
                # Sleep to avoid CPU hogging
                import time
                time.sleep(1)
    except KeyboardInterrupt:
        logger.info("DexTrustEE system stopped by user")
    except Exception as e:
        logger.error(f"Error in main thread: {e}")
    
    logger.info("DexTrustEE system shutdown complete")
    return 0

if __name__ == "__main__":
    main() 