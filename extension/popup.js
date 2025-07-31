document.getElementById("captureBtn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "capture" }, (response) => {
    if (response.success) {
      console.log("Screenshot captured!");
     const img = document.createElement("img");
      img.src = response.screenshot;
      img.style.maxWidth = "100%";
      document.body.appendChild(img);
      chrome.downloads.download({
        url: response.screenshot,
        filename: `webmcp/screenshots/screenshot-${Date.now()}.png`,
        saveAs: false,
      }, (downloadId)=> {
        if(chrome.runtime.lastError) {
            console.log("Failed to download", chrome.runtime.lastError);
        } else {
            console.log("Screenshot saved to downloads/webmcp/screenshots")
        }
      })
    } else {
      console.error("Failed to capture:", response.error);
    }
  });
});
