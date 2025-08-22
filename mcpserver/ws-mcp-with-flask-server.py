import asyncio
import websockets
import json, base64
from aiohttp import web
from pathlib import Path
import datetime


clients = set()

# This will map HTTP requests to futures waiting for a screenshot
pending_futures = []

async def ws_handler(ws):
    print("[WebSocket] Client connected")
    clients.add(ws)
    try:
        async for message in ws:
            data = json.loads(message)
            if data.get("action") == 'screenshot':
                data_url = data.get('dataUrl')
                print("hello")
                if data_url:
                    base64_data = data_url.split(",", 1)[1]
                    latest_screenshot = base64.b64decode(base64_data)
                    screenshots_dir = Path.home() / "Downloads" / "Webmcp" / "screenshots"
                    screenshots_dir.mkdir(parents=True, exist_ok=True)
                    filename = screenshots_dir / f"screenshot-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}.png"
                    with open(filename, "wb") as f:
                        f.write(latest_screenshot)
                    print(f"Saved screenshot as {filename}")
    finally:
        print("[WebSocket] Client disconnected")
        clients.remove(ws)

async def start_websocket_server():
    print("[Server] Starting WebSocket on ws://localhost:8765")
    async with websockets.serve(ws_handler, "localhost", 8765, max_size=10 * 1024 * 1024):
        await asyncio.Future()  # Run forever

async def handle_screenshot_request(request):
    if not clients:
        return web.Response(text="No extension connected", status=400)

    # Send capture message to all clients
    for ws in clients:
        await ws.send(json.dumps({ "action": "capture" }))

    # Wait for the screenshot
    future = asyncio.get_event_loop().create_future()
    pending_futures.append(future)

    try:
        image_bytes = await asyncio.wait_for(future, timeout=5)
        return web.Response(body=image_bytes, content_type="image/png")
    except asyncio.TimeoutError:
        return web.Response(text="Screenshot timed out", status=504)

def start_http_server():
    app = web.Application()
    app.router.add_get("/screenshot", handle_screenshot_request)
    return app

async def main():
    await asyncio.gather(
        start_websocket_server(),
        web._run_app(start_http_server(), port=5001)
    )

if __name__ == "__main__":
    asyncio.run(main())
