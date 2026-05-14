// ============================================
//   ChromaSense — background.js (FIXED)
//   Handles broadcasting filter to all tabs
// ============================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({
    cvdEnabled:    true,
    cvdType:       null,
    severity:      'None',
    overallScore:  0,
    manualMode:    false,
    manualCVDType: 'Normal',
  });
  console.log('[ChromaSense BG] Installed.');
});

// ============================================
//   Listen for internal messages
// ============================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // content.js asks to broadcast filter to all tabs
  if (message.action === 'broadcastFilter') {
    console.log('[ChromaSense BG] Broadcasting filter:', message.cvdType);
    broadcastToAllTabs({
      action:  'applyFilter',
      cvdType: message.cvdType,
      enabled: true,
    }, sender.tab ? sender.tab.id : null); // skip sender tab
    sendResponse({ ok: true });
  }

  // Popup toggle
  if (message.action === 'toggle') {
    chrome.storage.sync.set({ cvdEnabled: message.enabled });
    broadcastToAllTabs({ action: 'toggle', enabled: message.enabled });
    sendResponse({ ok: true });
  }

  // Popup manual mode
  if (message.action === 'applyFilter') {
    broadcastToAllTabs({
      action:  'applyFilter',
      cvdType: message.cvdType,
      enabled: message.enabled !== false,
    });
    sendResponse({ ok: true });
  }

  return true;
});

// ============================================
//   External message from website
//   (only works if EXTENSION_ID is set in app.js)
// ============================================
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (message.action === 'setProfile') {
    chrome.storage.sync.set({
      cvdType:      message.cvdType,
      severity:     message.severity     || 'None',
      overallScore: message.overallScore || 0,
      cvdEnabled:   true,
      manualMode:   false,
    }, () => {
      broadcastToAllTabs({ action:'applyFilter', cvdType:message.cvdType, enabled:true });
      sendResponse({ success: true });
    });
    return true;
  }
});

// ============================================
//   Re-apply on tab reload
// ============================================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;

  chrome.storage.sync.get(['cvdEnabled','cvdType','manualMode','manualCVDType'], (data) => {
    if (!data.cvdEnabled || !data.cvdType) return;
    const type = data.manualMode ? data.manualCVDType : data.cvdType;
    if (type && !type.includes('Normal')) {
      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          action: 'applyFilter', cvdType: type, enabled: true,
        }).catch(() => {});
      }, 300); // small delay to ensure content.js is ready
    }
  });
});

// ============================================
//   Broadcast to ALL tabs (except skipTabId)
// ============================================
function broadcastToAllTabs(message, skipTabId) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (!tab.url) return;
      if (tab.url.startsWith('chrome://')) return;
      if (tab.url.startsWith('chrome-extension://')) return;
      if (tab.id === skipTabId) return; // skip the sender
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    });
  });
}