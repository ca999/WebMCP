from flask import Flask, Response, jsonify
import asyncio
import websockets
import threading
import base64
import json
import time
import queue
from io import BytesIO

app = Flask(__name__)

# Shared state
ws_connection = None
ws_loop = None
# Use a thread-safe queue for communication
screenshot_queue = queue.Queue()

# --- WebSocket Handler ---
async def websocket_handler(ws):
    global ws_connection
    print("[WebSocket] Extension connected.")
    ws_connection = ws
    try:
        async for message in ws:
            print(f"[WebSocket] Received message: {message[:100]}...")  # Log first 100 chars
            data = json.loads(message)
            if data.get("action") == "screenshot":
                data_url = data.get("dataUrl", "")
                if "," in data_url:
                    base64_data = data_url.split(",", 1)[1]
                    print("[WebSocket] Putting screenshot data in queue")
                    screenshot_queue.put(base64.b64decode(base64_data))
                else:
                    print("[WebSocket] Invalid data URL format")
                    screenshot_queue.put(None)  # Signal error
            elif data.get("error"):
                print(f"[WebSocket] Extension error: {data.get('error')}")
                screenshot_queue.put(None)  # Signal error
            else:
                print(f"[WebSocket] Unknown action: {data.get('action')}")
    except websockets.exceptions.ConnectionClosed:
        print("[WebSocket] Connection closed normally")
    except Exception as e:
        print(f"[WebSocket] Error: {e}")
    finally:
        print("[WebSocket] Extension disconnected.")
        ws_connection = None

def start_websocket_server():
    global ws_loop
    async def start():
        print("[WebSocket] Starting server on ws://localhost:8765")
        await websockets.serve(websocket_handler, "localhost", 8765)
    
    ws_loop = asyncio.new_event_loop()
    asyncio.set_event_loop(ws_loop)
    ws_loop.run_until_complete(start())
    ws_loop.run_forever()

# Start the WebSocket server thread
ws_thread = threading.Thread(target=start_websocket_server, daemon=True)
ws_thread.start()

# Give the WebSocket server time to start
time.sleep(1)

# --- Streaming Capture Endpoint ---
@app.route("/capture", methods=["GET"])
def capture_and_stream():
    print(f"[HTTP] Capture request received. WebSocket connected: {ws_connection is not None}")
    
    # Wait up to 5 seconds for WebSocket to be ready
    for i in range(50):
        if ws_connection is not None:
            print(f"[HTTP] WebSocket ready after {i * 0.1:.1f}s")
            break
        time.sleep(0.1)
    else:
        print("[HTTP] WebSocket connection timeout")
        return jsonify({"error": "Extension not connected"}), 503
    
    if ws_loop is None:
        print("[HTTP] WebSocket loop not initialized")
        return jsonify({"error": "WebSocket loop not initialized"}), 500
    
    # Clear any old screenshots from the queue
    while not screenshot_queue.empty():
        try:
            screenshot_queue.get_nowait()
        except queue.Empty:
            break
    
    # Send capture command to extension
    try:
        print("[HTTP] Sending capture command to extension")
        future = asyncio.run_coroutine_threadsafe(
            ws_connection.send('{"action": "capture"}'), 
            ws_loop
        )
        future.result(timeout=5)  # Wait for send to complete
        print("[HTTP] Capture command sent successfully")
    except Exception as e:
        print(f"[HTTP] Failed to send capture command: {str(e)}")
        return jsonify({"error": f"Failed to send capture command: {str(e)}"}), 500
    
    def generate():
        print("[HTTP] Starting to wait for screenshot data")
        try:
            # Wait for screenshot data from WebSocket via queue
            data = screenshot_queue.get(timeout=15)
            if data is None:
                print("[HTTP] Received error signal from extension")
                yield b"Error: Extension failed to capture screenshot\r\n"
                return
            
            print(f"[HTTP] Received screenshot data: {len(data)} bytes")
            yield b"--frame\r\n"
            yield b"Content-Type: image/png\r\n\r\n" + data + b"\r\n"
            yield b"--frame--\r\n"
        except queue.Empty:
            print("[HTTP] Screenshot capture timed out")
            yield b"Error: Screenshot capture timed out\r\n"
        except Exception as e:
            print(f"[HTTP] Error in generate: {str(e)}")
            yield f"Error: {str(e)}".encode()
    
    return Response(generate(), mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/status")
def status():
    connected = ws_connection is not None
    print(f"[HTTP] Status check: extension_connected={connected}")
    return jsonify({"extension_connected": connected})

if __name__ == "__main__":
    print("[Flask] Starting Flask server on port 8766")
    app.run(port=8766, threaded=True, use_reloader=False)