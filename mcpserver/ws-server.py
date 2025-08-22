import asyncio
import websockets
import json, base64
from pathlib import Path
import datetime

connected = set()
async def handler(ws):
    print("[Server] Client connected")
    connected.add(ws)
    try:
        async def send_capture():
            print("hello")
            while True:
                await asyncio.sleep(2)
                await ws.send('{"action": "capture"}')
        async def receiveAndSave():
            async for message in ws:
                data = json.loads(message)
                if data.get("error"):
                    print(data.get('error'))
                elif data.get("action") == 'screenshot':
                    dataUrl = data.get('dataUrl')
                    if dataUrl:
                        data = dataUrl.split(",", 1)[1]
                        screenshots_dir = Path("~/Downloads/Webmcp/screenshots").expanduser()
                        screenshots_dir.mkdir(exist_ok=True)
                        filename = f"screenshot-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}.png"
                        full_path = screenshots_dir / filename
                        with open(full_path, "wb") as f:
                            f.write(base64.b64decode(data))
                        print(f"Saved screenshot as {filename}")
        await asyncio.gather(send_capture(), receiveAndSave())
    finally:
        connected.remove(ws)


async def main():
    print("[Server] Starting WebSocket server on ws://localhost:8765")
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()

asyncio.run(main())