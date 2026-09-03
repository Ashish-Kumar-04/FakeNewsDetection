/* ==========================================================================
   VERITAS AI — Client Application Script
   ========================================================================== */

let sampleArticles = [];
let sessionHistory = [];

document.addEventListener('DOMContentLoaded', () => {
  initHealthCheck();
  loadSampleData();
  setupTextListeners();
  setupThemeToggle();
});

// 1. Health Check & Model Verification
async function initHealthCheck() {
  const badge = document.getElementById('model-status-badge');
  const statusText = document.getElementById('status-text');

  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const data = await res.json();
      if (data.model_loaded) {
        badge.className = 'status-badge online';
        statusText.textContent = `Active Model: ${data.model_path}`;
      } else {
        badge.className = 'status-badge offline';
        statusText.textContent = 'Model File Failed to Load';
      }
    } else {
      throw new Error('Server returned error status');
    }
  } catch (err) {
    badge.className = 'status-badge offline';
    statusText.textContent = 'Server Offline';
    console.error('Health check failed:', err);
  }
}

// 2. Load Benchmark Samples from API
async function loadSampleData() {
  try {
    const res = await fetch('/api/samples');
    if (res.ok) {
      sampleArticles = await res.json();
    }
  } catch (err) {
    console.warn('Could not fetch sample benchmark articles:', err);
  }
}

function loadSample(sampleId) {
  const sample = sampleArticles.find(s => s.id === sampleId);
  if (sample) {
    document.getElementById('news-title').value = sample.title;
    document.getElementById('news-content').value = sample.content;
    updateCounts();
  }
}

// 3. Text & Counter Event Listeners
function setupTextListeners() {
  const contentInput = document.getElementById('news-content');
  const titleInput = document.getElementById('news-title');

  contentInput.addEventListener('input', updateCounts);
  titleInput.addEventListener('input', updateCounts);
}

function updateCounts() {
  const title = document.getElementById('news-title').value || '';
  const content = document.getElementById('news-content').value || '';
  const fullText = (title + ' ' + content).trim();

  const charLen = fullText.length;
  const words = fullText ? fullText.match(/\b[a-zA-Z0-9]+\b/g) || [] : [];

  document.getElementById('char-count').textContent = `${charLen.toLocaleString()} characters`;
  document.getElementById('word-count').textContent = `${words.length.toLocaleString()} words`;
}

function clearForm() {
  document.getElementById('news-title').value = '';
  document.getElementById('news-content').value = '';
  updateCounts();
  document.getElementById('results-placeholder').style.display = 'flex';
  document.getElementById('results-content').style.display = 'none';
}

// 4. Main Analysis Trigger
async function runAnalysis() {
  const title = document.getElementById('news-title').value.trim();
  const content = document.getElementById('news-content').value.trim();

  if (!title && !content) {
    alert('Please enter an article headline or body text to classify.');
    return;
  }

  // UI Loading State
  const btn = document.getElementById('analyze-btn');
  const spinner = document.getElementById('btn-spinner');
  const btnIcon = document.getElementById('btn-icon');
  const btnText = document.getElementById('btn-text');

  btn.disabled = true;
  spinner.style.display = 'inline-block';
  btnIcon.style.display = 'none';
  btnText.textContent = 'Classifying from my_fake_news_model_research.keras...';

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Prediction request failed');
    }

    const data = await res.json();
    renderResults(data, title, content);
    addToHistory(data, title, content);

  } catch (err) {
    alert(`Classification Failed: ${err.message}`);
    console.error('Prediction Error:', err);
  } finally {
    btn.disabled = false;
    spinner.style.display = 'none';
    btnIcon.style.display = 'inline';
    btnText.textContent = 'Classify Article Authenticity';
  }
}

// 5. Render Clean Prediction Results
function renderResults(data, title, content) {
  document.getElementById('results-placeholder').style.display = 'none';
  const resultsContent = document.getElementById('results-content');
  resultsContent.style.display = 'block';

  // Latency Badge
  const latencyBadge = document.getElementById('latency-badge');
  latencyBadge.style.display = 'inline-block';
  latencyBadge.textContent = `Inference: ${data.latency_ms} ms`;

  // Verdict Banner Styling
  const verdictIcon = document.getElementById('verdict-icon');
  const verdictTitle = document.getElementById('verdict-title');
  const riskTag = document.getElementById('risk-tag');

  verdictTitle.textContent = data.verdict;
  verdictTitle.style.color = data.color_theme;
  riskTag.textContent = data.risk_level;
  riskTag.style.backgroundColor = `${data.color_theme}25`;
  riskTag.style.color = data.color_theme;

  if (data.is_real) {
    verdictIcon.style.backgroundColor = '#10b981';
    verdictIcon.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`;
  } else {
    verdictIcon.style.backgroundColor = '#ef4444';
    verdictIcon.innerHTML = `
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>`;
  }

  // Keywords Signals
  renderKeywordBadges('sensational-keywords-list', data.sensational_matches, 'danger');
  renderKeywordBadges('factual-keywords-list', data.factual_matches, 'success');

  // Text Highlighting
  renderHighlightedText(title, content, data.sensational_matches || [], data.factual_matches || []);
}

function renderKeywordBadges(containerId, keywords, type) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!keywords || keywords.length === 0) {
    container.innerHTML = '<span class="none-text">None Detected</span>';
    return;
  }

  keywords.forEach(kw => {
    const badge = document.createElement('span');
    badge.className = `kw-badge ${type}`;
    badge.textContent = kw;
    container.appendChild(badge);
  });
}

function renderHighlightedText(title, content, sensationalKws, factualKws) {
  const box = document.getElementById('highlighted-text-box');
  let fullText = (title ? `${title}\n\n` : '') + content;

  if (!fullText.trim()) {
    box.textContent = 'No text provided.';
    return;
  }

  let safeText = fullText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  sensationalKws.forEach(kw => {
    const regex = new RegExp(`\\b(${escapeRegExp(kw)})\\b`, 'gi');
    safeText = safeText.replace(regex, '<mark class="highlight-sensational">$1</mark>');
  });

  factualKws.forEach(kw => {
    const regex = new RegExp(`\\b(${escapeRegExp(kw)})\\b`, 'gi');
    safeText = safeText.replace(regex, '<mark class="highlight-factual">$1</mark>');
  });

  box.innerHTML = safeText.replace(/\n/g, '<br>');
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 6. Session History Management
function addToHistory(data, title, content) {
  const words = (title + ' ' + content).trim().split(/\s+/).filter(Boolean);
  const item = {
    id: Date.now(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    headline: title || (content.length > 50 ? content.substring(0, 50) + '...' : content),
    wordCount: words.length,
    verdict: data.verdict,
    riskLevel: data.risk_level,
    colorTheme: data.color_theme,
    fullData: data,
    title,
    content
  };

  sessionHistory.unshift(item);
  updateHistoryTable();
}

function updateHistoryTable() {
  const tbody = document.getElementById('history-table-body');
  tbody.innerHTML = '';

  if (sessionHistory.length === 0) {
    tbody.innerHTML = `
      <tr id="empty-history-row">
        <td colspan="6" class="empty-table-msg">No predictions recorded in this session yet.</td>
      </tr>`;
    return;
  }

  sessionHistory.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${item.timestamp}</code></td>
      <td><strong>${escapeHtml(item.headline)}</strong></td>
      <td>${item.wordCount} words</td>
      <td><span class="table-badge" style="background:${item.colorTheme}20; color:${item.colorTheme}">${item.verdict}</span></td>
      <td>${item.riskLevel}</td>
      <td>
        <button class="text-link-btn" onclick="reInspectHistory(${item.id})">Inspect</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function reInspectHistory(id) {
  const item = sessionHistory.find(i => i.id === id);
  if (item) {
    document.getElementById('news-title').value = item.title;
    document.getElementById('news-content').value = item.content;
    updateCounts();
    renderResults(item.fullData, item.title, item.content);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  }
}

function clearHistory() {
  sessionHistory = [];
  updateHistoryTable();
}

function exportHistoryCSV() {
  if (sessionHistory.length === 0) {
    alert('Session history is currently empty.');
    return;
  }

  let csv = 'Timestamp,Headline,Word Count,Verdict,Risk Level\n';
  sessionHistory.forEach(item => {
    const cleanHeadline = `"${item.headline.replace(/"/g, '""')}"`;
    csv += `${item.timestamp},${cleanHeadline},${item.wordCount},${item.verdict},${item.riskLevel}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `veritas_predictions_log_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// 7. Theme Toggle
function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  btn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    document.body.classList.toggle('dark-theme');
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
