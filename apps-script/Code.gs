/**
 * Reichart lab retreat opinion game: backend.
 *
 * Lives in the Apps Script project bound to the game's Google Sheet and is deployed
 * as a web app (Execute as: Me, Who has access: Anyone). See SETUP.md.
 *
 * Storage:
 *   - Sheet "Questions": the questions, edited by hand (id | question | explanation | type | options).
 *   - Sheet "Responses": one row per named answer, written when the host closes a question.
 *   - Sheet "Summary":   per-question answer counts, written when the host closes a question.
 *   - Script properties: game state, registered players, and live (not yet final) answers.
 *     HOST_PASSWORD must be set there by hand.
 *   - Script cache: copy of the game state, so player polling stays fast and off the properties quota.
 */

const QUESTIONS_SHEET = 'Questions';
const RESPONSES_SHEET = 'Responses';
const SUMMARY_SHEET = 'Summary';
const QUESTION_HEADERS = ['id', 'question', 'explanation', 'type', 'options'];
const RESPONSE_HEADERS = ['timestamp', 'question_id', 'question', 'name', 'answer'];
const SUMMARY_HEADERS = ['question_id', 'question', 'answer', 'count', 'percent', 'total_responses'];

const STATE_KEY = 'state';
const ANSWER_PREFIX = 'ans:';
const PLAYER_PREFIX = 'player:';
const CACHE_SECONDS = 21600; // CacheService maximum
const YES_NO = ['כן', 'לא'];
const MAX_SCALE_STEPS = 21;

const PUBLIC_ACTIONS = ['state', 'join', 'answer', 'screen'];
const HOST_ACTIONS = ['host', 'questions', 'open', 'close', 'lobby', 'end', 'clearPlayers'];

// ---------- HTTP entry points ----------

function doGet(e) {
  return respond_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  let req = {};
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    // fall through with an empty request; route_ rejects it
  }
  return respond_(req);
}

function respond_(req) {
  let body;
  try {
    body = { ok: true, data: route_(req) };
  } catch (err) {
    body = { ok: false, error: err && err.message ? err.message : String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

function route_(req) {
  const action = req.action;
  if (PUBLIC_ACTIONS.indexOf(action) === -1 && HOST_ACTIONS.indexOf(action) === -1) {
    throw new Error('פעולה לא מוכרת: ' + action);
  }
  switch (action) {
    case 'state': return playerView_(getState_());
    case 'join': return join_(req);
    case 'answer': return answer_(req);
    case 'screen': return screenView_(getState_());
  }

  checkHost_(req.password);
  switch (action) {
    case 'host': return hostView_(getState_(true));
    case 'questions': return readQuestions_();
    case 'open': return withLock_(() => hostView_(openQuestion_(Number(req.index))));
    case 'close': return withLock_(() => hostView_(closeQuestion_()));
    case 'lobby': return withLock_(() => hostView_(setIdlePhase_('lobby')));
    case 'end': return withLock_(() => hostView_(setIdlePhase_('end')));
    case 'clearPlayers': return withLock_(() => { clearPlayers_(); return hostView_(getState_(true)); });
  }
}

// ---------- Player actions ----------

function join_(req) {
  const id = cleanId_(req.playerId);
  const name = cleanName_(req.name);
  PropertiesService.getScriptProperties().setProperty(PLAYER_PREFIX + id, name);
  return playerView_(getState_());
}

function answer_(req) {
  const id = cleanId_(req.playerId);
  const name = cleanName_(req.name);
  const state = getState_();
  if (state.phase !== 'open' || !state.question || state.round !== Number(req.round)) {
    throw new Error('השאלה כבר נסגרה.');
  }
  const answer = String(req.answer);
  if (state.question.options.indexOf(answer) === -1) {
    throw new Error('תשובה לא חוקית.');
  }
  PropertiesService.getScriptProperties().setProperty(
    ANSWER_PREFIX + id,
    JSON.stringify({ round: state.round, name: name, answer: answer })
  );
  return { saved: answer };
}

// ---------- Host actions ----------

function checkHost_(password) {
  const expected = PropertiesService.getScriptProperties().getProperty('HOST_PASSWORD');
  if (!expected) throw new Error('לא הוגדרה סיסמת מנחה (HOST_PASSWORD ב-Script properties).');
  if (String(password || '') !== expected) throw new Error('סיסמה שגויה.');
}

function openQuestion_(index) {
  const questions = readQuestions_();
  if (!(index >= 0 && index < questions.length)) throw new Error('אין שאלה מספר ' + (index + 1) + '.');
  let state = getState_(true);
  if (state.phase === 'open') state = closeQuestion_();
  clearAnswers_();
  state.phase = 'open';
  state.index = index;
  state.total = questions.length;
  state.question = questions[index];
  state.results = null;
  state.round = (state.round || 0) + 1;
  return saveState_(state);
}

/** Locks in the live answers: writes them to Responses + Summary and switches to the results phase. */
function closeQuestion_() {
  const state = getState_(true);
  if (state.phase !== 'open') throw new Error('אין שאלה פתוחה.');
  const q = state.question;
  const all = PropertiesService.getScriptProperties().getProperties();
  const answers = [];
  Object.keys(all).forEach(key => {
    if (key.indexOf(ANSWER_PREFIX) !== 0) return;
    const a = JSON.parse(all[key]);
    if (a.round === state.round) answers.push(a);
  });
  answers.sort((a, b) => a.name.localeCompare(b.name, 'he'));

  const now = new Date();
  replaceQuestionRows_(RESPONSES_SHEET, RESPONSE_HEADERS, 1, q.id,
    answers.map(a => [now, q.id, q.text, a.name, a.answer]));

  const total = answers.length;
  const counts = q.options.map(label => ({
    label: label,
    count: answers.filter(a => a.answer === label).length,
  }));
  replaceQuestionRows_(SUMMARY_SHEET, SUMMARY_HEADERS, 0, q.id,
    counts.map(c => [q.id, q.text, c.label, c.count, total ? Math.round(c.count / total * 1000) / 10 : 0, total]));

  clearAnswers_(all);
  state.phase = 'results';
  state.results = { counts: counts, total: total };
  return saveState_(state);
}

/** Back to the lobby or to the end screen. An open question is closed (and saved) first. */
function setIdlePhase_(phase) {
  let state = getState_(true);
  if (state.phase === 'open') state = closeQuestion_();
  state.phase = phase;
  state.question = null;
  state.results = null;
  return saveState_(state);
}

function clearPlayers_() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(key => {
    if (key.indexOf(PLAYER_PREFIX) === 0) props.deleteProperty(key);
  });
}

function clearAnswers_(all) {
  const props = PropertiesService.getScriptProperties();
  Object.keys(all || props.getProperties()).forEach(key => {
    if (key.indexOf(ANSWER_PREFIX) === 0) props.deleteProperty(key);
  });
}

// ---------- Views ----------

function playerView_(state) {
  const showQuestion = state.phase === 'open' || state.phase === 'results';
  return {
    phase: state.phase,
    rev: state.rev,
    round: state.round,
    index: state.index,
    total: state.total,
    question: showQuestion ? state.question : null,
  };
}

function screenView_(state) {
  const live = liveStatus_(state);
  const view = playerView_(state);
  view.results = state.phase === 'results' ? state.results : null;
  view.playerCount = live.players.length;
  view.answeredCount = live.answered.length;
  return view;
}

function hostView_(state) {
  const live = liveStatus_(state);
  const view = screenView_(state);
  view.players = live.players;
  view.answered = live.answered;
  return view;
}

function liveStatus_(state) {
  const all = PropertiesService.getScriptProperties().getProperties();
  const players = [];
  const answered = [];
  Object.keys(all).forEach(key => {
    if (key.indexOf(PLAYER_PREFIX) === 0) players.push(all[key]);
    if (key.indexOf(ANSWER_PREFIX) === 0 && state.phase === 'open') {
      const a = JSON.parse(all[key]);
      if (a.round === state.round) answered.push(a.name);
    }
  });
  const byName = (a, b) => a.localeCompare(b, 'he');
  return { players: players.sort(byName), answered: answered.sort(byName) };
}

// ---------- State ----------

function defaultState_() {
  return { phase: 'lobby', index: -1, total: 0, question: null, results: null, round: 0, rev: 0 };
}

/** fresh=true skips the cache (used inside the host lock, where we must see the latest write). */
function getState_(fresh) {
  const cache = CacheService.getScriptCache();
  if (!fresh) {
    const cached = cache.get(STATE_KEY);
    if (cached) return JSON.parse(cached);
  }
  const stored = PropertiesService.getScriptProperties().getProperty(STATE_KEY);
  const state = stored ? JSON.parse(stored) : defaultState_();
  cache.put(STATE_KEY, JSON.stringify(state), CACHE_SECONDS);
  return state;
}

function saveState_(state) {
  state.rev = (state.rev || 0) + 1;
  const json = JSON.stringify(state);
  PropertiesService.getScriptProperties().setProperty(STATE_KEY, json);
  CacheService.getScriptCache().put(STATE_KEY, json, CACHE_SECONDS);
  return state;
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

// ---------- Sheets ----------

function readQuestions_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(QUESTIONS_SHEET);
  if (!sheet) throw new Error('הגיליון "Questions" חסר. הריצו את setup() קודם.');
  const values = sheet.getDataRange().getDisplayValues();
  const header = values[0].map(h => String(h).trim().toLowerCase());
  const col = {};
  QUESTION_HEADERS.forEach(name => { col[name] = header.indexOf(name); });
  if (col.question === -1) throw new Error('בגיליון "Questions" חסרה עמודה בשם question.');
  const cell = (row, name) => (col[name] === -1 ? '' : String(row[col[name]] || '').trim());

  const questions = [];
  values.slice(1).forEach((row, i) => {
    const text = cell(row, 'question');
    if (!text) return;
    const id = cell(row, 'id') || String(i + 1);
    questions.push(parseQuestion_(id, text, cell(row, 'explanation'), cell(row, 'type'), cell(row, 'options')));
  });
  if (!questions.length) throw new Error('אין שאלות בגיליון "Questions".');
  return questions;
}

function parseQuestion_(id, text, explanation, type, options) {
  const kind = (type || 'scale').toLowerCase().replace(/[\s_\-\/]/g, '');
  let opts;
  if (kind === 'yesno') {
    opts = YES_NO.slice();
  } else if (kind === 'scale') {
    const m = (options || '1-10').match(/^\s*(-?\d+)\s*(?:-|–|to|עד)\s*(-?\d+)\s*$/i);
    if (!m) throw new Error('שאלה ' + id + ': בסוג scale יש לכתוב טווח כמו 1-10.');
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    if (hi <= lo || hi - lo + 1 > MAX_SCALE_STEPS) throw new Error('שאלה ' + id + ': טווח לא תקין (' + options + ').');
    opts = [];
    for (let v = lo; v <= hi; v++) opts.push(String(v));
  } else if (kind === 'choice') {
    opts = String(options || '').split('|').map(s => s.trim()).filter(Boolean);
    if (opts.length < 2) throw new Error('שאלה ' + id + ': בסוג choice יש לכתוב לפחות שתי אפשרויות מופרדות ב-|.');
  } else {
    throw new Error('שאלה ' + id + ': סוג לא מוכר "' + type + '" (scale / yesno / choice).');
  }
  return { id: id, text: text, explanation: explanation, type: kind, options: opts };
}

/** Replaces all rows of one question in a results sheet (so re-running a question doesn't duplicate it). */
function replaceQuestionRows_(sheetName, headers, idCol, questionId, newRows) {
  const sheet = getOrCreateSheet_(sheetName, headers);
  const width = headers.length;
  const kept = sheet.getDataRange().getValues().slice(1)
    .filter(r => r.join('') !== '' && String(r[idCol]) !== String(questionId))
    .map(r => { const row = r.slice(0, width); while (row.length < width) row.push(''); return row; });
  const rows = [headers].concat(kept, newRows);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, width).setValues(rows);
}

function getOrCreateSheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function cleanId_(id) {
  const s = String(id || '').trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(s)) throw new Error('מזהה שחקן לא תקין.');
  return s;
}

function cleanName_(name) {
  const s = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!s) throw new Error('יש להזין שם.');
  return s;
}

// ---------- One-time setup (run from the Apps Script editor) ----------

function setup() {
  const ss = SpreadsheetApp.getActive();
  if (!ss.getSheetByName(QUESTIONS_SHEET)) {
    const sheet = ss.insertSheet(QUESTIONS_SHEET);
    // Plain-text options column, so "1-10" isn't turned into a date.
    sheet.getRange('E:E').setNumberFormat('@');
    const rows = [
      QUESTION_HEADERS,
      ['1', 'תוך חמש שנים מודל שפה יכתוב לבד מאמר שיתקבל ל-ACL', '1 = בכלל לא מסכים/ה, 10 = מסכים/ה לגמרי', 'scale', '1-10'],
      ['2', 'האם כדאי שהריטריט בשנה הבאה יימשך יומיים?', '', 'yesno', ''],
      ['3', 'מה הזמן הכי טוב לפגישת מעבדה?', 'בחרו את האפשרות שהכי מתאימה לכם', 'choice', 'בוקר | צהריים | אחר הצהריים'],
    ];
    sheet.getRange(1, 1, rows.length, QUESTION_HEADERS.length).setValues(rows);
    sheet.setFrozenRows(1);
  }
  getOrCreateSheet_(RESPONSES_SHEET, RESPONSE_HEADERS);
  getOrCreateSheet_(SUMMARY_SHEET, SUMMARY_HEADERS);
}

/** Resets the live game (state, players, live answers). Responses and Summary sheets are kept. */
function resetGame() {
  const props = PropertiesService.getScriptProperties();
  Object.keys(props.getProperties()).forEach(key => {
    if (key === STATE_KEY || key.indexOf(PLAYER_PREFIX) === 0 || key.indexOf(ANSWER_PREFIX) === 0) {
      props.deleteProperty(key);
    }
  });
  CacheService.getScriptCache().remove(STATE_KEY);
}
