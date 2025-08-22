#!/usr/bin/env python3
import asyncio
import websockets
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

connected_clients = set()

async def handle_client(websocket):
    """Handle WebSocket client connections"""
    connected_clients.add(websocket)
    client_ip = websocket.remote_address[0] if websocket.remote_address else "unknown"
    logger.info(f"New client connected from {client_ip}. Total clients: {len(connected_clients)}")
    
    try:
        async for message in websocket:
            try:
                # Parse JSON message
                data = json.loads(message)
                logger.info(f"Received: {data}")
                
                # Echo back with response
                response = {
                    "type": "response",
                    "original": data,
                    "message": f"Server received: {data.get('message', 'No message')}",
                    "timestamp": asyncio.get_event_loop().time()
                }
                
                await websocket.send(json.dumps(response))
                logger.info(f"Sent response: {response}")
                
            except json.JSONDecodeError:
                error_msg = {"type": "error", "message": "Invalid JSON"}
                await websocket.send(json.dumps(error_msg))
                
    except websockets.exceptions.ConnectionClosed:
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"Error: {e}")
    finally:
        connected_clients.discard(websocket)
        logger.info(f"Client removed. Total clients: {len(connected_clients)}")

async def main():
    # Start server
    server = await websockets.serve(handle_client, "localhost", 8765)
    logger.info("WebSocket server started on ws://localhost:8765")
    logger.info("Waiting for Chrome extension connections...")
    
    # Keep server running
    await server.wait_closed()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped.")