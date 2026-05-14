// ============================================
//   ChromaSense — content.js  (FIXED)
//   Injected into EVERY webpage automatically.
//   3 ways to receive the CVD profile:
//   1. chrome.storage (on every page load)
//   2. postMessage from website (same browser)
//   3. chrome.runtime.onMessage from popup/bg
// ============================================

const STYLE_ID = 'chromasense-style';
const SVG_ID   = 'chromasense-svg';

// ============================================
//   ALL 6 CVD CORRECTION MATRICES
// ============================================
const CVD_MATRICES = {
  Protanopia: {
    matrix:   [0.0,2.02344,-2.52581,0,0, 0.0,1.0,0.0,0,0, 0.0,0.0,1.0,0,0, 0,0,0,1,0],
    saturate: 1.3,
    color:    '#FF6B6B',
  },
  Protanomaly: {
    matrix:   [0.817,0.183,0.0,0,0, 0.333,0.667,0.0,0,0, 0.0,0.125,0.875,0,0, 0,0,0,1,0],
    saturate: 1.2,
    color:    '#FF8C42',
  },
  Deuteranopia: {
    matrix:   [1.0,0.0,0.0,0,0, 0.494,0.0,1.248,0,0, 0.0,0.0,1.0,0,0, 0,0,0,1,0],
    saturate: 1.3,
    color:    '#4ECDC4',
  },
  Deuteranomaly: {
    matrix:   [1.0,0.0,0.0,0,0, 0.2,0.8,0.5,0,0, 0.0,0.0,1.0,0,0, 0,0,0,1,0],
    saturate: 1.2,
    color:    '#45B7D1',
  },
  Tritanopia: {
    matrix:   [1.0,0.0,0.0,0,0, 0.0,1.0,0.0,0,0, -0.395,0.801,0.0,0,0, 0,0,0,1,0],
    saturate: 1.2,
    color:    '#FFD166',
  },
  Tritanomaly: {
    matrix:   [1.0,0.0,0.0,0,0, 0.0,1.0,0.0,0,0, -0.2,0.5,0.7,0,0, 0,0,0,1,0],
    saturate: 1.15,
    color:    '#F9A825',
  },
};

// ============================================
//   NORMALISE CVD TYPE STRING
// ============================================
function normaliseCVD(raw) {
  if (!raw) return 'Normal';
  const t = raw.toString().toLowerCase();
  if (t.includes('protanopia'))    return 'Protanopia';
  if (t.includes('protanomaly'))   return 'Protanomaly';
  if (t.includes('deuteranopia'))  return 'Deuteranopia';
  if (t.includes('deuteranomaly')) return 'Deuteranomaly';
  if (t.includes('tritanopia'))    return 'Tritanopia';
  if (t.includes('tritanomaly'))   return 'Tritanomaly';
  return 'Normal';
}

// ============================================
//   INJECT SVG FILTER DEFS (invisible, once)
// ============================================
function injectSVGFilters() {
  if (document.getElementById(SVG_ID)) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = SVG_ID;
  svg.setAttribute('style',
    'position:fixed;width:0;height:0;overflow:hidden;top:-1px;left:-1px;pointer-events:none;');
  svg.setAttribute('aria-hidden', 'true');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

  Object.entries(CVD_MATRICES).forEach(([type, data]) => {
    const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    filter.id = 'cvd-' + type.toLowerCase();
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    filter.setAttribute('x','0%'); filter.setAttribute('y','0%');
    filter.setAttribute('width','100%'); filter.setAttribute('height','100%');

    const fe = document.createElementNS('http://www.w3.org/2000/svg', 'feColorMatrix');
    fe.setAttribute('type', 'matrix');
    fe.setAttribute('values', data.matrix.join(' '));
    filter.appendChild(fe);
    defs.appendChild(filter);
  });

  svg.appendChild(defs);

  // Wait for body if needed
  if (document.body) {
    document.body.insertBefore(svg, document.body.firstChild);
  } else {
    document.documentElement.appendChild(svg);
  }
}

// ============================================
//   APPLY FILTER
// ============================================
function applyFilter(rawType) {
  const type = normaliseCVD(rawType);

  if (type === 'Normal') {
    removeFilter();
    return;
  }

  const data = CVD_MATRICES[type];
  if (!data) { removeFilter(); return; }

  // Remove old style first
  removeFilter();

  // Inject SVG filter definitions
  injectSVGFilters();

  // Apply CSS filter to <html>
  let filterCSS = `url(#cvd-${type.toLowerCase()})`;
  if (data.saturate) filterCSS += ` saturate(${data.saturate})`;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    html {
      filter: ${filterCSS} !important;
      -webkit-filter: ${filterCSS} !important;
    }
    #${SVG_ID}, #cs-toast, #cs-badge {
      filter: none !important;
      -webkit-filter: none !important;
    }
  `;
  document.head.appendChild(style);
  console.log('[ChromaSense] ✅ Filter applied:', type);
}

// ============================================
//   REMOVE FILTER
// ============================================
function removeFilter() {
  const s = document.getElementById(STYLE_ID);
  if (s) s.remove();
}

// ============================================
//   LOAD FROM chrome.storage AND APPLY
//   This runs on EVERY page load automatically
// ============================================
function loadAndApply() {
  chrome.storage.sync.get(
    ['cvdEnabled', 'cvdType', 'manualMode', 'manualCVDType'],
    (data) => {
      if (chrome.runtime.lastError) return;

      const enabled = data.cvdEnabled !== false;
      const type = data.manualMode
        ? (data.manualCVDType || 'Normal')
        : (data.cvdType || 'Normal');

      if (enabled && normaliseCVD(type) !== 'Normal') {
        // Wait for DOM to be ready
        if (document.head) {
          applyFilter(type);
        } else {
          document.addEventListener('DOMContentLoaded', () => applyFilter(type));
        }
      } else {
        removeFilter();
      }
    }
  );
}

// ============================================
//   LISTEN FOR postMessage FROM WEBSITE
//
//   The website calls:
//   window.postMessage({ source:'chromasense_webapp',
//                        type:'SET_PROFILE',
//                        profile:{cvdType:...} }, '*')
//
//   content.js catches it here and:
//   1. Saves to chrome.storage
//   2. Applies filter immediately on this page
//   3. background.js broadcasts to all other tabs
// ============================================
window.addEventListener('message', (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;
  if (!event.data) return;
  if (event.data.source !== 'chromasense_webapp') return;
  if (event.data.type !== 'SET_PROFILE') return;

  const profile = event.data.profile;
  if (!profile || !profile.cvdType) return;

  console.log('[ChromaSense] 📨 Profile from website:', profile.cvdType);

  // Save to chrome.storage — this makes it persist across ALL tabs
  chrome.storage.sync.set({
    cvdType:      profile.cvdType,
    severity:     profile.severity     || 'None',
    overallScore: profile.overallScore || 0,
    cvdEnabled:   true,
    manualMode:   false,
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[ChromaSense] Storage error:', chrome.runtime.lastError);
      return;
    }
    console.log('[ChromaSense] ✅ Saved to chrome.storage:', profile.cvdType);

    // Apply on this page immediately
    applyFilter(profile.cvdType);

    // Tell background.js to broadcast to ALL other open tabs
    chrome.runtime.sendMessage({
      action:  'broadcastFilter',
      cvdType: profile.cvdType,
    });

    // Show success toast
    showToast('✓ ' + normaliseCVD(profile.cvdType) + ' filter active on all sites');
  });
});

// ============================================
//   LISTEN FOR MESSAGES FROM POPUP / BACKGROUND
// ============================================
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.action === 'applyFilter') {
    if (msg.enabled !== false) {
      applyFilter(msg.cvdType);
    } else {
      removeFilter();
    }
    sendResponse({ ok: true });
  }

  if (msg.action === 'toggle') {
    if (msg.enabled) {
      // Re-read from storage and apply
      chrome.storage.sync.get(['cvdType', 'manualMode', 'manualCVDType'], (d) => {
        const t = d.manualMode ? d.manualCVDType : d.cvdType;
        applyFilter(t || 'Normal');
      });
    } else {
      removeFilter();
    }
    sendResponse({ ok: true });
  }

  if (msg.action === 'getStatus') {
    const active = !!document.getElementById(STYLE_ID);
    sendResponse({ active, filtered: active });
  }

  return true;
});

// ============================================
//   SHOW TOAST NOTIFICATION
// ============================================
function showToast(message) {
  const old = document.getElementById('cs-toast');
  if (old) old.remove();

  const toast = document.createElement('div');
  toast.id = 'cs-toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    background: #7C6FFF !important;
    color: white !important;
    font-family: system-ui, sans-serif !important;
    font-size: 13px !important;
    font-weight: 600 !important;
    padding: 10px 18px !important;
    border-radius: 100px !important;
    box-shadow: 0 4px 20px rgba(124,111,255,0.5) !important;
    opacity: 0 !important;
    transition: opacity 0.3s ease, transform 0.3s ease !important;
    transform: translateY(-8px) !important;
    filter: none !important;
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => {
    toast.style.opacity   = '1';
    toast.style.transform = 'translateY(0)';
  }));

  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateY(-8px)';
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ============================================
//   INIT — runs immediately on every page
// ============================================
loadAndApply();