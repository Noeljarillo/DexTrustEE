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
        auto& opposite_orders = (order.side == BUY) ? sell_orders : buy_orders;
        
        while (order.remaining_quantity > 0 && !opposite_orders.empty()) {
            Order matching_order = opposite_orders.top();
            opposite_orders.pop();
            
            if (matching_order.status != OPEN) {
                continue;
            }
            
            double fill_quantity = std::min(order.remaining_quantity, matching_order.remaining_quantity);
            
            Trade trade;
            trade.id = generate_trade_id();
            trade.price = matching_order.price;
            trade.quantity = fill_quantity;
            ocall_get_current_time(&trade.timestamp);
            
            if (order.side == BUY) {
                trade.taker_address = order.user_address;
                trade.maker_address = matching_order.user_address;
                trade.taker_side = BUY;
            } else {
                trade.taker_address = order.user_address;
                trade.maker_address = matching_order.user_address;
                trade.taker_side = SELL;
            }
            
            // Update order quantities
            order.remaining_quantity -= fill_quantity;
            matching_order.remaining_quantity -= fill_quantity;
            
            // Update order statuses
            if (matching_order.remaining_quantity <= 0) {
                matching_order.status = FILLED;
            } else {
                matching_order.status = PARTIALLY_FILLED;
                opposite_orders.push(matching_order);
            }
            
            orders[matching_order.id] = matching_order;
            
            trades.push_back(trade);
            
            printf("[Enclave] Trade executed: %s, Price: %.2f, Quantity: %.2f\n", 
                   trade.id.c_str(), trade.price, trade.quantity);
        }
        
        if (order.remaining_quantity <= 0) {
            order.status = FILLED;
        } else {
            order.status = PARTIALLY_FILLED;
        }
        
        orders[order.id] = order;
    }
    
    // Match a limit order
    void match_limit_order(Order& order) {
        auto& opposite_orders = (order.side == BUY) ? sell_orders : buy_orders;
        
        while (order.remaining_quantity > 0 && !opposite_orders.empty()) {
            Order matching_order = opposite_orders.top();
            
            if ((order.side == BUY && matching_order.price > order.price) ||
                (order.side == SELL && matching_order.price < order.price)) {
                break;
            }
            
            opposite_orders.pop();
            
            if (matching_order.status != OPEN) {
                continue;
            }
            
            double fill_quantity = std::min(order.remaining_quantity, matching_order.remaining_quantity);
            
            Trade trade;
            trade.id = generate_trade_id();
            trade.price = matching_order.price;
            trade.quantity = fill_quantity;
            ocall_get_current_time(&trade.timestamp);
            
            if (order.side == BUY) {
                trade.taker_address = order.user_address;
                trade.maker_address = matching_order.user_address;
                trade.taker_side = BUY;
            } else {
                trade.taker_address = order.user_address;
                trade.maker_address = matching_order.user_address;
                trade.taker_side = SELL;
            }
            
            order.remaining_quantity -= fill_quantity;
            matching_order.remaining_quantity -= fill_quantity;
            
            if (matching_order.remaining_quantity <= 0) {
                matching_order.status = FILLED;
            } else {
                matching_order.status = PARTIALLY_FILLED;
                opposite_orders.push(matching_order);
            }
            
            orders[matching_order.id] = matching_order;
            
            trades.push_back(trade);
            
            printf("[Enclave] Trade executed: %s, Price: %.2f, Quantity: %.2f\n", 
                   trade.id.c_str(), trade.price, trade.quantity);
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
};

static OrderBookImpl* order_book_instance = nullptr;

OrderBookImpl* get_order_book() {
    if (order_book_instance == nullptr) {
        order_book_instance = new OrderBookImpl();
    }
    return order_book_instance;
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

size_t ecall_get_trades(char* trades_json, size_t json_size) {
    auto trades = get_order_book()->get_trades();
    
    std::stringstream json;
    json << "[";
    for (size_t i = 0; i < trades.size(); i++) {
        const auto& trade = trades[i];
        json << "{";
        json << "\"id\":\"" << trade.id << "\",";
        json << "\"maker\":\"" << trade.maker_address << "\",";
        json << "\"taker\":\"" << trade.taker_address << "\",";
        json << "\"side\":" << trade.taker_side << ",";
        json << "\"price\":" << std::fixed << std::setprecision(2) << trade.price << ",";
        json << "\"quantity\":" << std::fixed << std::setprecision(2) << trade.quantity << ",";
        json << "\"timestamp\":" << trade.timestamp;
        json << "}";
        if (i < trades.size() - 1) {
            json << ",";
        }
    }
    json << "]";
    
    std::string json_str = json.str();
    
    if (json_str.length() >= json_size) {
        return 0;
    }
    
    memcpy(trades_json, json_str.c_str(), json_str.length() + 1);
    
    return json_str.length();
}

size_t ecall_get_user_trades(const char* user_address, char* trades_json, size_t json_size) {
    std::string address(user_address);
    auto trades = get_order_book()->get_user_trades(address);
    
    std::stringstream json;
    json << "[";
    for (size_t i = 0; i < trades.size(); i++) {
        const auto& trade = trades[i];
        json << "{";
        json << "\"id\":\"" << trade.id << "\",";
        json << "\"maker\":\"" << trade.maker_address << "\",";
        json << "\"taker\":\"" << trade.taker_address << "\",";
        json << "\"side\":" << trade.taker_side << ",";
        json << "\"price\":" << std::fixed << std::setprecision(2) << trade.price << ",";
        json << "\"quantity\":" << std::fixed << std::setprecision(2) << trade.quantity << ",";
        json << "\"timestamp\":" << trade.timestamp;
        json << "}";
        if (i < trades.size() - 1) {
            json << ",";
        }
    }
    json << "]";
    
    std::string json_str = json.str();
    
    if (json_str.length() >= json_size) {
        return 0;
    }
    
    memcpy(trades_json, json_str.c_str(), json_str.length() + 1);
    
    return json_str.length();
}
