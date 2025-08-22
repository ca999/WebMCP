// Content script for WebSocket extension
// This script runs in the context of web pages

class ContentScriptManager {
    constructor() {
        this.init();
    }

    init() {
        console.log('WebSocket Extension content script loaded');
        
        // Listen for messages from background script
        this.listenForMessages();
        
        // Add visual indicator (optional)
        this.createConnectionIndicator();
    }

    listenForMessages() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('Content script received message:', message);
            
            switch (message.type) {
                case 'connection_status':
                    this.handleConnectionStatus(message);
                    break;
                    
                case 'server_message':
                    this.handleServerMessage(message);
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
            
            sendResponse({ received: true });
            return true;
        });
    }

    handleConnectionStatus(message) {
        console.log('Connection status changed:', message.status);
        this.updateConnectionIndicator(message.status);
        
        // You can add custom logic here for different connection states
        if (message.status === 'connected') {
            console.log('WebSocket connected - ready to communicate with server');
        } else if (message.status === 'disconnected') {
            console.log('WebSocket disconnected');
        }
    }

    handleServerMessage(message) {
        console.log('Received message from server:', message.data);
        
        // Handle different types of server messages
        const serverData = message.data;
        
        switch (serverData.type) {
            case 'pong':
                console.log('Received pong from server');
                break;
                
            case 'echo_response':
                console.log('Received echo response:', serverData.original_message);
                break;
                
            case 'broadcast':
                console.log('Received broadcast message:', serverData.message);
                this.showNotification('Broadcast', serverData.message);
                break;
                
            case 'server_heartbeat':
                console.log('Server heartbeat - clients connected:', serverData.connected_clients);
                break;
                
            default:
                console.log('Unknown server message type:', serverData.type);
        }
    }

    // Send message to server via background script
    sendToServer(messageData) {
        chrome.runtime.sendMessage({
            type: 'send_to_server',
            data: messageData
        }, (response) => {
            console.log('Message sent to server:', response);
        });
    } }