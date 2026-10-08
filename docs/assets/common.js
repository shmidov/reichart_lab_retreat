// Shared helpers for the player, host and screen pages.

// Each Apps Script call already takes ~1s, so these are only the pauses *between* calls.
const POLL_GAP_MS = { player: 700, host: 300, screen: 200 };

async function api(action, payload) {
  const url = (window.APP_CONFIG || {}).API_URL || '';
  if (!url || url.indexOf('PASTE_') === 0) throw new Error('יש להגדיר את API_URL בקובץ config.js');
  // text/plain body keeps this a "simple" request, so Apps Script doesn't need CORS preflight.
  const res = await fetch(url, {
    method: 'POST',
    body: JSON.stringify(Object.assign({ action: action }, payload || {})),
  });
  if (!res.ok) throw new Error('שגיאת שרת (' + res.status + ')');
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'שגיאה לא ידועה');
  return json.data;
}

/**
 * Calls fn repeatedly, pausing gapMs (plus jitter) after each call finishes. onStatus(err|null) after each call.
 * Polls right away when the tab becomes visible again (e.g. a phone waking up).
 */
function startPolling(fn, onStatus, gapMs) {
  let stopped = false;
  let running = false;
  let timer = null;
  async function tick() {
    clearTimeout(timer);
    if (running || stopped) return;
    running = true;
    try {
      await fn();
      if (onStatus) onStatus(null);
    } catch (err) {
      if (onStatus) onStatus(err);
    }
    running = false;
    if (!stopped) timer = setTimeout(tick, gapMs + Math.random() * 300);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
  tick();
  return () => { stopped = true; clearTimeout(timer); };
}

/** Tiny DOM builder: el('div', {class: 'x', onclick: fn}, 'text', childNode). Text is never parsed as HTML. */
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'class') node.className = value;
    else node.setAttribute(key, value === true ? '' : value);
  });
  children.flat().forEach(child => {
    if (child == null || child === false) return;
    node.append(child instanceof Node ? child : String(child));
  });
  return node;
}

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* private mode */ } },
  remove(key) { try { localStorage.removeItem(key); } catch (e) { /* private mode */ } },
};

const PHASE_LABELS = { lobby: 'לובי', open: 'שאלה פתוחה', results: 'תוצאות', end: 'סיום' };

function questionCounter(state) {
  return 'שאלה ' + (state.index + 1) + ' מתוך ' + state.total;
}

/** Vertical bar chart of {counts: [{label, count}], total}. Number scales read left-to-right. */
function renderBars(container, results, type) {
  const max = Math.max(1, ...results.counts.map(c => c.count));
  const bars = [];
  const chart = el('div', { class: 'bars' + (type === 'scale' ? ' ltr' : '') },
    results.counts.map(c => {
      const pct = results.total ? Math.round(c.count / results.total * 100) : 0;
      const bar = el('div', { class: 'bar' });
      bars.push([bar, c.count / max]);
      return el('div', { class: 'bar-col' },
        el('div', { class: 'bar-value' }, c.count, el('span', { class: 'bar-pct' }, pct + '%')),
        el('div', { class: 'bar-track' }, bar),
        el('div', { class: 'bar-label' }, c.label));
    }));
  container.replaceChildren(chart);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    bars.forEach(([bar, frac]) => { bar.style.height = (frac * 100) + '%'; });
  }));
}

function playerUrl() {
  return new URL('./', location.href).href;
}

function renderQr(container, text, size) {
  container.replaceChildren();
  if (typeof QRCode === 'undefined') {
    container.append(el('div', { class: 'muted' }, text));
    return;
  }
  new QRCode(container, { text: text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
}
