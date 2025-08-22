const SERVER_URL = 'http://localhost:3000';

// Create an alarm to periodically check the server.
chrome.alarms.create('checkServerStatus', {
    periodInMinutes: 0.1 // Run every 6 seconds (0.1 minutes)
});

// Add a listener for the alarm.
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkServerStatus') {
        checkForScreenshotRequest();
    }
});

async function checkForScreenshotRequest() {
    try {
        const response = await fetch(`${SERVER_URL}/check-status`);
        const data = await response.json();

        // Check if a request exists.
        if (data.request) {
            console.log(`Server requested a screenshot for ID: ${data.request.id}`);
            // If a request is found, trigger the screenshot process.
            await captureAndUploadScreenshot(data.request.id);
        }
    } catch (error) {
        console.error('Error polling server:', error);
    }
}

async function captureAndUploadScreenshot(id) {
    try {
        // We'll capture the entire visible area of the current window.
        // This is a more reliable way to take a screenshot from a background service worker
        // and doesn't rely on the temporary 'activeTab' permission.
        const screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });

        if (!screenshotDataUrl) {
            console.error('Failed to capture screenshot.');
            return;
        }
        
        // Upload the screenshot to the server.
        await fetch(`${SERVER_URL}/upload-screenshot`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                id: id,
                screenshotData: screenshotDataUrl
            })
        });

        console.log(`Screenshot for ID: ${id} uploaded successfully.`);

    } catch (error) {
        console.error('Error capturing or uploading screenshot:', error);
    }
}
