import asyncio
import websockets
import json
import logging
import base64
import os
from datetime import datetime
import uuid

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebSocketServer:
    def __init__(self, host='localhost', port=8765):
        self.host = host
        self.port = port
        self.clients = set()
        self.screenshots_dir = 'webmcp_screenshots'
        self.ensure_screenshots_dir()

    async def register_client(self, websocket):
        """Register a new client connection"""
        self.clients.add(websocket)
        logger.info(f"Client connected. Total clients: {len(self.clients)}")

    async def unregister_client(self, websocket):
        """Unregister a client connection"""
        self.clients.discard(websocket)
        logger.info(f"Client disconnected. Total clients: {len(self.clients)}")

    def ensure_screenshots_dir(self):
        """Create screenshots directory if it doesn't exist"""
        if not os.path.exists(self.screenshots_dir):
            os.makedirs(self.screenshots_dir)
            logger.info(f"Created screenshots directory: {self.screenshots_dir}")

    async def request_screenshot(self, save_local=True, send_to_server=True):
        """Request a screenshot from all connected clients"""
        if not self.clients:
            logger.warning("No clients connected to request screenshot from")
            return False

        command_id = str(uuid.uuid4())
        screenshot_command = {
            'type': 'screenshot_command',
            'commandId': command_id,
            'saveLocal': save_local,
            'sendToServer': send_to_server,
            'timestamp': asyncio.get_event_loop().time()
        }

        logger.info(f"📸 Requesting screenshot from {len(self.clients)} client(s)")

        await self.broadcast_message(json.dumps(screenshot_command))
        return command_id

    async def handle_client(self, websocket):
        """Handle messages from a client"""
        await self.register_client(websocket)
        try:
            async for message in websocket:
                try:
                    # Parse incoming JSON message
                                        # Parse incoming JSON message
                    try:
                        data = json.loads(message)
                    except (json.JSONDecodeError, TypeError):
                        logger.info("Error ========================: {message}")
                    
                    logger.info(f"Received message: {data}")
                    
                    # Handle different message types
                    if data.get('type') == 'ping':
                        # Respond to ping with pong
                        response = {
                            'type': 'pong',
                            'message': 'Server is alive',
                            'timestamp': asyncio.get_event_loop().time()
                        }
                        await websocket.send(json.dumps(response))
                    
                    elif data.get('type') == 'echo':
                        # Echo the message back
                        response = {
                            'type': 'echo_response',
                            'original_message': data.get('message', ''),
                            'timestamp': asyncio.get_event_loop().time()
                        }
                        await websocket.send(json.dumps(response))
                    
                    elif data.get('type') == 'broadcast':
                        # Broadcast message to all connected clients
                        broadcast_data = {
                            'type': 'broadcast',
                            'message': data.get('message', ''),
                            'from': 'server',
                            'timestamp': asyncio.get_event_loop().time()
                        }
                        await self.broadcast_message(json.dumps(broadcast_data))
                    
                    elif data.get('type') == 'screenshot_result':
                        # Handle screenshot data from client
                        await self.handle_screenshot_result(data)
                    
                    elif data.get('type') == 'screenshot_status':
                        # Handle screenshot status from client
                        logger.info(f"📸 Screenshot status: {data}")
                        if data.get('success'):
                            logger.info(f"✅ Screenshot successful - Tab: {data.get('tabTitle', 'Unknown')}")
                        else:
                            logger.error(f"❌ Screenshot failed: {data.get('error', 'Unknown error')}")
                    
                    else:
                        # Handle unknown message types
                        response = {
                            'type': 'error',
                            'message': f"Unknown message type: {data.get('type', 'undefined')}",
                            'timestamp': asyncio.get_event_loop().time()
                        }
                        await websocket.send(json.dumps(response))
                        
                except json.JSONDecodeError:
                    # Handle invalid JSON
                    error_response = {
                        'type': 'error',
                        'message': 'Invalid JSON format',
                        'timestamp': asyncio.get_event_loop().time()
                    }
                    await websocket.send(json.dumps(error_response))
                    
        except websockets.exceptions.ConnectionClosed:
            logger.info("Client connection closed")
        except Exception as e:
            logger.error(f"Error handling client: {e}")
        finally:
            await self.unregister_client(websocket)

    async def broadcast_message(self, message):
        """Broadcast a message to all connected clients"""
        if self.clients:
            await asyncio.gather(
                *[client.send(message) for client in self.clients],
                return_exceptions=True
            )

    async def start_server(self):
        """Start the WebSocket server"""
        logger.info(f"Starting WebSocket server on {self.host}:{self.port}")
        
        # Start the server (websockets library handles CORS automatically for WebSocket connections)
        server = await websockets.serve(
            self.handle_client, 
            self.host, 
            self.port
        )
        
        logger.info(f"WebSocket server started successfully!")
        logger.info(f"Extension can connect to: ws://{self.host}:{self.port}")
        
        # Keep the server running
        await server.wait_closed()

    async def handle_screenshot_result(self, data):
        """Handle screenshot data received from client"""
        try:
           dataUrl = data.get('dataUrl')
           print(dataUrl)
           if dataUrl:
                data = dataUrl.split(",", 1)[1]
                screenshots_dir = Path("~/Downloads/Webmcp/screenshots").expanduser()
                screenshots_dir.mkdir(exist_ok=True)
                filename = f"screenshot-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}.png"
                full_path = screenshots_dir / filename
                with open(full_path, "wb") as f:
                    f.write(base64.b64decode(data))
                    print(f"Saved screenshot as {filename}")
            
        except Exception as e:
            logger.error(f"❌ Failed to handle screenshot: {e}")

    async def send_periodic_messages(self):
        """Send periodic messages to all clients (optional feature)"""
        while True:
            if self.clients:
                message = {
                    'type': 'server_heartbeat',
                    'message': 'Server heartbeat',
                    'timestamp': asyncio.get_event_loop().time(),
                    'connected_clients': len(self.clients)
                }
                await self.broadcast_message(json.dumps(message))
            await asyncio.sleep(30)  # Send every 30 seconds

    async def interactive_mode(self):
        """Interactive mode for sending commands"""
        while True:
            try:
                await asyncio.sleep(1)  # Small delay to prevent busy loop
                # You can add interactive commands here
                # For now, this is a placeholder for manual screenshot triggering
            except KeyboardInterrupt:
                break

    async def send_periodic_messages(self):
        """Send periodic messages to all clients (optional feature)"""
        while True:
            if self.clients:
                message = {
                    'type': 'server_heartbeat',
                    'message': 'Server heartbeat',
                    'timestamp': asyncio.get_event_loop().time(),
                    'connected_clients': len(self.clients)
                }
                await self.broadcast_message(json.dumps(message))
            await asyncio.sleep(30)  # Send every 30 seconds

async def main():
    # Create server instance
    server = WebSocketServer(host='localhost', port=8765)
    
    print("🚀 Starting WebSocket Server with Screenshot Support...")
    print("📸 Screenshots will be saved to: webmcp_screenshots/")
    print("🔗 Extension will connect to: ws://localhost:8765")
    print("\n📋 Available commands:")
    print("  - Type 'screenshot' to capture active tab")
    print("  - Type 'quit' to stop server")
    print("  - Press Ctrl+C to stop server")
    print("\n" + "="*50)
    
    # Run server and interactive mode concurrently
    server_task = asyncio.create_task(server.start_server())
    
    # Simple command interface
    async def command_interface():
        import aioconsole
        while True:
            try:
                command = await aioconsole.ainput("Enter command (screenshot/quit): ")
                command = command.strip().lower()
                
                if command == 'quit':
                    print("🛑 Shutting down server...")
                    break
                elif command == 'screenshot':
                    command_id = await server.request_screenshot()
                    if command_id:
                        print(f"📸 Screenshot requested (ID: {command_id[:8]}...)")
                    else:
                        print("❌ No clients connected")
                elif command == '':
                    continue
                else:
                    print("❓ Unknown command. Use 'screenshot' or 'quit'")
                    
            except EOFError:
                break
            except Exception as e:
                print(f"❌ Error: {e}")
    
    # Run command interface if aioconsole is available, otherwise just run server
    try:
        import aioconsole
        await asyncio.gather(server_task, command_interface())
    except ImportError:
        print("💡 Install aioconsole for interactive commands: pip install aioconsole")
        print("🔄 Server running... Press Ctrl+C to stop")
        await server_task

if __name__ == "__main__":
    try:
        asyncio.run(main())
        
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
    except Exception as e:
        print(f"❌ Server error: {e}")
        print("💡 Make sure you have: pip install websockets")
        if "aioconsole" in str(e):
            print("💡 For interactive mode: pip install aioconsole")