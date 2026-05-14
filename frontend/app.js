/* ============================================
   ChromaSense — app.js  (FIXED FINAL VERSION)
   Bug fixed: results page now shows correctly.
   Root cause: DOM elements queried before page
   was visible caused silent null errors.
   ============================================ */

const EXTENSION_ID = 'YOUR_EXTENSION_ID_HERE';
const API_BASE = 'http://localhost:3001';

// ============ STATE ============
const AppState = {
  userId:       null,
  userName:     '',
  currentPage:  'page-landing',
  currentQuestionIndex: 0,
  questions:    [],
  answers:      [],
  cvdType:      'Normal Color Vision',
  severity:     'None',
  overallScore: 0,
  moduleScores: { ishihara:0, colorid:0, gradient:0 },
  isAuthenticated: false,
  authToken:    null,
};

// ============ AUTH CHECK ============
function checkAuth() {
  const token = localStorage.getItem('chromasense_token');
  const user = localStorage.getItem('chromasense_user');
  
  if (token && user) {
    AppState.isAuthenticated = true;
    AppState.authToken = token;
    const userData = JSON.parse(user);
    AppState.userName = userData.firstName || 'User';
    return true;
  }
  return false;
}

// ============ SAFE getElementById ============
// Prevents null crashes — logs warning instead of crashing
function el(id) {
  const e = document.getElementById(id);
  if (!e) console.warn('[ChromaSense] Element not found:', id);
  return e;
}

// ============ PAGE ROUTING ============
function goTo(pageId) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  const page = document.getElementById(pageId);
  if (page) {
    page.style.display = 'block';
    // Force reflow so animation triggers
    page.offsetHeight;
    page.classList.add('active');
    AppState.currentPage = pageId;
  }
}

// ============ NAVIGATION ============
function startTest() { goTo('page-onboarding'); }

function beginTest() {
  AppState.userName = (el('userName')?.value || '').trim() || 'User';
  AppState.userId   = localStorage.getItem('chromasense_userId') || ('user_' + Date.now());
  localStorage.setItem('chromasense_userId', AppState.userId);
  AppState.answers  = [];
  AppState.currentQuestionIndex = 0;
  generateQuestionPool();
  goTo('page-test');
  renderQuestion();
}

function retakeTest() {
  AppState.answers = [];
  AppState.currentQuestionIndex = 0;
  generateQuestionPool();
  goTo('page-test');
  renderQuestion();
}

// ============ QUESTION DATA ============
const ishiharaData = [
  { number:'12', bgColor:[200,120,50],  dotColor:[220,180,100], answer:'12', options:['8','12','3','6'] },
  { number:'8',  bgColor:[150,200,80],  dotColor:[120,180,60],  answer:'8',  options:['3','8','6','0'] },
  { number:'29', bgColor:[200,120,50],  dotColor:[80,200,240],  answer:'29', options:['70','29','21','45'] },
  { number:'5',  bgColor:[180,180,60],  dotColor:[200,80,80],   answer:'5',  options:['2','5','3','7'] },
  { number:'74', bgColor:[220,160,50],  dotColor:[80,160,60],   answer:'74', options:['74','21','17','45'] },
  { number:'6',  bgColor:[160,160,80],  dotColor:[200,80,40],   answer:'6',  options:['6','5','9','8'] },
];

const colorIdData = [
  { color:'#E63946', name:'Red',    options:[{label:'Red',color:'#E63946'},{label:'Green',color:'#2DC653'},{label:'Brown',color:'#8B4513'},{label:'Orange',color:'#FF8C00'}] },
  { color:'#2DC653', name:'Green',  options:[{label:'Green',color:'#2DC653'},{label:'Red',color:'#E63946'},{label:'Yellow',color:'#FFD700'},{label:'Teal',color:'#008080'}] },
  { color:'#3A86FF', name:'Blue',   options:[{label:'Blue',color:'#3A86FF'},{label:'Purple',color:'#8338EC'},{label:'Cyan',color:'#06D6A0'},{label:'Grey',color:'#6C757D'}] },
  { color:'#FFBE0B', name:'Yellow', options:[{label:'Yellow',color:'#FFBE0B'},{label:'Green',color:'#70E000'},{label:'Orange',color:'#FB5607'},{label:'White',color:'#CCCCCC'}] },
  { color:'#FF006E', name:'Pink',   options:[{label:'Pink',color:'#FF006E'},{label:'Red',color:'#D62828'},{label:'Orange',color:'#FB5607'},{label:'Purple',color:'#8338EC'}] },
  { color:'#8338EC', name:'Purple', options:[{label:'Purple',color:'#8338EC'},{label:'Blue',color:'#3A86FF'},{label:'Red',color:'#E63946'},{label:'Pink',color:'#FF006E'}] },
];

const gradientData = [
  { question:'Which strip does NOT belong?',           strips:['#FF4D4D','#FF6B6B','#FF8E8E','#2DC653','#FFB3B3'], answerIndex:3 },
  { question:'Select the strip outside the blue family:', strips:['#3A86FF','#60A5FA','#93C5FD','#F59E0B','#BFDBFE'], answerIndex:3 },
  { question:'Which strip breaks the red-orange pattern?', strips:['#FF0000','#FF4500','#FF7F00','#00CC66','#FFA500'], answerIndex:3 },
  { question:'Find the strip that does NOT belong:',   strips:['#065F46','#10B981','#34D399','#FF4081','#6EE7B7'], answerIndex:3 },
];

// ============ GENERATE QUESTION POOL ============
function generateQuestionPool() {
  const pool = [];
  ishiharaData.forEach((d,i) => pool.push({ moduleType:'ishihara', data:d, id:'ish_'+i }));
  colorIdData.forEach((d,i)  => pool.push({ moduleType:'colorid',  data:d, id:'cid_'+i }));
  gradientData.forEach((d,i) => pool.push({ moduleType:'gradient', data:d, id:'grd_'+i }));
  // Fisher-Yates shuffle
  for (let i = pool.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [pool[i],pool[j]] = [pool[j],pool[i]];
  }
  AppState.questions = pool;
}

// ============ RENDER QUESTION ============
function renderQuestion() {
  const total = AppState.questions.length;
  const idx   = AppState.currentQuestionIndex;

  // ---- All questions answered → redirect to results page ----
  if (idx >= total) {
    computeResults();           // calculate scores first
    saveResultAndRedirect();    // save to sessionStorage and redirect
    return;
  }

  const q = AppState.questions[idx];

  // Update progress bar
  const progressEl = el('progress-label');
  const barEl      = el('progress-bar');
  if (progressEl) progressEl.textContent = `Question ${idx+1} of ${total}`;
  if (barEl)      barEl.style.width = ((idx/total)*100)+'%';

  // Update badge
  const badgeEl = el('question-type-badge');
  const labels  = { ishihara:'Ishihara Plate', colorid:'Color Identification', gradient:'Pattern Test' };
  if (badgeEl) badgeEl.textContent = labels[q.moduleType] || '';

  // Animate container
  const container = document.querySelector('.test-container');
  if (container) {
    container.style.opacity   = '0';
    container.style.transform = 'translateY(16px)';
    setTimeout(() => {
      container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
      container.style.opacity    = '1';
      container.style.transform  = 'translateY(0)';
    }, 40);
  }

  // Render the right question type
  if (q.moduleType === 'ishihara') renderIshihara(q.data);
  if (q.moduleType === 'colorid')  renderColorId(q.data);
  if (q.moduleType === 'gradient') renderGradient(q.data);
}

// ============ ISHIHARA ============
function renderIshihara(data) {
  const qEl = el('question-text');
  if (qEl) qEl.textContent = 'What number do you see in the plate?';

  const area = el('test-stimulus-area');
  if (area) area.innerHTML = '<div class="ishihara-plate-wrap"><canvas id="ish-canvas" width="260" height="260"></canvas></div>';
  drawIshiharaPlate('ish-canvas', data);

  const opts = el('answer-options');
  if (!opts) return;
  opts.innerHTML = '';
  [...data.options].sort(()=>Math.random()-0.5).forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = opt;
    btn.onclick = () => handleAnswer(btn, opt, data.answer, 'ishihara', opts);
    opts.appendChild(btn);
  });
  const nb = document.createElement('button');
  nb.className = 'answer-btn';
  nb.textContent = 'I see nothing';
  nb.onclick = () => handleAnswer(nb, 'nothing', data.answer, 'ishihara', opts);
  opts.appendChild(nb);
}

function drawIshiharaPlate(canvasId, data) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height, cx = W/2, cy = H/2, R = W/2;
  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx,cy,R-2,0,Math.PI*2); ctx.clip();
  const seed = data.number.charCodeAt(0) + data.number.charCodeAt(data.number.length-1);
  const rand = seedRand(seed);
  for (let i=0; i<450; i++) {
    const x=rand()*W, y=rand()*H, r=4+rand()*8;
    if (Math.hypot(x-cx,y-cy) > R-5) continue;
    const [br,bg,bb] = data.bgColor, s=35;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fillStyle = `rgb(${clamp(br+rand()*s-s/2)},${clamp(bg+rand()*s-s/2)},${clamp(bb+rand()*s-s/2)})`;
    ctx.fill();
  }
  drawNumberDots(ctx, data.number, cx, cy, data.dotColor, seedRand(99));
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx,cy,R-2,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,0.08)'; ctx.lineWidth=3; ctx.stroke();
}

function drawNumberDots(ctx, num, cx, cy, dotColor, rand) {
  const patterns = {
    '0':[[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[2,2],[0,3],[2,3],[0,4],[1,4],[2,4]],
    '1':[[1,0],[1,1],[1,2],[1,3],[1,4]],
    '2':[[0,0],[1,0],[2,0],[2,1],[1,2],[0,3],[0,4],[1,4],[2,4]],
    '3':[[0,0],[1,0],[2,0],[2,1],[1,2],[2,2],[2,3],[0,4],[1,4],[2,4]],
    '4':[[0,0],[0,1],[0,2],[1,2],[2,0],[2,1],[2,2],[2,3],[2,4]],
    '5':[[0,0],[1,0],[2,0],[0,1],[0,2],[1,2],[2,2],[2,3],[0,4],[1,4],[2,4]],
    '6':[[1,0],[0,1],[0,2],[0,3],[1,2],[2,2],[2,3],[1,4],[2,4]],
    '7':[[0,0],[1,0],[2,0],[2,1],[1,2],[1,3],[1,4]],
    '8':[[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2],[0,3],[2,3],[0,4],[1,4],[2,4]],
    '9':[[0,0],[1,0],[2,0],[0,1],[2,1],[0,2],[1,2],[2,2],[2,3],[1,4],[2,4]],
  };
  const digits = num.split('');
  const totalW = digits.length*40 + (digits.length-1)*8;
  let startX = cx - totalW/2, startY = cy-35, scale=9;
  digits.forEach(d => {
    (patterns[d]||[]).forEach(([px,py]) => {
      const x=startX+px*scale+rand()*6-3, y=startY+py*scale+rand()*6-3, r=5+rand()*5;
      const [dr,dg,db]=dotColor, s=25;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle=`rgb(${clamp(dr+rand()*s-s/2)},${clamp(dg+rand()*s-s/2)},${clamp(db+rand()*s-s/2)})`;
      ctx.fill();
    });
    startX += 40;
  });
}

function seedRand(seed) {
  let s = seed;
  return () => { s=(s*9301+49297)%233280; return s/233280; };
}
function clamp(v) { return Math.max(0,Math.min(255,Math.round(v))); }

// ============ COLOR ID ============
function renderColorId(data) {
  const qEl = el('question-text');
  if (qEl) qEl.textContent = 'Which color is this?';

  const area = el('test-stimulus-area');
  if (area) area.innerHTML =
    `<div style="width:280px;height:160px;border-radius:16px;background:${data.color};box-shadow:0 8px 40px rgba(0,0,0,0.4);"></div>`;

  const opts = el('answer-options');
  if (!opts) return;
  opts.innerHTML = '';
  [...data.options].sort(()=>Math.random()-0.5).forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'color-answer-btn';
    btn.innerHTML = `<div class="color-swatch-sm" style="background:${opt.color}"></div><span>${opt.label}</span>`;
    btn.onclick = () => handleAnswer(btn, opt.label, data.name, 'colorid', opts);
    opts.appendChild(btn);
  });
}

// ============ GRADIENT ============
function renderGradient(data) {
  const qEl = el('question-text');
  if (qEl) qEl.textContent = data.question;

  const area = el('test-stimulus-area');
  if (area) {
    const stripsHtml = data.strips.map((c,i) =>
      `<div style="flex:1;background:${c};height:80px;cursor:pointer;" class="gradient-strip" data-index="${i}"
        onclick="handleGradientAnswer(this,${i},${data.answerIndex})"></div>`
    ).join('');
    area.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;">
        <div style="display:flex;border-radius:12px;overflow:hidden;width:100%;max-width:560px;">${stripsHtml}</div>
        <p style="color:var(--text-muted);font-size:0.8rem;margin:0;">Click the strip that does NOT belong</p>
      </div>`;
  }
  const opts = el('answer-options');
  if (opts) opts.innerHTML = '';
}

function handleGradientAnswer(clickedEl, selectedIndex, correctIndex) {
  document.querySelectorAll('.gradient-strip').forEach(s => s.style.pointerEvents='none');
  const isCorrect = selectedIndex === correctIndex;
  clickedEl.style.outline = isCorrect ? '3px solid #3DDB8A' : '3px solid #FF6B6B';
  if (!isCorrect) {
    const strips = document.querySelectorAll('.gradient-strip');
    if (strips[correctIndex]) strips[correctIndex].style.outline = '3px solid #3DDB8A';
  }
  AppState.answers.push({ isCorrect, questionType:'gradient' });
  showFeedback(isCorrect, () => { AppState.currentQuestionIndex++; renderQuestion(); });
}

// ============ ANSWER HANDLER ============
function handleAnswer(btn, selected, correct, moduleType, optsContainer) {
  optsContainer.querySelectorAll('button').forEach(b => b.disabled = true);
  const isCorrect = selected.toLowerCase() === correct.toLowerCase();
  btn.classList.add(isCorrect ? 'correct' : 'wrong');
  if (!isCorrect) {
    optsContainer.querySelectorAll('button').forEach(b => {
      const labelText = (b.querySelector('span')?.textContent || b.textContent).trim().toLowerCase();
      if (labelText === correct.toLowerCase()) b.classList.add('correct');
    });
  }
  AppState.answers.push({ isCorrect, questionType: moduleType });
  showFeedback(isCorrect, () => { AppState.currentQuestionIndex++; renderQuestion(); });
}

function skipQuestion() {
  const q = AppState.questions[AppState.currentQuestionIndex];
  if (q) AppState.answers.push({ isCorrect:false, questionType:q.moduleType, skipped:true });
  AppState.currentQuestionIndex++;
  renderQuestion();
}

// ============ FEEDBACK POPUP ============
function showFeedback(isCorrect, callback) {
  const overlay = document.createElement('div');
  overlay.className = 'feedback-overlay';
  overlay.innerHTML = `
    <div class="feedback-box">
      <div class="feedback-icon">${isCorrect ? '✅' : '❌'}</div>
      <div class="feedback-msg">${isCorrect ? 'Correct!' : 'Not quite'}</div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => { overlay.remove(); callback(); }, 900);
}

// ============ COMPUTE RESULTS ============
function computeResults() {
  const answers = AppState.answers;
  if (!answers.length) {
    AppState.cvdType     = 'Normal Color Vision';
    AppState.severity    = 'None';
    AppState.overallScore= 100;
    AppState.moduleScores= { ishihara:100, colorid:100, gradient:100 };
    return;
  }

  // Per-module scoring
  const mod = { ishihara:{c:0,t:0}, colorid:{c:0,t:0}, gradient:{c:0,t:0} };
  answers.forEach(a => {
    const m = mod[a.questionType];
    if (m) { m.t++; if (a.isCorrect) m.c++; }
  });
  const pct = m => m.t > 0 ? Math.round((m.c/m.t)*100) : 100;
  AppState.moduleScores = {
    ishihara: pct(mod.ishihara),
    colorid:  pct(mod.colorid),
    gradient: pct(mod.gradient),
  };

  // Overall score
  const correct = answers.filter(a => a.isCorrect).length;
  AppState.overallScore = Math.round((correct / answers.length) * 100);

  // CVD classification
  const score = AppState.overallScore;
  const { ishihara: iP, colorid: cP, gradient: gP } = AppState.moduleScores;

  if (score >= 85) {
    AppState.cvdType  = 'Normal Color Vision';
    AppState.severity = 'None';
  } else {
    // Determine type by weakest module
    if (gP < iP && gP < cP) {
      AppState.cvdType = score < 50 ? 'Tritanopia' : 'Tritanomaly';
    } else if (iP <= cP) {
      AppState.cvdType = score < 50 ? 'Deuteranopia' : 'Deuteranomaly';
    } else {
      AppState.cvdType = score < 50 ? 'Protanopia' : 'Protanomaly';
    }
    AppState.severity = score >= 70 ? 'Mild' : score >= 50 ? 'Moderate' : 'Severe';
  }

  console.log('[ChromaSense] Result computed:', AppState.cvdType, AppState.severity, AppState.overallScore+'%');
}

// ============ SAVE RESULT AND REDIRECT ============
async function saveResultAndRedirect() {
  // Store result data in sessionStorage for results page
  const resultData = {
    userName: AppState.userName,
    cvdType: AppState.cvdType,
    severity: AppState.severity,
    overallScore: AppState.overallScore,
    moduleScores: AppState.moduleScores,
    totalQuestions: AppState.answers.length,
    answers: AppState.answers,
  };
  
  sessionStorage.setItem('chromasense_result', JSON.stringify(resultData));
  
  // Save locally for history
  saveResultLocally();
  
  // If authenticated, also save to backend
  if (AppState.isAuthenticated && AppState.authToken) {
    try {
      await fetch(`${API_BASE}/api/results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AppState.authToken}`
        },
        body: JSON.stringify({
          cvdType: AppState.cvdType,
          severity: AppState.severity,
          overallScore: AppState.overallScore,
          moduleScores: AppState.moduleScores,
          totalQuestions: AppState.answers.length,
          answers: AppState.answers,
        })
      });
    } catch (err) {
      console.warn('Failed to save to backend:', err);
    }
  }
  
  // Redirect to results page
  window.location.href = 'results.html';
}

// ============ BACKEND ============

// ============ LOCAL STORAGE ============
function saveResultLocally() {
  const results = JSON.parse(localStorage.getItem('chromasense_results') || '[]');
  results.unshift({
    date:     new Date().toLocaleDateString(),
    cvdType:  AppState.cvdType,
    severity: AppState.severity,
    score:    AppState.overallScore,
  });
  if (results.length > 5) results.splice(5);
  localStorage.setItem('chromasense_results', JSON.stringify(results));
}

// ============ LANDING PAGE DEMO ============
function drawDemoPlates() {
  const drawPlate = (id, bgBase, dotBase) => {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx=canvas.getContext('2d'), size=200, cx=100, cy=100, R=100;
    ctx.save(); ctx.beginPath(); ctx.arc(cx,cy,R-2,0,Math.PI*2); ctx.clip();
    const rand = seedRand(42);
    for (let i=0;i<300;i++) {
      const x=rand()*size, y=rand()*size, r=3+rand()*7;
      if (Math.hypot(x-cx,y-cy) > R-4) continue;
      const [br,bg,bb]=bgBase, s=30;
      ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
      ctx.fillStyle=`rgb(${clamp(br+rand()*s-s/2)},${clamp(bg+rand()*s-s/2)},${clamp(bb+rand()*s-s/2)})`;
      ctx.fill();
    }
    drawNumberDots(ctx,'12',cx,cy,dotBase,seedRand(99));
    ctx.restore();
  };
  drawPlate('ishihara-demo-normal',[200,120,50],[220,180,100]);
  drawPlate('ishihara-demo-cvd',  [160,140,80],[175,165,85]);
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  checkAuth();
  
  // Make all pages hidden except landing
  document.querySelectorAll('.page').forEach(p => {
    p.style.display = 'none';
  });
  const landing = document.getElementById('page-landing');
  if (landing) { landing.style.display = 'block'; landing.classList.add('active'); }

  // Radio button interactivity
  document.querySelectorAll('.radio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const name = btn.querySelector('input')?.name;
      if (!name) return;
      document.querySelectorAll(`input[name="${name}"]`).forEach(i =>
        i.parentElement.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Draw demo Ishihara on landing page
  drawDemoPlates();

  // Restore userId if returning user
  const savedId = localStorage.getItem('chromasense_userId');
  if (savedId) AppState.userId = savedId;
  
  // Add dashboard link if authenticated
  if (AppState.isAuthenticated) {
    addDashboardLink();
  }
});

// Add dashboard link to navbar
function addDashboardLink() {
  const navBadge = document.querySelector('#page-landing .nav-badge');
  if (navBadge && !document.querySelector('.dashboard-link')) {
    const dashboardLink = document.createElement('a');
    dashboardLink.href = 'dashboard.html';
    dashboardLink.className = 'btn-ghost dashboard-link';
    dashboardLink.style.marginLeft = '12px';
    dashboardLink.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
        <rect x="3" y="3" width="7" height="7"/>
        <rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/>
        <rect x="3" y="14" width="7" height="7"/>
      </svg>
      Dashboard
    `;
    navBadge.parentNode.appendChild(dashboardLink);
  }
}