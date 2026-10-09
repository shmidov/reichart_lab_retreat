// Shared helpers for the player, host and screen pages.

/** Calls the Apps Script backend (Google Sheet). Only the projector screen uses this. */
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

/** Like node.replaceChildren, but skips null/false (e.g. a question without an explanation). */
function setChildren(node, ...children) {
  node.replaceChildren(...children.flat().filter(c => c != null && c !== false));
}

/** "שאלה 2 מתוך 5", as children for el(). */
function counterParts(index, total) {
  return 'שאלה ' + (index + 1) + ' מתוך ' + total;
}

function questionCounter(state) {
  return counterParts(state.index, state.total);
}

// ---------- activities ----------

/** An activity from APP_CONFIG.ACTIVITIES by id (null for 'welcome' or unknown ids). */
function activityById(id) {
  return ((window.APP_CONFIG || {}).ACTIVITIES || []).find(a => a.id === id) || null;
}

const WELCOME = (window.APP_CONFIG || {}).WELCOME || { title: 'ברוכים הבאים', subtitle: '' };

// ---------- the game's name ----------

const GAME_TITLE = (window.APP_CONFIG || {}).GAME_TITLE || 'שם למשחק';
document.querySelectorAll('[data-game-title]').forEach(node => { node.textContent = GAME_TITLE; });
document.title = document.title ? GAME_TITLE + ' · ' + document.title : GAME_TITLE;

/** The answer options as quiet chips (projector), so the room sees what's being asked. */
function optionsPreview(question) {
  const ltr = question.type === 'scale';
  return el('div', { class: 'choices' + (ltr ? ' ltr' : '') },
    question.options.map(opt => el('span', { class: 'choice' }, opt)));
}

// ---------- chart ----------

/**
 * Vertical bar chart of {counts: [{label, count}], total}. Number scales read left-to-right.
 * All bars share one color, so no answer looks "right"; counts and percentages are always shown.
 */
function renderBars(container, results, question) {
  const max = Math.max(1, ...results.counts.map(c => c.count));
  const bars = [];
  const chart = el('div', { class: 'bars' + (question.type === 'scale' ? ' ltr' : '') },
    results.counts.map(c => {
      const pct = results.total ? Math.round(c.count / results.total * 100) : 0;
      const bar = el('div', { class: 'bar' });
      bars.push([bar, c.count / max]);
      return el('div', { class: 'bar-col' },
        el('div', { class: 'bar-value' },
          el('span', { class: 'bar-count' }, c.count),
          el('span', { class: 'bar-pct' }, pct + '%')),
        el('div', { class: 'bar-track' }, bar),
        el('div', { class: 'bar-label' }, c.label));
    }));
  container.replaceChildren(chart);
  // Force a layout at height 0, then set the real heights so they animate. (Not requestAnimationFrame:
  // it doesn't run while the tab is in the background, which would leave the bars at 0.)
  void chart.offsetHeight;
  bars.forEach(([bar, frac]) => { bar.style.height = (frac * 100) + '%'; });
}

// ---------- icons ----------

const ICONS = {
  lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="4.5" y="11" width="15" height="10" rx="3"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7"/>',
  chat: '<path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4.5 19.5l1.3-4.1A7.5 7.5 0 1 1 20 11.5z"/>',
};

function icon(name, size) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size || 28);
  svg.setAttribute('height', size || 28);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name]; // static markup above, never user text
  return svg;
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
