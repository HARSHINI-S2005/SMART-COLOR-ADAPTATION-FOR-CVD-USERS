/* ============================================
   ChromaSense — results.js
   Standalone results page functionality
   ============================================ */

const EXTENSION_ID = 'YOUR_EXTENSION_ID_HERE';
const API_BASE = 'http://localhost:3001';

// ============ STATE ============
let resultData = null;

// ============ SAFE getElementById ============
function el(id) {
  const e = document.getElementById(id);
  if (!e) console.warn('[ChromaSense] Element not found:', id);
  return e;
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  loadResultFromStorage();
});

// ============ LOAD RESULT ============
function loadResultFromStorage() {
  // Try to get result from sessionStorage (passed from test page)
  const stored = sessionStorage.getItem('chromasense_result');
  
  if (stored) {
    resultData = JSON.parse(stored);
    renderResultsPage();
    saveResultToBackend();
    pushProfileToExtension();
    updateCTASection();
    loadHistory();
  } else {
    // Try to get from localStorage (returning user)
    const localResults = JSON.parse(localStorage.getItem('chromasense_results') || '[]');
    if (localResults.length > 0) {
      const latest = localResults[0];
      resultData = {
        cvdType: latest.cvdType,
        severity: latest.severity,
        overallScore: latest.score,
        moduleScores: { ishihara: 100, colorid: 100, gradient: 100 } // Default if not stored
      };
      renderResultsPage();
      loadHistory();
    } else {
      // No result found, redirect to home
      window.location.href = 'index.html';
    }
  }
}

// ============ RENDER RESULTS PAGE ============
function renderResultsPage() {
  if (!resultData) return;
  
  const { cvdType, severity, overallScore, moduleScores } = resultData;

  // ---- Hero section ----
  const badgeEl = el('result-badge-large');
  if (badgeEl) badgeEl.textContent = cvdType.includes('Normal') ? '✓ Normal Vision' : '⚠ CVD Detected';

  const titleEl = el('results-title');
  if (titleEl) titleEl.textContent = cvdType;

  const subEl = el('results-sub');
  if (subEl) subEl.textContent = severity === 'None'
    ? 'Your color vision appears normal. Great results!'
    : `Severity: ${severity} — Color adaptation is recommended.`;

  // ---- Type & severity ----
  const typeEl = el('rc-type');
  if (typeEl) typeEl.textContent = cvdType;

  const sevEl = el('rc-severity');
  if (sevEl) {
    sevEl.textContent = severity;
    sevEl.className = 'severity-pill';
    if (severity === 'Mild') sevEl.classList.add('mild');
    if (severity === 'Moderate') sevEl.classList.add('moderate');
    if (severity === 'Severe') sevEl.classList.add('severe');
  }

  // ---- Score ring (animate after short delay) ----
  setTimeout(() => {
    const ringEl = el('score-ring-fill');
    const scoreNum = el('score-number');
    if (ringEl) {
      const offset = 314 - (overallScore / 100) * 314;
      ringEl.style.strokeDashoffset = offset;
      ringEl.style.stroke = overallScore >= 80 ? 'var(--green)' : overallScore >= 55 ? 'var(--yellow)' : 'var(--red)';
    }
    if (scoreNum) scoreNum.textContent = overallScore + '%';
  }, 300);

  // ---- Module bars (animate after longer delay) ----
  setTimeout(() => {
    if (moduleScores) {
      setBar('ishihara', moduleScores.ishihara || 0);
      setBar('colorid', moduleScores.colorid || 0);
      setBar('gradient', moduleScores.gradient || 0);
    }
  }, 500);

  // ---- Vision simulation canvas ----
  setTimeout(() => drawSimulations(), 400);
}

function setBar(mod, pct) {
  const barEl = el('bar-' + mod);
  const pctEl = el('pct-' + mod);
  if (barEl) {
    barEl.style.width = pct + '%';
    barEl.style.background = pct >= 80 ? 'var(--green)' : pct >= 55 ? 'var(--yellow)' : 'var(--red)';
  }
  if (pctEl) pctEl.textContent = pct + '%';
}

// ============ VISION SIMULATION ============
function drawSimulations() {
  const colors = ['#E63946', '#2DC653', '#3A86FF', '#FFBE0B', '#8338EC', '#06D6A0'];

  const fillCanvas = (id, colorFn) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const sw = canvas.width / colors.length;
    colors.forEach((c, i) => {
      ctx.fillStyle = colorFn(c);
      ctx.fillRect(i * sw, 0, sw, canvas.height);
    });
  };

  fillCanvas('sim-normal', c => c);
  fillCanvas('sim-user', c => simulateCVD(c, resultData?.cvdType));
}

function hexToRGB(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function simulateCVD(hex, type) {
  let [r, g, b] = hexToRGB(hex);
  if (!type || type.includes('Normal')) return hex;
  if (type.includes('Protanop')) r = Math.round(0.567 * g + 0.433 * b);
  else if (type.includes('Protanom')) r = Math.round(0.817 * r + 0.183 * g);
  else if (type.includes('Deuteranop')) g = Math.round(0.625 * r + 0.375 * b);
  else if (type.includes('Deuteranom')) g = Math.round(0.8 * g + 0.2 * r);
  else if (type.includes('Tritanop')) { b = Math.round(0.95 * r + 0.05 * g); }
  else if (type.includes('Tritanom')) b = Math.round(0.867 * b + 0.133 * g);
  return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
}

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

// ============ EXTENSION BRIDGE ============
function pushProfileToExtension() {
  if (!resultData) return;
  
  const profile = {
    cvdType: resultData.cvdType,
    severity: resultData.severity,
    overallScore: resultData.overallScore,
    cvdEnabled: true,
  };

  console.log('[ChromaSense] Pushing profile to extension:', profile.cvdType);

  // Method 1: postMessage (immediate)
  window.postMessage({
    source: 'chromasense_webapp',
    type: 'SET_PROFILE',
    profile,
  }, '*');

  // Method 1b: postMessage (delayed 500ms)
  setTimeout(() => {
    window.postMessage({
      source: 'chromasense_webapp',
      type: 'SET_PROFILE',
      profile,
    }, '*');
  }, 500);

  // Method 2: localStorage bridge
  localStorage.setItem('chromasense_profile', JSON.stringify({
    ...profile,
    savedAt: Date.now(),
  }));

  // Method 3: Direct chrome.runtime.sendMessage
  if (EXTENSION_ID && EXTENSION_ID !== 'YOUR_EXTENSION_ID_HERE') {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(EXTENSION_ID,
          { action: 'setProfile', ...profile },
          (response) => {
            if (chrome.runtime.lastError) {
              console.warn('[ChromaSense] Direct msg:', chrome.runtime.lastError.message);
            } else {
              console.log('[ChromaSense] Extension confirmed:', response);
            }
          }
        );
      }
    } catch (e) { /* extension not installed yet */ }
  }
}

// ============ UPDATE CTA SECTION ============
function updateCTASection() {
  if (!resultData) return;
  
  const cvdType = resultData.cvdType;
  const isNormal = cvdType.includes('Normal');

  const ctaType = document.getElementById('cta-cvd-type');
  if (ctaType) ctaType.textContent = cvdType;

  const ctaStatus = document.getElementById('cta-status');
  if (ctaStatus) {
    if (isNormal) {
      ctaStatus.textContent = '✅ Normal vision detected — no filter needed.';
      ctaStatus.style.color = 'var(--green)';
    } else {
      ctaStatus.innerHTML = `✅ <strong>${cvdType}</strong> filter sent to extension. All websites will adapt automatically.`;
      ctaStatus.style.color = 'var(--green)';
    }
  }

  const ctaBox = document.getElementById('extension-cta-box');
  if (ctaBox && !isNormal) {
    ctaBox.style.borderColor = 'rgba(124,111,255,0.5)';
    ctaBox.style.background = 'linear-gradient(135deg,rgba(124,111,255,0.18),rgba(255,107,157,0.12))';
  }
}

function activateExtension() {
  const typeEl = el('modal-cvd-type');
  if (typeEl) typeEl.textContent = resultData?.cvdType || 'Normal';
  const modal = el('ext-modal');
  if (modal) modal.style.display = 'flex';
  pushProfileToExtension();
}

function closeModal(event) {
  if (event.target.id === 'ext-modal') {
    el('ext-modal').style.display = 'none';
  }
}

// ============ BACKEND ============
async function saveResultToBackend() {
  if (!resultData) return;
  
  const userId = localStorage.getItem('chromasense_userId') || ('user_' + Date.now());
  localStorage.setItem('chromasense_userId', userId);
  
  try {
    const res = await fetch(`${API_BASE}/saveResult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        userName: resultData.userName || 'User',
        cvdType: resultData.cvdType,
        severity: resultData.severity,
        overallScore: resultData.overallScore,
        moduleScores: resultData.moduleScores,
        totalQuestions: resultData.totalQuestions || 0,
        timestamp: new Date().toISOString(),
      }),
    });
    const data = await res.json();
    console.log('[ChromaSense] Saved to backend:', data.message);
    showToast('✓ Result saved to database');
  } catch (e) {
    console.warn('[ChromaSense] Backend offline, saved locally.');
    showToast('Saved locally (backend offline)');
  }
}

function showToast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:20px;left:20px;z-index:9999;
    background:var(--surface2);border:1px solid rgba(124,111,255,0.3);
    color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.78rem;
    padding:9px 16px;border-radius:8px;
    animation:fadeIn 0.3s ease;transition:opacity 0.4s ease;`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; }, 2500);
  setTimeout(() => t.remove(), 3000);
}

// ============ LOCAL STORAGE ============
function loadHistory() {
  const results = JSON.parse(localStorage.getItem('chromasense_results') || '[]');
  if (results.length <= 1) return;
  const section = el('history-section');
  const list = el('history-list');
  if (!section || !list) return;
  section.style.display = 'block';
  list.innerHTML = results.map((r, i) => `
    <div class="history-item">
      <span>${i === 0 ? '(Latest)' : r.date}</span>
      <strong>${r.cvdType}</strong>
      <span>${r.severity}</span>
      <span>${r.score}%</span>
    </div>`).join('');
}

// ============ NAVIGATION ============
function retakeTest() {
  // Clear session storage and go back to test
  sessionStorage.removeItem('chromasense_result');
  window.location.href = 'index.html';
}
