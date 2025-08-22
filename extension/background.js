// Background script for WebSocket connection management
console.log('=== WebSocket Extension Background Script Loading ===');

class WebSocketManager {
    constructor() {
        console.log('WebSocket Manager initializing...');
        this.socket = null;
        this.serverUrl = 'ws://localhost:8765';
        this.reconnectInterval = 3000; // 3 seconds - faster reconnection
        this.maxReconnectAttempts = 999; // Essentially unlimited auto-reconnection
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.autoReconnect = true; // Enable auto-reconnection by default
        console.log(`WebSocket Manager initialized. Server URL: ${this.serverUrl}`);
    }

    connect() {
        if (this.isConnecting || (this.socket && this.socket.readyState === WebSocket.OPEN)) {
            return;
        }

        this.isConnecting = true;

        try {
            this.socket = new WebSocket(this.serverUrl);

            this.socket.onopen = (event) => {
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                
                // Send initial connection message
                this.sendMessage({
                    type: 'ping',
                    message: 'Extension connected',
                    timestamp: Date.now()
                });

                // Notify popup and content scripts about connection
                this.broadcastToExtension({
                    type: 'connection_status',
                    status: 'connected',
                    message: 'Connected to server'
                });
            };

            this.socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Broadcast to all extension components
                    this.broadcastToExtension({
                        type: 'server_message',
                        data: data
                    });

                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };

            this.socket.onclose = (event) => {
                console.log(`WebSocket connection closed:`, event.code, event.reason);
                this.isConnecting = false;
                this.socket = null;

                // Notify extension components
                this.broadcastToExtension({
                    type: 'connection_status',
                    status: 'disconnected',
                    message: 'Disconnected from server'
                });

                // Attempt to reconnect automatically
                if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect();
                }
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnecting = false;
                
                // Notify extension components
                this.broadcastToExtension({
                    type: 'connection_status',
                    status: 'error',
                    message: 'Connection error'
                });
            };

        } catch (error) {
            console.error('Failed to create WebSocket:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        if (!this.autoReconnect || this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Auto-reconnection disabled or max attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Scheduling auto-reconnection attempt ${this.reconnectAttempts} in ${this.reconnectInterval}ms`);
        
        setTimeout(() => {
            if (this.autoReconnect) { // Check again in case it was disabled
                this.connect();
            }
        }, this.reconnectInterval);
    }

    sendMessage(message) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            console.log('Sent message to server:', message);
        } else {
            console.warn('WebSocket is not connected. Message not sent:', message);
        }
    }

    broadcastToExtension(message) {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, message).catch(() => {
                });
            });
        });

        chrome.storage.local.set({ latestMessage: message });
    }

    disconnect() {
        this.autoReconnect = false; 
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        console.log('WebSocket disconnected - auto-reconnection disabled');
    }

    getConnectionStatus() {
        if (!this.socket) return 'disconnected';
        
        switch (this.socket.readyState) {
            case WebSocket.CONNECTING:
                return 'connecting';
            case WebSocket.OPEN:
                return 'connected';
            case WebSocket.CLOSING:
                return 'closing';
            case WebSocket.CLOSED:
                return 'disconnected';
            default:
                return 'unknown';
        }
    }
}

// Create WebSocket manager instance
const wsManager = new WebSocketManager();

// Auto-connect when extension loads
wsManager.connect();

// Auto-reconnect mechanism - try to connect every 10 seconds if disconnected
setInterval(() => {
    const status = wsManager.getConnectionStatus();
    if (status === 'disconnected' && wsManager.reconnectAttempts < wsManager.maxReconnectAttempts) {
        console.log('🔄 Auto-reconnect timer triggered...');
        wsManager.connect();
    }
}, 10000);

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);

    switch (message.type) {
        case 'send_to_server':
            wsManager.sendMessage(message.data);
            sendResponse({ success: true });
            break;

        case 'get_connection_status':
            sendResponse({ 
                status: wsManager.getConnectionStatus(),
                reconnectAttempts: wsManager.reconnectAttempts 
            });
            break;

        case 'reconnect':
            wsManager.reconnectAttempts = 0; // Reset counter for manual reconnect
            wsManager.connect();
            sendResponse({ success: true });
            break;

        case 'disconnect':
            wsManager.disconnect();
            sendResponse({ success: true });
            break;

        default:
            sendResponse({ error: 'Unknown message type' });
    }

    return true; // Keep message channel open for async response
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('Extension started - auto-connecting to WebSocket');
    wsManager.connect();
});

// Handle extension install
chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed - auto-connecting to WebSocket');
    wsManager.connect();
});

// Handle browser startup (when Chrome opens)
chrome.runtime.onSuspendCanceled.addListener(() => {
    console.log('Extension resumed - auto-connecting to WebSocket');
    wsManager.connect();
});