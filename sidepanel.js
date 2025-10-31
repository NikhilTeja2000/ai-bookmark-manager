import { scanBookmarks, classifyQueue, applyDecisions, getState, undoLast, setSettings, loadSettings } from './scripts/organizer/index.js';
import './scripts/clipboard.js';
import { runDiagnostics } from './scripts/diagnostics.js';
import { ProgressIndicator } from './scripts/ui/progress-indicator.js';
import { processingController } from './scripts/organizer/processing-controller.js';

const qs = (s) => document.querySelector(s);
const statusEl = qs('#status');

// Initialize progress indicator
const progressIndicator = new ProgressIndicator('#ai-progress-container');

// Tabs
document.querySelectorAll('.tab').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tabview').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    qs('#tab-' + btn.dataset.tab).classList.add('active');
  };
});

function setStatus(text) { statusEl.textContent = text; }

function updateCounters() {
  const st = getState();
  qs('#k-auto').textContent = st.counts.auto;
  qs('#k-review').textContent = st.counts.review;
  qs('#k-skip').textContent = st.counts.skip;
  qs('#k-dup').textContent = st.counts.duplicates;
  qs('#k-err').textContent = st.counts.errors;
}

function renderReview() {
  const tbody = document.querySelector('#reviewTable tbody');
  tbody.innerHTML = '';
  for (const rec of getState().review) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${rec.title || ''}</td>
      <td><a href="${rec.url}" target="_blank">${new URL(rec.url).hostname}</a></td>
      <td>${rec.suggestedFolder || ''}</td>
      <td>${(rec.confidence * 100).toFixed(0)}%</td>
      <td>
        <button class="btn btn-approve">Approve</button>
        <button class="btn btn-skip">Skip</button>
      </td>`;
    tr.querySelector('.btn-approve').onclick = () => applyDecisions([{ ...rec, decision: 'apply' }]).then(() => { renderReview(); updateCounters(); });
    tr.querySelector('.btn-skip').onclick = () => applyDecisions([{ ...rec, decision: 'skip' }]).then(() => { renderReview(); updateCounters(); });
    tbody.appendChild(tr);
  }
}

async function boot() {
  const stg = await loadSettings();
  qs('#threshold').value = stg.threshold;
  qs('#thVal').textContent = Number(stg.threshold).toFixed(2);
  qs('#dryRun').checked = stg.dryRun;
  qs('#autoRename').checked = stg.autoRename;
  qs('#folderStrategy').value = stg.folderStrategy;
  qs('#autoNew').checked = stg.autoNew;

  // Set smart scope as default and update description
  await updateScopeDescription();

  updateCounters();
}

async function updateScopeDescription() {
  try {
    // For now, just update the current scope info with working scan method
    const currentScope = qs('#scope').value || 'all';
    await updateScopeInfo(currentScope);

  } catch (error) {
    console.warn('Failed to update scope description:', error);
  }
}

boot();

qs('#threshold').oninput = (e) => { qs('#thVal').textContent = Number(e.target.value).toFixed(2); };
qs('#btn-open-bookmarks').onclick = () => chrome.tabs.create({ url: 'chrome://bookmarks' });

// Update scope description when changed
qs('#scope').onchange = async (e) => {
  await updateScopeInfo(e.target.value);
};

async function updateScopeInfo(scopeValue) {
  const scopeInfo = qs('#scope-info');
  const scopeDescription = qs('#scope-description');

  try {
    // Use the reliable scan method to get count
    const bookmarks = await scanBookmarks(scopeValue);

    let description = '';
    switch (scopeValue) {
      case 'bar':
        description = `Found ${bookmarks.length} bookmarks in "Bookmarks Bar"`;
        break;
      case 'other':
        description = `Found ${bookmarks.length} bookmarks in "Other Bookmarks"`;
        break;
      case 'current':
        description = `Smart scope - will detect current context`;
        break;
      case 'all':
      default:
        description = `Found ${bookmarks.length} bookmarks in "All Bookmarks"`;
        break;
    }

    scopeDescription.textContent = description;
    scopeInfo.style.display = 'block';

  } catch (error) {
    scopeInfo.style.display = 'none';
    console.warn('Failed to update scope info:', error);
  }
}

// UI Elements
const organizeBtn = qs('#btn-organize');
const stopBtn = qs('#btn-stop');
const resumeBtn = qs('#btn-resume');
const progressContainer = qs('#classification-progress');
const progressFill = qs('#classification-progress-fill');
const progressText = qs('#classification-progress-text');
const batchInfo = qs('#batch-info');
const timeRemaining = qs('#time-remaining');

let currentQueue = [];

// Organize button
organizeBtn.onclick = async () => {
  const settings = {
    threshold: Number(qs('#threshold').value),
    dryRun: qs('#dryRun').checked,
    autoRename: qs('#autoRename').checked,
    folderStrategy: qs('#folderStrategy').value,
    scope: qs('#scope').value,
  };
  await setSettings(settings);

  try {
    // Clear any stale data first
    await clearStaleData();

    setStatus('Scanning bookmarks…');
    currentQueue = await scanBookmarks(settings.scope);

    if (currentQueue.length === 0) {
      setStatus('No bookmarks found to organize.');
      return;
    }

    setStatus(`Found ${currentQueue.length} bookmarks to organize.`);
    startProcessing(currentQueue, settings);

  } catch (error) {
    setStatus(`❌ Error: ${error.message}`);
    console.error('Organize failed:', error);
  }
};

// Clear stale data that might reference old bookmark IDs
async function clearStaleData() {
  try {
    // Reset state counters
    const st = getState();
    st.counts = { auto: 0, review: 0, skip: 0, duplicates: 0, errors: 0 };
    st.review = [];
    st.lastSnapshot = null;

    // Clear any stale storage data
    const storage = await chrome.storage.local.get();
    const keysToRemove = [];

    // Remove old metadata for bookmarks that might not exist anymore
    for (const key in storage) {
      if (key.startsWith('meta:')) {
        const bookmarkId = key.replace('meta:', '');
        try {
          await chrome.bookmarks.get(bookmarkId);
          // Bookmark exists, keep the metadata
        } catch {
          // Bookmark doesn't exist, remove the metadata
          keysToRemove.push(key);
        }
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`Cleaned up ${keysToRemove.length} stale metadata entries`);
    }

    updateCounters();
    renderReview();

  } catch (error) {
    console.warn('Failed to clear stale data:', error);
  }
}

// Stop button
stopBtn.onclick = () => {
  processingController.stop();
  setStatus('⏹️ Stopping after current batch...');
};

// Resume button  
resumeBtn.onclick = () => {
  if (currentQueue.length > 0) {
    const settings = {
      threshold: Number(qs('#threshold').value),
      dryRun: qs('#dryRun').checked,
      autoRename: qs('#autoRename').checked,
      folderStrategy: qs('#folderStrategy').value,
      scope: qs('#scope').value,
    };

    processingController.resume(currentQueue, settings, {
      onProgress: handleProgress,
      onItemProgress: handleItemProgress,
      onComplete: handleComplete,
      onError: handleError
    });
  }
};

function startProcessing(queue, settings) {
  // Show progress UI
  progressContainer.style.display = 'block';
  organizeBtn.style.display = 'none';
  stopBtn.style.display = 'inline-block';
  resumeBtn.style.display = 'none';

  // Reset counters
  const st = getState();
  st.counts = { auto: 0, review: 0, skip: 0, duplicates: 0, errors: 0 };
  st.review = [];
  updateCounters();

  // Start batch processing
  processingController.start(queue, settings, {
    onProgress: handleProgress,
    onItemProgress: handleItemProgress,
    onComplete: handleComplete,
    onError: handleError
  });
}

function handleProgress(progressData) {
  const { status, message, batch, totalBatches, progress, estimatedTimeRemaining } = progressData;

  if (status === 'downloading') {
    setStatus(`Downloading AI model… ${Math.round(progress * 100)}%`);
  } else if (status === 'extracting') {
    setStatus('Loading AI model into memory…');
  } else if (status === 'processing') {
    setStatus(message);
    if (batch && totalBatches) {
      batchInfo.textContent = `Batch ${batch}/${totalBatches}`;
    }
    if (estimatedTimeRemaining) {
      const minutes = Math.ceil(estimatedTimeRemaining / 60000);
      timeRemaining.textContent = `~${minutes} min remaining`;
    }
  } else if (status === 'stopping') {
    setStatus(message);
  } else if (status === 'stopped') {
    setStatus(message);
    showResumeUI();
  }
}

function handleItemProgress(itemData) {
  const { current, total, item, status } = itemData;

  // Update progress bar
  const percent = Math.round((current / total) * 100);
  progressFill.style.width = `${percent}%`;
  progressText.textContent = `${current}/${total} (${percent}%)`;

  // Update counters in real-time
  updateCounters();
  renderReview();
}

function handleComplete(finalStatus) {
  const isDryRun = qs('#dryRun').checked;
  const message = isDryRun
    ? `📋 Dry Run Complete! Analyzed ${finalStatus.totalItems} bookmarks in ${finalStatus.totalBatches} batches. (No bookmarks were moved)`
    : `✅ Done! Organized ${finalStatus.totalItems} bookmarks in ${finalStatus.totalBatches} batches.`;

  setStatus(message);
  hideProgressUI();
  updateCounters();
  renderReview();
}

function handleError(error) {
  setStatus(`❌ Error: ${error.message}`);
  hideProgressUI();
  console.error('Processing failed:', error);
}

function showResumeUI() {
  organizeBtn.style.display = 'none';
  stopBtn.style.display = 'none';
  resumeBtn.style.display = 'inline-block';
}

function hideProgressUI() {
  progressContainer.style.display = 'none';
  organizeBtn.style.display = 'inline-block';
  stopBtn.style.display = 'none';
  resumeBtn.style.display = 'none';
}

qs('#btn-undo').onclick = async () => {
  setStatus('Undoing last run…');
  await undoLast();
  updateCounters();
  renderReview();
  setStatus('Undone.');
};

qs('#btn-reset').onclick = async () => {
  // Confirm reset action
  const confirmed = confirm(
    '⚠️ Reset All Bookmarks\n\n' +
    'This will restore ALL bookmarks to their original positions and titles, ' +
    'removing all AI organization.\n\n' +
    'This action cannot be undone. Are you sure?'
  );

  if (!confirmed) return;

  setStatus('🔄 Resetting all bookmarks to original state...');

  try {
    const { resetToOriginal } = await import('./scripts/organizer/apply.js');
    const result = await resetToOriginal();

    if (result.success) {
      // Reset UI state
      const st = getState();
      st.counts = { auto: 0, review: 0, skip: 0, duplicates: 0, errors: 0 };
      st.review = [];
      updateCounters();
      renderReview();

      setStatus('✅ Reset complete! All bookmarks restored to original state.');
    } else {
      setStatus(`❌ Reset failed: ${result.message}`);
    }
  } catch (error) {
    setStatus(`❌ Reset error: ${error.message}`);
    console.error('Reset failed:', error);
  }
};

// Diagnostics
qs('#btn-run-checks')?.addEventListener('click', async () => {
  const out = await runDiagnostics();
  const badges = qs('#apiBadges');
  badges.innerHTML = '';
  for (const row of out.badges) {
    const span = document.createElement('span');
    span.className = 'badge ' + row.class;
    span.textContent = `${row.name}: ${row.status}`;
    badges.appendChild(span);
  }
  qs('#diagLog').textContent = out.log.join('\n');
});

qs('#btn-sample-classify')?.addEventListener('click', async () => {
  const out = await runDiagnostics({ sample: true });
  qs('#diagLog').textContent = out.log.join('\n');
});

// Settings save button
qs('#btn-save-settings')?.addEventListener('click', async () => {
  const settings = {
    threshold: Number(qs('#threshold').value),
    dryRun: qs('#dryRun').checked,
    autoRename: qs('#autoRename').checked,
    folderStrategy: qs('#folderStrategy').value,
    autoNew: qs('#autoNew').checked,
  };
  await setSettings(settings);
  qs('#settingsStatus').textContent = 'Settings saved.';
  setTimeout(() => qs('#settingsStatus').textContent = '', 3000);
});

// Listen for smart save messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'SMART_SAVE_COMPLETE':
      setStatus(`✅ Smart saved: "${message.bookmark.title}" → ${message.classification.suggestedFolder}`);
      updateCounters();
      break;
    case 'SMART_SAVE_FALLBACK':
      setStatus(`📌 Saved bookmark: "${message.bookmark.title}" (AI classification unavailable)`);
      break;
    case 'SMART_SAVE_ERROR':
      setStatus(`❌ Smart save failed: ${message.error}`);
      break;
  }
});
// Dry Run change handler
qs('#dryRun').onchange = (e) => {
  updateOrganizeButton();
};

function updateOrganizeButton() {
  const organizeBtn = qs('#btn-organize');
  const isDryRun = qs('#dryRun').checked;

  if (isDryRun) {
    organizeBtn.textContent = '📋 Preview Organization';
    organizeBtn.title = 'Preview what would happen without actually moving bookmarks';
    organizeBtn.classList.add('preview-mode');
  } else {
    organizeBtn.textContent = '🤖 Organize';
    organizeBtn.title = 'Organize bookmarks into folders';
    organizeBtn.classList.remove('preview-mode');
  }
}

// Initialize button text on load
document.addEventListener('DOMContentLoaded', () => {
  updateOrganizeButton();
});