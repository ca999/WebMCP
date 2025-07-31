let ws;

function setupWebsocket() {
  ws = new WebSocket("ws://localhost:8765")
  ws.onopen = () => console.log("Websocket connected to MCP server");

  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if(message.action === "capture") {
      captureScreenshot();
    }
  }

  ws.onerror = (err) => console.error("Websocket eerror:", err);
  ws.onclose = () => {
    console.log("Websocket closed, reconnecting in 3 sec");
    setTimeout(setupWebsocket, 3000)
  }
}


function captureScreenshot() {
  chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        if(ws && ws.readyState == WebSocket.OPEN) {
          ws.send(JSON.stringify({
            action: 'screenshot',
            dataUrl: dataUrl
          }))
        }
      }
    });
}



chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'capture') {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, screenshot: dataUrl });
      }
    });
    return true; 
  }
});

setupWebsocket()