chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "capture_tab") {
    chrome.tabCapture.capture({ audio: false, video: true }, (stream) => {
      if (chrome.runtime.lastError) {
        chrome.runtime.sendMessage({
          type: "error",
          message: chrome.runtime.lastError.message
        });
        return;
      }

      const video = document.createElement("video");
      video.srcObject = stream;
      video.play();

      video.onloadedmetadata = () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/png");

        chrome.runtime.sendMessage({
          type: "screenshot_result",
          dataUrl: dataUrl
        });

        stream.getTracks().forEach(track => track.stop());
      };
    });
  }
});
