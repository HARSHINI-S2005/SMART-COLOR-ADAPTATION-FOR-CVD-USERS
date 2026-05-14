// ============================================
//   ChromaSense — popup.js
//   Controls the extension popup UI.
//   Shows test result profile + manual overrides
//   for all 6 CVD types.
// ============================================

// All 6 CVD types + Auto
const CVD_TYPES = [
  { key:'Auto',          label:'Auto\n(from test)',  grid:'auto', desc:'Use your test result' },
  { key:'Protanopia',    label:'Protanopia\nRed-Blind', desc:'No red cones - shifts red to green/blue' },
  { key:'Protanomaly',   label:'Protanomaly\nRed-Weak', desc:'Weak red cones - boosts red separation' },
  { key:'Deuteranopia',  label:'Deuteranopia\nGreen-Blind', desc:'No green cones - enhances red-green distinction' },
  { key:'Deuteranomaly', label:'Deuteranomaly\nGreen-Weak', desc:'Weak green cones - gentle green correction' },
  { key:'Tritanopia',    label:'Tritanopia\nBlue-Blind', desc:'No blue cones - boosts blue-yellow contrast' },
  { key:'Tritanomaly',   label:'Tritanomaly\nBlue-Weak', desc:'Weak blue cones - soft blue enhancement' },
];

// ============================================
//   INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Load all settings and render
  chrome.storage.sync.get(
    ['cvdEnabled','cvdType','severity','overallScore','manualMode','manualCVDType','theme'],
    (data) => {
      // Apply saved theme
      const theme = data.theme || 'dark';
      document.documentElement.setAttribute('data-theme', theme);
      updateThemeIcon(theme);
      renderPopup(data);
    }
  );

  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Footer: open app
  document.getElementById('link-app').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'http://127.0.0.1:5500/index.html' });
  });

  // Footer: reset
  document.getElementById('link-reset').addEventListener('click', (e) => {
    e.preventDefault();
    if (!confirm('Reset your ChromaSense profile?\nThis will turn off color adaptation.')) return;
    chrome.storage.sync.clear(() => {
      chrome.storage.sync.set({ cvdEnabled: false, theme: 'dark' });
      sendToAllTabs({ action: 'toggle', enabled: false });
      renderPopup({ cvdEnabled: false });
    });
  });
});

// ============================================
//   THEME FUNCTIONS
// ============================================
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  updateThemeIcon(next);
  chrome.storage.sync.set({ theme: next });
}

function updateThemeIcon(theme) {
  const moon = document.getElementById('theme-icon-moon');
  const sun = document.getElementById('theme-icon-sun');
  if (moon && sun) {
    moon.style.display = theme === 'dark' ? 'block' : 'none';
    sun.style.display = theme === 'light' ? 'block' : 'none';
  }
}

// ============================================
//   RENDER POPUP
// ============================================
function renderPopup(data) {
  const container    = document.getElementById('popup-content');
  const isEnabled    = data.cvdEnabled !== false;
  const cvdType      = data.cvdType    || null;   // from test result
  const severity     = data.severity   || 'None';
  const score        = data.overallScore || 0;
  const manualMode   = data.manualMode   || false;
  const manualType   = data.manualCVDType || 'Normal';

  // What's currently active
  const activeType   = manualMode ? manualType : (cvdType || 'Normal');

  // =============================================
  //   NO PROFILE — user hasn't taken test yet
  // =============================================
  if (!cvdType) {
    container.innerHTML = `
      <div class="no-profile">
        <div class="no-profile-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
            <path d="M2 12h20"/>
          </svg>
        </div>
        <h3>No Profile Yet</h3>
        <p>Take the ChromaSense color vision test to automatically set up your personalised filter.</p>
        <button class="btn-take-test" id="take-test">Take Color Vision Test</button>
      </div>

      <div class="sec-label" style="margin-top:14px;">Or Select Manually</div>
      <div class="type-grid" id="type-grid">
        ${buildTypeGrid('Auto', false)}
      </div>
      
      <div class="info-card">
        <div class="info-card-title">
          <span class="cvd-icon" style="background:var(--red);">🔴</span>
          Protanopia / Protanomaly
        </div>
        <div class="info-card-desc">Red cone deficiency - affects red-green perception</div>
      </div>
      <div class="info-card">
        <div class="info-card-title">
          <span class="cvd-icon" style="background:var(--green);">🟢</span>
          Deuteranopia / Deuteranomaly
        </div>
        <div class="info-card-desc">Green cone deficiency - most common type</div>
      </div>
      <div class="info-card">
        <div class="info-card-title">
          <span class="cvd-icon" style="background:var(--blue);">🔵</span>
          Tritanopia / Tritanomaly
        </div>
        <div class="info-card-desc">Blue cone deficiency - affects blue-yellow perception</div>
      </div>
    `;
    document.getElementById('take-test').onclick = () => {
      chrome.tabs.create({ url: 'http://127.0.0.1:5500/index.html' });
    };
    setupTypeButtons('Auto', false, null);
    return;
  }

  // =============================================
  //   PROFILE EXISTS — show full UI
  // =============================================
  const sevClass = { None:'sev-none', Mild:'sev-mild', Moderate:'sev-moderate', Severe:'sev-severe' }[severity] || 'sev-none';
  const activeLabel = manualMode ? `${manualType} (manual)` : cvdType;

  container.innerHTML = `

    <!-- Master toggle -->
    <div class="status-card">
      <div>
        <div class="status-label">Adaptation Filter</div>
        <div class="status-value ${isEnabled?'on':'off'}" id="status-val">
          ${isEnabled ? '● Active' : '○ Off'}
        </div>
      </div>
      <label class="toggle">
        <input type="checkbox" id="master-toggle" ${isEnabled?'checked':''}/>
        <span class="track"></span>
      </label>
    </div>

    <!-- Test result profile -->
    <div class="profile-card">
      <div class="profile-row">
        <span class="pk">Test Result</span>
        <span class="pv">${cvdType}</span>
      </div>
      <div class="profile-row">
        <span class="pk">Severity</span>
        <span class="pv">
          <span class="sev-dot ${sevClass}"></span>${severity}
        </span>
      </div>
      <div class="profile-row">
        <span class="pk">Active Filter</span>
        <span class="pv active-type" id="active-label">${activeLabel}</span>
      </div>
    </div>

    <!-- Score bar -->
    <div class="score-wrap">
      <div class="score-row">
        <span>Test Accuracy</span>
        <span>${score}%</span>
      </div>
      <div class="score-track">
        <div class="score-fill" style="width:${score}%"></div>
      </div>
    </div>

    <!-- Manual override -->
    <div class="sec-label">Manual Override</div>
    <div class="type-grid" id="type-grid">
      ${buildTypeGrid(manualMode ? manualType : 'Auto', manualMode)}
    </div>
  `;

  // Master toggle listener
  document.getElementById('master-toggle').addEventListener('change', (e) => {
    const enabled = e.target.checked;
    const sv = document.getElementById('status-val');
    sv.textContent = enabled ? '● Active' : '○ Off';
    sv.className   = `status-value ${enabled?'on':'off'}`;

    chrome.storage.sync.set({ cvdEnabled: enabled });

    if (enabled) {
      // Re-apply current filter
      sendToAllTabs({ action: 'applyFilter', cvdType: activeType, enabled: true });
    } else {
      sendToAllTabs({ action: 'toggle', enabled: false });
    }
  });

  setupTypeButtons(manualMode ? manualType : 'Auto', manualMode, cvdType);
}

// ============================================
//   BUILD TYPE GRID HTML
// ============================================
function buildTypeGrid(activeKey, isManual) {
  return CVD_TYPES.map(t => {
    const isAuto   = t.key === 'Auto';
    const isActive = isAuto ? !isManual : (isManual && t.key === activeKey);
    const lines    = t.label.split('\n');
    return `
      <button
        class="type-btn ${isAuto?'auto-btn':''} ${isActive?'active':''}"
        data-type="${t.key}"
      >${lines.map((l,i) => i===0 ? `<strong>${l}</strong>` : `<br/><small style="opacity:0.7;font-size:0.6rem">${l}</small>`).join('')}</button>
    `;
  }).join('');
}

// ============================================
//   WIRE UP TYPE BUTTONS
// ============================================
function setupTypeButtons(currentKey, isManual, savedCVD) {
  const grid = document.getElementById('type-grid');
  if (!grid) return;

  grid.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state visually
      grid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const chosen = btn.dataset.type;

      if (chosen === 'Auto') {
        // Use the test result
        chrome.storage.sync.set({ manualMode: false });
        const typeToApply = savedCVD || 'Normal';
        chrome.storage.sync.set({ cvdEnabled: true });
        sendToAllTabs({ action: 'applyFilter', cvdType: typeToApply, enabled: true });
        updateActiveLabel(typeToApply + ' (auto)');
      } else {
        // Manual override
        chrome.storage.sync.set({
          manualMode:    true,
          manualCVDType: chosen,
          cvdEnabled:    true,
        });
        sendToAllTabs({ action: 'applyFilter', cvdType: chosen, enabled: true });
        updateActiveLabel(chosen + ' (manual)');
      }
    });
  });
}

function updateActiveLabel(text) {
  const el = document.getElementById('active-label');
  if (el) el.textContent = text;
}

// ============================================
//   SEND MESSAGE TO ALL TABS
// ============================================
function sendToAllTabs(message) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (!tab.url) return;
      if (tab.url.startsWith('chrome://')) return;
      if (tab.url.startsWith('chrome-extension://')) return;
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    });
  });
}