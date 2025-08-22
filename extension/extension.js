let ws;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;

function setupWebsocket() {
  console.log("Setting up WebSocket connection...");
  ws = new WebSocket("ws://localhost:8765");
  
  ws.onopen = () => {
    console.log("WebSocket connected to MCP server");
    reconnectAttempts = 0;
    
    // Send a test message to confirm connection
    ws.send(JSON.stringify({ action: 'test', message: 'Extension connected successfully' }));
  };

  ws.onmessage = (event) => {
    console.log("WebSocket message received:", event.data);
    try {
      const message = JSON.parse(event.data);
      if (message.action === "capture") {
        console.log("Capture request received via WebSocket");
        
        // Test if we have the right permissions first
        if (typeof chrome === 'undefined') {
          console.error("Chrome API not available");
          sendError("Chrome API not available");
          return;
        }
        
        if (!chrome.tabs || !chrome.tabs.captureVisibleTab) {
          console.error("chrome.tabs.captureVisibleTab not available");
          sendError("Screenshot API not available");
          return;
        }
        
        captureScreenshot();
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
      sendError("Failed to parse message: " + error.message);
    }
  };

  ws.onerror = (err) => {
    console.error("WebSocket error:", err);
  };
  
  ws.onclose = (event) => {
    console.log("WebSocket closed:", event.code, event.reason);
    
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      console.log(`WebSocket reconnecting in 3 sec (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
      setTimeout(setupWebsocket, 3000);
    } else {
      console.error("Max reconnection attempts reached");
    }
  };
}

function sendError(errorMessage) {
  console.error("Sending error:", errorMessage);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'screenshot',
      error: errorMessage
    }));
  }
}

function captureScreenshot() {
  console.log("Starting screenshot capture...");
  
  try {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      console.log("captureVisibleTab callback called");
      
      if (chrome.runtime.lastError) {
        console.error("Screenshot capture error:", chrome.runtime.lastError);
        sendError(chrome.runtime.lastError.message);
        return;
      }
      
      if (!dataUrl) {
        console.error("No data URL returned");
        sendError("No screenshot data received");
        return;
      }
      
      console.log("Screenshot captured successfully, data URL length:", dataUrl.length);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        console.log("Sending screenshot via WebSocket");
        ws.send(JSON.stringify({
          action: 'screenshot',
          dataUrl: dataUrl
        }));
        console.log("Screenshot sent successfully");
      } else {
        console.error("WebSocket not ready when trying to send screenshot, state:", ws ? ws.readyState : 'no connection');
        sendError("WebSocket connection lost");
      }
    });
  } catch (error) {
    console.error("Exception in captureScreenshot:", error);
    sendError("Exception during capture: " + error.message);
  }
}

// Keep the existing message listener for compatibility
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Runtime message received:", message);
  if (message.action === 'capture') {
    captureScreenshot();
    sendResponse({ success: true, message: "Capture initiated" });
    return true; 
  }
});

// Start WebSocket connection
console.log("Extension loaded, setting up WebSocket...");
setupWebsocket();