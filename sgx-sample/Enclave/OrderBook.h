#ifndef _ORDER_BOOK_H_
#define _ORDER_BOOK_H_

#include <string>
#include <vector>
#include <map>
#include <queue>
#include <ctime>

enum OrderType {
    LIMIT = 0,
    MARKET = 1
};

enum OrderSide {
    BUY = 0,
    SELL = 1
};

enum OrderStatus {
    OPEN = 0,
    FILLED = 1,
    PARTIALLY_FILLED = 2,
    CANCELLED = 3
};

// Order structure (not exposed outside enclave)
struct Order {
    std::string id;                // Unique order ID
    std::string user_address;      // Ethereum address of the user
    OrderType type;                // LIMIT or MARKET
    OrderSide side;                // BUY or SELL
    double price;                  // Price for LIMIT orders (0 for MARKET)
    double quantity;               // Original quantity
    double remaining_quantity;     // Remaining quantity to be filled
    OrderStatus status;            // Current status
    time_t timestamp;              // Creation timestamp
};

// Trade structure (exposed via API)
struct Trade {
    std::string id;                // Unique trade ID
    std::string maker_address;     // Ethereum address of maker
    std::string taker_address;     // Ethereum address of taker
    OrderSide taker_side;          // Side of the taker
    double price;                  // Execution price
    double quantity;               // Execution quantity
    time_t timestamp;              // Execution timestamp
};

struct BuyOrderComparator {
    bool operator()(const Order& a, const Order& b) const {
        if (a.price == b.price) {
            return a.timestamp > b.timestamp;
        }
        return a.price < b.price;
    }
};

struct SellOrderComparator {
    bool operator()(const Order& a, const Order& b) const {
        if (a.price == b.price) {
            return a.timestamp > b.timestamp;
        }
        return a.price > b.price;
    }
};

#endif
