#include "OrderBook.h"
#include "Enclave.h"
#include "Enclave_t.h"
#include <string>
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <cstring>

// ============================
// OrderBook implementation ;)
// ============================

class OrderBookImpl {
private:
    // Priority queues for buy and sell orders
    std::priority_queue<Order, std::vector<Order>, BuyOrderComparator> buy_orders;
    std::priority_queue<Order, std::vector<Order>, SellOrderComparator> sell_orders;
    
    // Map of all orders by ID
    std::map<std::string, Order> orders;
    
    // List of all trades
    std::vector<Trade> trades;
    
    // Singleton instance
    static OrderBookImpl* instance;

    // Generate a unique order ID
    std::string generate_order_id() {
        static int counter = 0;
        time_t now;
        ocall_get_current_time(&now);
        
        char buffer[64];
        snprintf(buffer, sizeof(buffer), "%lx-%d", (long)now, ++counter);
        return std::string(buffer);
    }
    
    // Generate a unique trade ID
    std::string generate_trade_id() {
        static int counter = 0;
        time_t now;
        ocall_get_current_time(&now);
        
        char buffer[64];
        snprintf(buffer, sizeof(buffer), "%lx-trade-%d", (long)now, ++counter);
        return std::string(buffer);
    }
    
    // Match a market order
    void match_market_order(Order& order) {
        if (order.side == BUY) {
            // For buy orders, match against sell orders
            while (order.remaining_quantity > 0 && !sell_orders.empty()) {
                // Get the best matching order
                Order matching_order = sell_orders.top();
                sell_orders.pop();
                
                // Skip orders that are not open
                if (matching_order.status != OPEN) {
                    continue;
                }
                
                // Calculate fill quantity
                double fill_quantity = std::min(order.remaining_quantity, matching_order.remaining_quantity);
                
                // Create trade
                Trade trade;
                trade.id = generate_trade_id();
                trade.price = matching_order.price;
                trade.quantity = fill_quantity;
                ocall_get_current_time(&trade.timestamp);
                
                trade.taker_address = order.user_address;
                trade.maker_address = matching_order.user_address;
                trade.taker_side = BUY;
                
                // Update order quantities
                order.remaining_quantity -= fill_quantity;
                matching_order.remaining_quantity -= fill_quantity;
                
                // Update order statuses
                if (matching_order.remaining_quantity <= 0) {
                    matching_order.status = FILLED;
                } else {
                    matching_order.status = PARTIALLY_FILLED;
                    sell_orders.push(matching_order);
                }
                
                // Update the order in the map
                orders[matching_order.id] = matching_order;
                
                trades.push_back(trade);
                
                printf("[Enclave] Trade executed: %s, Price: %.2f, Quantity: %.2f\n", 
                       trade.id.c_str(), trade.price, trade.quantity);
            }
        } else {
            // For sell orders, match against buy orders
            while (order.remaining_quantity > 0 && !buy_orders.empty()) {
                // Get the best matching order
                Order matching_order = buy_orders.top();
                buy_orders.pop();
                
                // Skip orders that are not open
                if (matching_order.status != OPEN) {
                    continue;
                }
                
                // Calculate fill quantity
                double fill_quantity = std::min(order.remaining_quantity, matching_order.remaining_quantity);
                
                // Create trade
                Trade trade;
                trade.id = generate_trade_id();
                trade.price = matching_order.price;
                trade.quantity = fill_quantity;
                ocall_get_current_time(&trade.timestamp);
                
                trade.taker_address = order.user_address;
                trade.maker_address = matching_order.user_address;
                trade.taker_side = SELL;
                
                // Update order quantities
                order.remaining_quantity -= fill_quantity;
                matching_order.remaining_quantity -= fill_quantity;
                
                // Update order statuses
                if (matching_order.remaining_quantity <= 0) {
                    matching_order.status = FILLED;
                } else {
                    matching_order.status = PARTIALLY_FILLED;
                    buy_orders.push(matching_order);
                }
                
                // Update the order in the map
                orders[matching_order.id] = matching_order;
                
                trades.push_back(trade);
                
                printf("[Enclave] Trade executed: %s, Price: %.2f, Quantity: %.2f\n", 
                       trade.id.c_str(), trade.price, trade.quantity);
            }
        }
        
        // Update order status
        if (order.remaining_quantity <= 0) {
            order.status = FILLED;
        } else {
            order.status = OPEN;
            if (order.side == BUY) {
                buy_orders.push(order);
            } else {
                sell_orders.push(order);
            }
        }
        
        orders[order.id] = order;
    }
    
    // Match a limit order
    void match_limit_order(Order& order) {
        if (order.side == BUY) {
            // For buy orders, match against sell orders
            while (order.remaining_quantity > 0 && !sell_orders.empty()) {
                // Get the best matching order
                Order matching_order = sell_orders.top();
                
                // Check if the price is acceptable
                if (matching_order.price > order.price) {
                    break; // No more matching orders at acceptable price
                }
                
                sell_orders.pop();
                
                // Skip orders that are not open
                if (matching_order.status != OPEN) {
                    continue;
                }
                
                // Calculate fill quantity
                double fill_quantity = std::min(order.remaining_quantity, matching_order.remaining_quantity);
                
                // Create trade
                Trade trade;
                trade.id = generate_trade_id();
                trade.price = matching_order.price;
                trade.quantity = fill_quantity;
                ocall_get_current_time(&trade.timestamp);
                
                trade.taker_address = order.user_address;
                trade.maker_address = matching_order.user_address;
                trade.taker_side = BUY;
                
                // Update order quantities
                order.remaining_quantity -= fill_quantity;
                matching_order.remaining_quantity -= fill_quantity;
                
                // Update order statuses
                if (matching_order.remaining_quantity <= 0) {
                    matching_order.status = FILLED;
                } else {
                    matching_order.status = PARTIALLY_FILLED;
                    sell_orders.push(matching_order);
                }
                
                // Update the order in the map
                orders[matching_order.id] = matching_order;
                
                trades.push_back(trade);
                
                printf("[Enclave] Trade executed: %s, Price: %.2f, Quantity: %.2f\n", 
                       trade.id.c_str(), trade.price, trade.quantity);
            }
        } else {
            // For sell orders, match against buy orders
            while (order.remaining_quantity > 0 && !buy_orders.empty()) {
                // Get the best matching order
                Order matching_order = buy_orders.top();
                
                // Check if the price is acceptable
                if (matching_order.price < order.price) {
                    break; // No more matching orders at acceptable price
                }
                
                buy_orders.pop();
                
                // Skip orders that are not open
                if (matching_order.status != OPEN) {
                    continue;
                }
                
                // Calculate fill quantity
                double fill_quantity = std::min(order.remaining_quantity, matching_order.remaining_quantity);
                
                // Create trade
                Trade trade;
                trade.id = generate_trade_id();
                trade.price = matching_order.price;
                trade.quantity = fill_quantity;
                ocall_get_current_time(&trade.timestamp);
                
                trade.taker_address = order.user_address;
                trade.maker_address = matching_order.user_address;
                trade.taker_side = SELL;
                
                // Update order quantities
                order.remaining_quantity -= fill_quantity;
                matching_order.remaining_quantity -= fill_quantity;
                
                // Update order statuses
                if (matching_order.remaining_quantity <= 0) {
                    matching_order.status = FILLED;
                } else {
                    matching_order.status = PARTIALLY_FILLED;
                    buy_orders.push(matching_order);
                }
                
                // Update the order in the map
                orders[matching_order.id] = matching_order;
                
                trades.push_back(trade);
                
                printf("[Enclave] Trade executed: %s, Price: %.2f, Quantity: %.2f\n", 
                       trade.id.c_str(), trade.price, trade.quantity);
            }
        }
        
        if (order.remaining_quantity <= 0) {
            order.status = FILLED;
        } else {
            order.status = OPEN;
            if (order.side == BUY) {
                buy_orders.push(order);
            } else {
                sell_orders.push(order);
            }
        }
        
        orders[order.id] = order;
    }

public:
    // Get singleton instance
    static OrderBookImpl* getInstance() {
        if (instance == nullptr) {
            instance = new OrderBookImpl();
        }
        return instance;
    }
    
    // Add an order to the book
    std::string add_order(const std::string& user_address, OrderType type, 
                         OrderSide side, double price, double quantity) {
        Order order;
        order.id = generate_order_id();
        order.user_address = user_address;
        order.type = type;
        order.side = side;
        order.price = price;
        order.quantity = quantity;
        order.remaining_quantity = quantity;
        order.status = OPEN;
        ocall_get_current_time(&order.timestamp);
        
        printf("[Enclave] New order: %s, Type: %d, Side: %d, Price: %.2f, Quantity: %.2f\n", 
               order.id.c_str(), type, side, price, quantity);
        
        if (type == MARKET) {
            match_market_order(order);
        } else {
            match_limit_order(order);
        }
        
        return order.id;
    }
    
    // Get all trades
    std::vector<Trade> get_trades() {
        return trades;
    }
    
    // Get trades for a specific user
    std::vector<Trade> get_user_trades(const std::string& user_address) {
        std::vector<Trade> user_trades;
        for (const auto& trade : trades) {
            if (trade.maker_address == user_address || trade.taker_address == user_address) {
                user_trades.push_back(trade);
            }
        }
        return user_trades;
    }
    
    // Convert trades to JSON
    std::string trades_to_json(const std::vector<Trade>& trades_list) {
        std::string result = "[";
        bool first = true;
        
        printf("[Enclave] Converting %zu trades to JSON\n", trades_list.size());
        
        for (const auto& trade : trades_list) {
            if (!first) {
                result += ",";
            }
            first = false;
            
            char trade_json[512]; // Increased buffer size
            snprintf(trade_json, sizeof(trade_json), 
                    "{\"id\":\"%s\","
                    "\"maker\":\"%s\","
                    "\"taker\":\"%s\","
                    "\"taker_side\":\"%s\","
                    "\"price\":%.2f,"
                    "\"quantity\":%.2f,"
                    "\"timestamp\":%ld}",
                    trade.id.c_str(),
                    trade.maker_address.c_str(),
                    trade.taker_address.c_str(),
                    (trade.taker_side == BUY ? "buy" : "sell"),
                    trade.price,
                    trade.quantity,
                    (long)trade.timestamp);
            
            result += trade_json;
            
            // Debug output for each trade
            printf("[Enclave] Added trade: %s\n", trade_json);
        }
        
        result += "]";
        return result;
    }
};

// Initialize the static member outside the class
OrderBookImpl* OrderBookImpl::instance = nullptr;

// Helper function to get the order book instance
OrderBookImpl* get_order_book() {
    return OrderBookImpl::getInstance();
}

// Add an order to the book
void ecall_add_order(const char* user_address, int order_type, 
                    int order_side, double price, double quantity,
                    char* order_id, size_t id_size) {
    std::string address(user_address);
    OrderType type = static_cast<OrderType>(order_type);
    OrderSide side = static_cast<OrderSide>(order_side);
    
    std::string result = get_order_book()->add_order(address, type, side, price, quantity);
    
    // Copy the order ID to the output buffer
    if (result.length() < id_size) {
        strncpy(order_id, result.c_str(), result.length() + 1);
    } else {
        // Buffer too small, truncate
        strncpy(order_id, result.c_str(), id_size - 1);
        order_id[id_size - 1] = '\0';
    }
}

// Get all trades
size_t ecall_get_trades(char* trades_json, size_t json_size) {
    std::vector<Trade> all_trades = get_order_book()->get_trades();
    
    // Debug output to see if trades exist
    char log_buf[256];
    snprintf(log_buf, sizeof(log_buf), "[Enclave] Getting all trades, found %d trades", (int)all_trades.size());
    ocall_log_message(log_buf);
    
    std::string json_str = get_order_book()->trades_to_json(all_trades);
    
    // Debug output to see JSON string size
    snprintf(log_buf, sizeof(log_buf), "[Enclave] JSON string length: %d, buffer size: %d", 
             (int)json_str.length(), (int)json_size);
    ocall_log_message(log_buf);
    
    // Check if buffer is large enough
    if (json_str.length() >= json_size) {
        ocall_log_message("[Enclave] ERROR: Buffer too small for trades JSON");
        return 0; // Buffer too small
    }
    
    // Copy to output buffer
    memcpy(trades_json, json_str.c_str(), json_str.length() + 1);
    
    return json_str.length();
}

// Get trades for a specific user
size_t ecall_get_user_trades(const char* user_address, char* trades_json, size_t json_size) {
    std::string address(user_address);
    std::vector<Trade> user_trades = get_order_book()->get_user_trades(address);
    
    // Debug output to see if user trades exist
    char log_buf[256];
    snprintf(log_buf, sizeof(log_buf), "[Enclave] Getting trades for user %s, found %d trades", 
             user_address, (int)user_trades.size());
    ocall_log_message(log_buf);
    
    std::string json_str = get_order_book()->trades_to_json(user_trades);
    
    // Debug output to see JSON string size
    snprintf(log_buf, sizeof(log_buf), "[Enclave] JSON string length: %d, buffer size: %d", 
             (int)json_str.length(), (int)json_size);
    ocall_log_message(log_buf);
    
    // Check if buffer is large enough
    if (json_str.length() >= json_size) {
        ocall_log_message("[Enclave] ERROR: Buffer too small for user trades JSON");
        return 0; // Buffer too small
    }
    
    // Copy to output buffer
    memcpy(trades_json, json_str.c_str(), json_str.length() + 1);
    
    return json_str.length();
}
