import datetime
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
import time
import base64
import os

app = Flask(__name__)
# Enable CORS for the Chrome extension
CORS(app)

# Simple in-memory storage for pending screenshot requests and results.
# In a real-world application, you would use a database.
screenshot_requests = []
screenshot_results = []

@app.route('/request-screenshot', methods=['POST'])
def request_screenshot():
    """
    API Endpoint: /request-screenshot
    Use this endpoint to trigger a screenshot request.
    The client requesting the screenshot provides a unique ID.
    """
    data = request.json
    request_id = data.get('id')

    if not request_id:
        request_id = f"screenshot-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}"

    # Add the new request to our queue.
    screenshot_requests.append({"id": request_id, "status": "pending", "timestamp": time.time()})
    print(f"Screenshot request received for ID: {request_id}")
    return jsonify({"message": f"Screenshot request sent with ID: {request_id}"})

@app.route('/check-status', methods=['GET'])
def check_status():
    """
    API Endpoint: /check-status
    The Chrome extension polls this endpoint to check for new requests.
    """
    if screenshot_requests:
        # Return the first pending request to the extension.
        request_obj = screenshot_requests.pop(0)
        return jsonify({"request": request_obj})
    else:
        # No pending requests, so send an empty response.
        return jsonify({"request": None})

@app.route('/upload-screenshot', methods=['POST'])
def upload_screenshot():
    """
    API Endpoint: /upload-screenshot
    The Chrome extension uses this endpoint to send the screenshot data back.
    This function has been updated to save the screenshot locally.
    """
    data = request.json
    request_id = data.get('id')
    screenshot_data = data.get('screenshotData')

    if not request_id or not screenshot_data:
        return jsonify({"error": "Request ID and screenshot data are required."}), 400

    try:
        # Create a directory to store screenshots if it doesn't exist
        screenshots_dir = Path.home() / "Downloads" / "Webmcp" / "screenshots"
        if not os.path.exists(screenshots_dir):
            os.makedirs(screenshots_dir)

        # The screenshot data is a Data URL (e.g., 'data:image/png;base64,iVBORw...').
        # We need to remove the prefix to get the raw base64 data.
        header, base64_data = screenshot_data.split(',', 1)

        # Decode the base64 string to binary data
        binary_data = base64.b64decode(base64_data)
        

        # Define a filename based on the request ID and save the image
        filename = f"{screenshots_dir}/{request_id}.png"
        print("HELLO", filename)
        with open(filename, 'wb') as f:
            f.write(binary_data)
        
        print(f"Screenshot for ID: {request_id} saved to {filename}")

        return jsonify({"message": f"Screenshot for ID: {request_id} received and saved."})

    except Exception as e:
        print(f"Error processing screenshot upload: {e}")
        return jsonify({"error": "Failed to process screenshot upload."}), 500

if __name__ == '__main__':
    app.run(port=3000, debug=True)