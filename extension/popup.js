// Popup script for WebSocket extension
class PopupManager {
    constructor() {
        this.messages = [];
        this.init();
    }

    init() {
        // Get DOM elements
        this.statusElement = document.getElementById('status');
        this.statusText = document.getElementById('status-text');
        this.connectBtn = document.getElementById('connect-btn');
        this.disconnectBtn = document.getElementById('disconnect-btn');
        this.sendBtn = document.getElementById('send-btn');
        this.messageInput = document.getElementById('message-input');
        this.messageType = document.getElementById('message-type');
        this.messagesContainer = document.getElementById('messages');
        this.clearBtn = document.getElementById('clear-btn');

        // Set up event listeners
        this.setupEventListeners();
        
        // Update status on load
        this.updateConnectionStatus();
        
        // Load stored messages
        this.loadStoredMessages();
        
        // Listen for background script messages
        this.listenForMessages();
    }

    setupEventListeners() {
        this.connectBtn.addEventListener('click', () => {
            this.sendToBackground({ type: 'reconnect' });
        });

        this.disconnectBtn.addEventListener('click', () => {
            this.sendToBackground({ type: 'disconnect' });
        });

        this.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        this.clearBtn.addEventListener('click', () => {
            this.clearMessages();
        });
    }

    sendToBackground(message) {
        chrome.runtime.sendMessage(message, (response) => {
            console.log('Response from background:', response);
        });
    }

    updateConnectionStatus() {
        this.sendToBackground({ type: 'get_connection_status' }, (response) => {
            if (response && response.status) {
                this.setConnectionStatus(response.status, response.reconnectAttempts);
            }
        });

        chrome.runtime.sendMessage({ type: 'get_connection_status' }, (response) => {
            if (response && response.status) {
                this.setConnectionStatus(response.status, response.reconnectAttempts);
            }
        });
    }

    setConnectionStatus(status, reconnectAttempts = 0) {
        // Update status display
        this.statusElement.className = `status ${status}`;
        
        let statusMessage = '';
        switch (status) {
            case 'connected':
                statusMessage = 'Auto-connected to server ✓';
                this.connectBtn.disabled = true;
                this.disconnectBtn.disabled = false;
                this.sendBtn.disabled = false;
                break;
            case 'connecting':
                statusMessage = 'Auto-connecting to server...';
                this.connectBtn.disabled = true;
                this.disconnectBtn.disabled = false;
                this.sendBtn.disabled = true;
                break;
            case 'disconnected':
                if (reconnectAttempts > 0) {
                    statusMessage = `Auto-reconnecting... (Attempt ${reconnectAttempts})`;
                } else {
                    statusMessage = 'Disconnected - will auto-reconnect';
                }
                this.connectBtn.disabled = false;
                this.disconnectBtn.disabled = true;
                this.sendBtn.disabled = true;
                break;
            case 'error':
                statusMessage = 'Connection error';
                this.connectBtn.disabled = false;
                this.disconnectBtn.disabled = true;
                this.sendBtn.disabled = true;
                break;
            default:
                statusMessage = 'Unknown status';
                this.connectBtn.disabled = false;
                this.disconnectBtn.disabled = true;
                this.sendBtn.disabled = true;
        }
        
        this.statusText.textContent = statusMessage;
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        const type = this.messageType.value;
        
        if (!message) {
            alert('Please enter a message');
            return;
        }

        const messageData = {
            type: type,
            message: message,
            timestamp: Date.now()
        };

        this.sendToBackground({
            type: 'send_to_server',
            data: messageData
        });

        // Add to local messages
        this.addMessage({
            direction: 'sent',
            type: type,
            content: message,
            timestamp: new Date().toLocaleTimeString()
        });

        // Clear input
        this.messageInput.value = '';
    }

    addMessage(message) {
        this.messages.push(message);
        this.updateMessagesDisplay();
        this.saveMessages();
    }

    updateMessagesDisplay() {
        this.messagesContainer.innerHTML = '';
        
        this.messages.slice(-20).forEach(message => { // Show last 20 messages
            const messageElement = document.createElement('div');
            messageElement.className = 'message';
            
            const direction = message.direction === 'sent' ? '→' : '←';
            const typeInfo = message.type ? ` [${message.type}]` : '';
            
            messageElement.innerHTML = `
                <div>${direction} ${message.content}${typeInfo}</div>
                <div class="message-time">${message.timestamp}</div>
            `;
            
            this.messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    clearMessages() {
        this.messages = [];
        this.updateMessagesDisplay();
        this.saveMessages();
    }

    saveMessages() {
        chrome.storage.local.set({ popupMessages: this.messages });
    }

    loadStoredMessages() {
        chrome.storage.local.get(['popupMessages'], (result) => {
            if (result.popupMessages) {
                this.messages = result.popupMessages;
                this.updateMessagesDisplay();
            }
        });
    }

    listenForMessages() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Popup received message:', message);
            
            if (message.type === 'connection_status') {
                this.setConnectionStatus(message.status);
                this.addMessage({
                    direction: 'received',
                    type: 'status',
                    content: message.message,
                    timestamp: new Date().toLocaleTimeString()
                });
            } else if (message.type === 'server_message') {
                this.addMessage({
                    direction: 'received',
                    type: message.data.type,
                    content: message.data.message || JSON.stringify(message.data),
                    timestamp: new Date().toLocaleTimeString()
                });
            }
            
            sendResponse({ received: true });
        });

        // Check for stored messages from background
        chrome.storage.local.get(['latestMessage'], (result) => {
            if (result.latestMessage) {
                const message = result.latestMessage;
                if (message.type === 'connection_status') {
                    this.setConnectionStatus(message.status);
                }
            }
        });
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});