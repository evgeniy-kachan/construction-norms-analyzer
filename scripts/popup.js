document.addEventListener('DOMContentLoaded', () => {
  const openAppButton = document.getElementById('openApp');

  openAppButton.addEventListener('click', () => {
    // Open the web application in a new tab
    chrome.tabs.create({
      url: chrome.runtime.getURL('index.html'),
    });
  });
});
