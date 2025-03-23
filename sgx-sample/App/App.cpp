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
#define BUFFER_SIZE 1024

#include "sgx_urts.h"
#include "App.h"
#include "Enclave_u.h"

/* Global EID shared by multiple threads */
sgx_enclave_id_t global_eid = 0;

// Flag to control server loop
volatile sig_atomic_t keep_running = 1;

// Signal handler for graceful shutdown
void handle_signal(int sig) {
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

// Function to parse HTTP request and extract parameters
int parse_http_request(char* buffer, char* method, char* path, char* query_string) {
    // Extract method
    char* token = strtok(buffer, " ");
    if (token == NULL) return -1;
    strcpy(method, token);
    
    // Extract path with potential query string
    token = strtok(NULL, " ");
    if (token == NULL) return -1;
    
    // Split path and query string
    char* query_start = strchr(token, '?');
    if (query_start) {
        *query_start = '\0';
        strcpy(path, token);
        strcpy(query_string, query_start + 1);
    } else {
        strcpy(path, token);
        query_string[0] = '\0';
    }
    
    return 0;
}

// Function to extract value from query string
int get_query_param(const char* query_string, const char* param_name, char* value, size_t value_size) {
    char query_copy[BUFFER_SIZE];
    strncpy(query_copy, query_string, BUFFER_SIZE - 1);
    query_copy[BUFFER_SIZE - 1] = '\0';
    
    char* token = strtok(query_copy, "&");
    while (token != NULL) {
        char* equals = strchr(token, '=');
        if (equals) {
            *equals = '\0';
            if (strcmp(token, param_name) == 0) {
                strncpy(value, equals + 1, value_size - 1);
                value[value_size - 1] = '\0';
                return 0;
            }
        }
        token = strtok(NULL, "&");
    }
    
    return -1;
}

// Function to send HTTP response
void send_http_response(int client_socket, int status_code, const char* content_type, const char* body) {
    char response[BUFFER_SIZE];
    const char* status_text = (status_code == 200) ? "OK" : "Bad Request";
    
    snprintf(response, BUFFER_SIZE,
             "HTTP/1.1 %d %s\r\n"
             "Content-Type: %s\r\n"
             "Content-Length: %zu\r\n"
             "Connection: close\r\n"
             "\r\n"
             "%s",
             status_code, status_text, content_type, strlen(body), body);
    
    send(client_socket, response, strlen(response), 0);
}

// Function to handle HTTP requests
void handle_http_request(int client_socket) {
    char buffer[BUFFER_SIZE] = {0};
    int bytes_received = recv(client_socket, buffer, BUFFER_SIZE - 1, 0);
    
    if (bytes_received <= 0) {
        close(client_socket);
        return;
    }
    
    // Parse HTTP request
    char method[16] = {0};
    char path[256] = {0};
    char query_string[256] = {0};
    
    if (parse_http_request(buffer, method, path, query_string) < 0) {
        send_http_response(client_socket, 400, "text/plain", "Bad Request");
        close(client_socket);
        return;
    }
    
    // Handle GET request to read number
    if (strcmp(method, "GET") == 0 && strcmp(path, "/read") == 0) {
        int result = 0;
        sgx_status_t status = ecall_read_number(global_eid, &result);
        
        if (status != SGX_SUCCESS) {
            char error_msg[100];
            snprintf(error_msg, sizeof(error_msg), "Error: Failed to call ecall_read_number. Error code: %d", status);
            send_http_response(client_socket, 500, "text/plain", error_msg);
        } else {
            char response_body[100];
            snprintf(response_body, sizeof(response_body), "{\"value\": %d}", result);
            send_http_response(client_socket, 200, "application/json", response_body);
        }
    }
    // Handle POST request to write number
    else if (strcmp(method, "POST") == 0 && strcmp(path, "/write") == 0) {
        // Extract value parameter from query string
        char value_str[32] = {0};
        if (get_query_param(query_string, "value", value_str, sizeof(value_str)) < 0) {
            send_http_response(client_socket, 400, "text/plain", "Missing 'value' parameter");
            close(client_socket);
            return;
        }
        
        // Convert value to integer
        int input_value = atoi(value_str);
        int result = 0;
        
        sgx_status_t status = ecall_write_number(global_eid, &result, input_value);
        
        if (status != SGX_SUCCESS) {
            char error_msg[100];
            snprintf(error_msg, sizeof(error_msg), "Error: Failed to call ecall_write_number. Error code: %d", status);
            send_http_response(client_socket, 500, "text/plain", error_msg);
        } else {
            char response_body[100];
            snprintf(response_body, sizeof(response_body), "{\"value\": %d}", result);
            send_http_response(client_socket, 200, "application/json", response_body);
        }
    }
    // Handle unknown requests
    else {
        send_http_response(client_socket, 404, "text/plain", "Not Found");
    }
    
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
    if (setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt))) {
        perror("Setsockopt failed");
        exit(EXIT_FAILURE);
    }
    
    // Configure address
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(HTTP_PORT);
    
    // Bind socket to address
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
        client_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen);
        if (client_socket < 0) {
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
        printf("Enter a character before exit ...\n");
        getchar();
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
    printf("\n--- Starting HTTP Server for Enclave Access ---\n");
    printf("Available endpoints:\n");
    printf("  GET  /read           - Read value from enclave\n");
    printf("  POST /write?value=X  - Write value X to enclave\n\n");
    
    start_http_server();

    /* Destroy the enclave */
    sgx_destroy_enclave(global_eid);
    
    printf("Info: SampleEnclave successfully returned.\n");

    printf("Enter a character before exit ...\n");
    getchar();
    return 0;
}

