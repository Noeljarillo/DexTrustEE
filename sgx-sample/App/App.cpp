/*
 * Copyright (C) 2011-2021 Intel Corporation. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *   * Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in
 *     the documentation and/or other materials provided with the
 *     distribution.
 *   * Neither the name of Intel Corporation nor the names of its
 *     contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */


#include <stdio.h>
#include <string.h>
#include <assert.h>
#include <time.h>
#include <unistd.h>
#include <pwd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <signal.h>
#include <stdlib.h>
#include <ctype.h>

#define MAX_PATH FILENAME_MAX
#define HTTP_PORT 8080
#define BUFFER_SIZE 4096

#include "sgx_urts.h"
#include "App.h"
#include "Enclave_u.h"

/* Global EID shared by multiple threads */
sgx_enclave_id_t global_eid = 0;

// Flag to control server loop
volatile sig_atomic_t keep_running = 1;

// Signal handler for graceful shutdown
void handle_signal(int sig) {
    (void)sig; // Suppress unused parameter warning
    keep_running = 0;
}

typedef struct _sgx_errlist_t {
    sgx_status_t err;
    const char *msg;
    const char *sug; /* Suggestion */
} sgx_errlist_t;

/* Error code returned by sgx_create_enclave */
static sgx_errlist_t sgx_errlist[] = {
    {
        SGX_ERROR_UNEXPECTED,
        "Unexpected error occurred.",
        NULL
    },
    {
        SGX_ERROR_INVALID_PARAMETER,
        "Invalid parameter.",
        NULL
    },
    {
        SGX_ERROR_OUT_OF_MEMORY,
        "Out of memory.",
        NULL
    },
    {
        SGX_ERROR_ENCLAVE_LOST,
        "Power transition occurred.",
        "Please refer to the sample \"PowerTransition\" for details."
    },
    {
        SGX_ERROR_INVALID_ENCLAVE,
        "Invalid enclave image.",
        NULL
    },
    {
        SGX_ERROR_INVALID_ENCLAVE_ID,
        "Invalid enclave identification.",
        NULL
    },
    {
        SGX_ERROR_INVALID_SIGNATURE,
        "Invalid enclave signature.",
        NULL
    },
    {
        SGX_ERROR_OUT_OF_EPC,
        "Out of EPC memory.",
        NULL
    },
    {
        SGX_ERROR_NO_DEVICE,
        "Invalid SGX device.",
        "Please make sure SGX module is enabled in the BIOS, and install SGX driver afterwards."
    },
    {
        SGX_ERROR_MEMORY_MAP_CONFLICT,
        "Memory map conflicted.",
        NULL
    },
    {
        SGX_ERROR_INVALID_METADATA,
        "Invalid enclave metadata.",
        NULL
    },
    {
        SGX_ERROR_DEVICE_BUSY,
        "SGX device was busy.",
        NULL
    },
    {
        SGX_ERROR_INVALID_VERSION,
        "Enclave version was invalid.",
        NULL
    },
    {
        SGX_ERROR_INVALID_ATTRIBUTE,
        "Enclave was not authorized.",
        NULL
    },
    {
        SGX_ERROR_ENCLAVE_FILE_ACCESS,
        "Can't open enclave file.",
        NULL
    },
    {
        SGX_ERROR_MEMORY_MAP_FAILURE,
        "Failed to reserve memory for the enclave.",
        NULL
    },
};

/* Check error conditions for loading enclave */
void print_error_message(sgx_status_t ret)
{
    size_t idx = 0;
    size_t ttl = sizeof sgx_errlist/sizeof sgx_errlist[0];

    for (idx = 0; idx < ttl; idx++) {
        if(ret == sgx_errlist[idx].err) {
            if(NULL != sgx_errlist[idx].sug)
                printf("Info: %s\n", sgx_errlist[idx].sug);
            printf("Error: %s\n", sgx_errlist[idx].msg);
            break;
        }
    }
    
    if (idx == ttl)
    	printf("Error code is 0x%X. Please refer to the \"Intel SGX SDK Developer Reference\" for more details.\n", ret);
}

/* Initialize the enclave:
 *   Call sgx_create_enclave to initialize an enclave instance
 */
int initialize_enclave(void)
{
    sgx_status_t ret = SGX_ERROR_UNEXPECTED;
    
    /* Call sgx_create_enclave to initialize an enclave instance */
    /* Debug Support: set 2nd parameter to 1 */
    ret = sgx_create_enclave(ENCLAVE_FILENAME, SGX_DEBUG_FLAG, NULL, NULL, &global_eid, NULL);
    if (ret != SGX_SUCCESS) {
        print_error_message(ret);
        return -1;
    }

    return 0;
}

/* OCall functions */
void ocall_print_string(const char *str)
{
    /* Proxy/Bridge will check the length and null-terminate 
     * the input string to prevent buffer overflow. 
     */
    printf("%s", str);
}

void ocall_get_current_time(time_t* time_value)
{
    if (time_value) {
        *time_value = time(NULL);
    }
}

void ocall_log_message(const char* message)
{
    if (message) {
        printf("[App Log] %s\n", message);
    }
}

// Function to parse HTTP request and extract method, path, and query string
int parse_http_request(const char* request, char* method, char* path, char* query_string) {
    // Check for null pointers
    if (!request || !method || !path || !query_string) {
        return -1;
    }
    
    // Extract method (GET, POST, etc.)
    const char* space = strchr(request, ' ');
    if (!space) {
        return -1;
    }
    
    size_t method_len = space - request;
    if (method_len >= 15) { // Prevent buffer overflow
        return -1;
    }
    strncpy(method, request, method_len);
    method[method_len] = '\0';
    
    // Extract path and query string
    const char* path_start = space + 1;
    const char* path_end = strchr(path_start, ' ');
    if (!path_end) {
        return -1;
    }
    
    const char* query_start = strchr(path_start, '?');
    if (query_start && query_start < path_end) {
        // Path with query string
        size_t path_len = query_start - path_start;
        if (path_len >= 255) { // Prevent buffer overflow
            return -1;
        }
        strncpy(path, path_start, path_len);
        path[path_len] = '\0';
        
        size_t query_len = path_end - query_start - 1;
        if (query_len >= 255) { // Prevent buffer overflow
            return -1;
        }
        strncpy(query_string, query_start + 1, query_len);
        query_string[query_len] = '\0';
    } else {
        // Path without query string
        size_t path_len = path_end - path_start;
        if (path_len >= 255) { // Prevent buffer overflow
            return -1;
        }
        strncpy(path, path_start, path_len);
        path[path_len] = '\0';
        query_string[0] = '\0'; // Empty query string
    }
    
    return 0;
}

// Function to get query parameter value
int get_query_param(const char* query_string, const char* param_name, char* value, size_t value_size) {
    if (!query_string || !param_name || !value) {
        return -1;
    }
    
    char param_prefix[256];
    snprintf(param_prefix, sizeof(param_prefix), "%s=", param_name);
    
    const char* param_start = strstr(query_string, param_prefix);
    if (!param_start) {
        return -1;
    }
    
    param_start += strlen(param_prefix);
    
    const char* param_end = strchr(param_start, '&');
    if (!param_end) {
        param_end = param_start + strlen(param_start);
    }
    
    size_t param_len = param_end - param_start;
    if (param_len >= value_size) {
        return -1;
    }
    
    strncpy(value, param_start, param_len);
    value[param_len] = '\0';
    
    return 0;
}

// Function to send HTTP response
void send_http_response(int client_socket, int status_code, const char* content_type, const char* body) {
    char response[BUFFER_SIZE * 10] = {0}; // Larger buffer for response
    
    // Determine status text
    const char* status_text = "OK";
    if (status_code == 400) status_text = "Bad Request";
    else if (status_code == 404) status_text = "Not Found";
    else if (status_code == 500) status_text = "Internal Server Error";
    
    // Calculate content length
    size_t content_length = strlen(body);
    
    // Format HTTP response
    snprintf(response, sizeof(response),
             "HTTP/1.1 %d %s\r\n"
             "Content-Type: %s\r\n"
             "Content-Length: %zu\r\n"
             "Connection: close\r\n"
             "Access-Control-Allow-Origin: *\r\n"
             "\r\n"
             "%s",
             status_code, status_text,
             content_type,
             content_length,
             body);
    
    // Send response
    send(client_socket, response, strlen(response), 0);
}

// Function to handle HTTP requests for the order book
void handle_http_request(int client_socket) {
    char buffer[BUFFER_SIZE] = {0};
    int bytes_received = (int)recv(client_socket, buffer, BUFFER_SIZE - 1, 0);
    
    printf("[DEBUG] Received HTTP request (%d bytes)\n", bytes_received);
    
    if (bytes_received <= 0) {
        printf("[ERROR] Failed to receive data from client\n");
        close(client_socket);
        return;
    }
    
    // Parse HTTP request
    char method[16] = {0};
    char path[256] = {0};
    char query_string[256] = {0};
    
    if (parse_http_request(buffer, method, path, query_string) < 0) {
        printf("[ERROR] Failed to parse HTTP request\n");
        send_http_response(client_socket, 400, "text/plain", "Bad Request");
        close(client_socket);
        return;
    }
    
    printf("[DEBUG] Method: %s, Path: %s, Query: %s\n", method, path, query_string);
    
    // Handle GET request to read trades
    if (strcmp(method, "GET") == 0 && strcmp(path, "/trades") == 0) {
        char trades_json[10240] = {0}; // Large buffer for trades
        size_t json_size = sizeof(trades_json);
        
        // Check if user address is provided
        char user_address[64] = {0};
        size_t result_size = 0;
        
        if (get_query_param(query_string, "user", user_address, sizeof(user_address)) == 0) {
            // Get trades for specific user
            sgx_status_t status = ecall_get_user_trades(global_eid, &result_size, user_address, trades_json, json_size);
            
            if (status != SGX_SUCCESS || result_size == 0) {
                char error_msg[100];
                snprintf(error_msg, sizeof(error_msg), "Error: Failed to get user trades. Error code: %d", status);
                send_http_response(client_socket, 500, "text/plain", error_msg);
            } else {
                send_http_response(client_socket, 200, "application/json", trades_json);
            }
        } else {
            // Get all trades
            sgx_status_t status = ecall_get_trades(global_eid, &result_size, trades_json, json_size);
            
            if (status != SGX_SUCCESS || result_size == 0) {
                char error_msg[100];
                snprintf(error_msg, sizeof(error_msg), "Error: Failed to get trades. Error code: %d", status);
                send_http_response(client_socket, 500, "text/plain", error_msg);
            } else {
                send_http_response(client_socket, 200, "application/json", trades_json);
            }
        }
    }
    // Handle POST request to add an order
    else if (strcmp(method, "POST") == 0 && strcmp(path, "/order") == 0) {
        printf("[DEBUG] Processing order request\n");
        
        // Extract parameters
        char user_address[64] = {0};
        char type_str[16] = {0};
        char side_str[16] = {0};
        char price_str[32] = {0};
        char quantity_str[32] = {0};
        
        // Check required parameters
        if (get_query_param(query_string, "user", user_address, sizeof(user_address)) < 0 ||
            get_query_param(query_string, "type", type_str, sizeof(type_str)) < 0 ||
            get_query_param(query_string, "side", side_str, sizeof(side_str)) < 0 ||
            get_query_param(query_string, "quantity", quantity_str, sizeof(quantity_str)) < 0) {
            
            printf("[ERROR] Missing required parameters\n");
            send_http_response(client_socket, 400, "text/plain", "Missing required parameters");
            close(client_socket);
            return;
        }
        
        printf("[DEBUG] Parameters: user=%s, type=%s, side=%s, quantity=%s\n", 
               user_address, type_str, side_str, quantity_str);
        
        int order_type = (strcmp(type_str, "market") == 0) ? 1 : 0; // 0=LIMIT, 1=MARKET
        
        if (order_type == 0 && get_query_param(query_string, "price", price_str, sizeof(price_str)) < 0) {
            printf("[ERROR] Price is required for limit orders\n");
            send_http_response(client_socket, 400, "text/plain", "Price is required for limit orders");
            close(client_socket);
            return;
        }
        
        // Convert parameters
        int order_side = (strcmp(side_str, "buy") == 0) ? 0 : 1; // 0=BUY, 1=SELL
        double price = (order_type == 1) ? 0.0 : atof(price_str);
        double quantity = atof(quantity_str);
        
        printf("[DEBUG] Processed parameters: type=%d, side=%d, price=%.2f, quantity=%.2f\n", 
               order_type, order_side, price, quantity);
        
        // Validate Ethereum address (simple check)
        if (strlen(user_address) < 40) {
            printf("[ERROR] Invalid Ethereum address: %s\n", user_address);
            send_http_response(client_socket, 400, "text/plain", "Invalid Ethereum address");
            close(client_socket);
            return;
        }
        
        // Add order to the book
        char order_id[64] = {0};
        printf("[DEBUG] Calling enclave function ecall_add_order\n");
        sgx_status_t status = ecall_add_order(global_eid, user_address, order_type, order_side, price, quantity, order_id, sizeof(order_id));
        
        printf("[DEBUG] Enclave call completed with status: %d\n", status);
        
        if (status != SGX_SUCCESS || order_id[0] == '\0') {
            char error_msg[100];
            snprintf(error_msg, sizeof(error_msg), "Error: Failed to add order. Error code: %d", status);
            printf("[ERROR] %s\n", error_msg);
            send_http_response(client_socket, 500, "text/plain", error_msg);
        } else {
            char response_body[256];
            snprintf(response_body, sizeof(response_body), "{\"order_id\": \"%s\"}", order_id);
            printf("[DEBUG] Order added successfully: %s\n", order_id);
            send_http_response(client_socket, 200, "application/json", response_body);
        }
    }
    // Handle unknown requests
    else {
        send_http_response(client_socket, 404, "text/plain", "Not Found");
    }
    
    printf("[DEBUG] Closing client socket\n");
    close(client_socket);
}

// Function to start HTTP server
void start_http_server() {
    int server_fd, client_socket;
    struct sockaddr_in address;
    int opt = 1;
    int addrlen = sizeof(address);
    
    // Create socket
    if ((server_fd = socket(AF_INET, SOCK_STREAM, 0)) == 0) {
        perror("Socket creation failed");
        exit(EXIT_FAILURE);
    }
    
    // Set socket options
    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR | SO_REUSEPORT, &opt, sizeof(opt))) {
        perror("Setsockopt failed");
        exit(EXIT_FAILURE);
    }
    
    // Configure address
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(HTTP_PORT);
    
    // Bind socket to port
    if (bind(server_fd, (struct sockaddr *)&address, sizeof(address)) < 0) {
        perror("Bind failed");
        exit(EXIT_FAILURE);
    }
    
    // Listen for connections
    if (listen(server_fd, 10) < 0) {
        perror("Listen failed");
        exit(EXIT_FAILURE);
    }
    
    printf("HTTP server started on port %d\n", HTTP_PORT);
    
    // Set up signal handler for graceful shutdown
    signal(SIGINT, handle_signal);
    
    // Main server loop
    while (keep_running) {
        // Accept connection
        if ((client_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen)) < 0) {
            if (keep_running) {
                perror("Accept failed");
            }
            continue;
        }
        
        // Handle request
        handle_http_request(client_socket);
    }
    
    // Close server socket
    close(server_fd);
    printf("HTTP server stopped\n");
}

/* Application entry */
int SGX_CDECL main(int argc, char *argv[])
{
    (void)(argc);
    (void)(argv);

    /* Initialize the enclave */
    if(initialize_enclave() < 0){
        printf("Error: enclave initialization failed\n");
        return -1;
    }
 
    /* Utilize edger8r attributes */
    edger8r_array_attributes();
    edger8r_pointer_attributes();
    edger8r_type_attributes();
    edger8r_function_attributes();
    
    /* Utilize trusted libraries */
    ecall_libc_functions();
    ecall_libcxx_functions();
    ecall_thread_functions();

    /* Start HTTP server */
    printf("\n--- Starting HTTP Server for Order Book Access ---\n");
    printf("Available endpoints:\n");
    printf("  GET  /trades           - Get all trades\n");
    printf("  GET  /trades?user=X    - Get trades for user X\n");
    printf("  POST /order?user=X&type=Y&side=Z&price=P&quantity=Q - Add order\n");
    printf("    where: type = 'limit' or 'market'\n");
    printf("           side = 'buy' or 'sell'\n\n");

    start_http_server();
    
    /* Destroy the enclave */
    sgx_destroy_enclave(global_eid);
    
    return 0;
}


