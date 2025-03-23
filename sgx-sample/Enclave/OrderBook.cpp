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
    std::map<std::string, Order> orders;
    
    std::priority_queue<Order, std::vector<Order>, BuyOrderComparator> buy_orders;
    std::priority_queue<Order, std::vector<Order>, SellOrderComparator> sell_orders;
    
    std::vector<Trade> trades;
    
    std::string generate_order_id() {
        static int counter = 0;
        std::stringstream ss;
        time_t now;
        ocall_get_current_time(&now);
        ss << std::hex << now << "-" << ++counter;
        return ss.str();
    }
    
    std::string generate_trade_id() {
        static int counter = 0;
        std::stringstream ss;
        time_t now;
        ocall_get_current_time(&now);
        ss << std::hex << now << "-T-" << ++counter;
        return ss.str();
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
        
        if (order.remaining_quantity <= 0) {
            order.status = FILLED;
        } else if (order.remaining_quantity < order.quantity) {
            order.status = PARTIALLY_FILLED;
            if (order.side == BUY) {
                buy_orders.push(order);
            } else {
                sell_orders.push(order);
            }
        } else {
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
    
    std::vector<Trade> get_trades() {
        return trades;
    }
    
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
        std::stringstream ss;
        ss << "[";
        bool first = true;
        for (const auto& trade : trades_list) {
            if (!first) {
                ss << ",";
            }
            first = false;
            
            ss << "{";
            ss << "\"id\":\"" << trade.id << "\",";
            ss << "\"maker\":\"" << trade.maker_address << "\",";
            ss << "\"taker\":\"" << trade.taker_address << "\",";
            ss << "\"taker_side\":" << (trade.taker_side == BUY ? "\"buy\"" : "\"sell\"") << ",";
            ss << "\"price\":" << trade.price << ",";
            ss << "\"quantity\":" << trade.quantity << ",";
            ss << "\"timestamp\":" << trade.timestamp;
            ss << "}";
        }
        ss << "]";
        return ss.str();
    }

    // Singleton instance
    static OrderBookImpl* instance = nullptr;

    // Get singleton instance
    static OrderBookImpl* getInstance() {
        if (instance == nullptr) {
            instance = new OrderBookImpl();
        }
        return instance;
    }
};

// Add an order to the book
void ecall_add_order(const char* user_address, int order_type, 
                    int order_side, double price, double quantity,
                    char* order_id, size_t id_size) {
    std::string address(user_address);
    OrderType type = static_cast<OrderType>(order_type);
    OrderSide side = static_cast<OrderSide>(order_side);
    
    std::string result = OrderBookImpl::getInstance()->add_order(address, type, side, price, quantity);
    
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
    std::vector<Trade> all_trades = OrderBookImpl::getInstance()->get_trades();
    std::string json_str = OrderBookImpl::getInstance()->trades_to_json(all_trades);
    
    // Check if buffer is large enough
    if (json_str.length() >= json_size) {
        return 0; // Buffer too small
    }
    
    // Copy to output buffer
    memcpy(trades_json, json_str.c_str(), json_str.length() + 1);
    
    return json_str.length();
}

// Get trades for a specific user
size_t ecall_get_user_trades(const char* user_address, char* trades_json, size_t json_size) {
    std::string address(user_address);
    std::vector<Trade> user_trades = OrderBookImpl::getInstance()->get_user_trades(address);
    std::string json_str = OrderBookImpl::getInstance()->trades_to_json(user_trades);
    
    // Check if buffer is large enough
    if (json_str.length() >= json_size) {
        return 0; // Buffer too small
    }
    
    // Copy to output buffer
    memcpy(trades_json, json_str.c_str(), json_str.length() + 1);
    
    return json_str.length();
}
