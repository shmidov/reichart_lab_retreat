/**
 * Reichart lab retreat: Google Sheet backend.
 *
 * The live site runs in the browser (the projector screen). This script is called for:
 *   - action "questions": read the Questions tab (projector: on start, or on "reload" from the host)
 *   - action "save":      store one closed game question (projector, in the background after its chart)
 *   - action "submit":    store a participant's link for a writing activity (phones), in that activity's tab
 *
 * Lives in the Apps Script project of the game's Google Sheet (Extensions → Apps Script) and is deployed
 * as a web app (Execute as: Me, Who has access: Anyone). See SETUP.md.
 *
 * Tabs:
 *   Questions  edited by hand: id | question | explanation | type | options
 *   Responses  one row per person per question
 *   Summary    one row per question
 *   <activity> one tab per link activity (e.g. "Future works"): one row per person (name, link)
 */

const QUESTIONS_SHEET = 'Questions';
const RESPONSES_SHEET = 'Responses';
const SUMMARY_SHEET = 'Summary';
const QUESTION_HEADERS = ['id', 'question', 'explanation', 'type', 'options'];
const RESPONSE_HEADERS = ['timestamp', 'question_id', 'question', 'name', 'answer'];
const SUMMARY_HEADERS = ['question_id', 'question', 'type', 'total_responses', 'average', 'results', 'saved_at'];

const YES_NO = ['Yes', 'No'];
const SUBMISSION_HEADERS = ['timestamp', 'name', 'link', 'player_id'];
const RESERVED_SHEETS = [QUESTIONS_SHEET, RESPONSES_SHEET, SUMMARY_SHEET];
const MAX_SCALE_STEPS = 21;

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
  switch (req.action) {
    case 'ping': return 'pong';
    case 'questions': return readQuestions_();
    case 'save': return withLock_(() => saveQuestion_(req));
    case 'submit': return withLock_(() => saveSubmission_(req));
  }
  throw new Error('Unknown action: ' + req.action);
}

// ---------- Saving ----------

/** Stores one closed question. Re-saving the same question id replaces its earlier rows. */
function saveQuestion_(req) {
  const q = req.question || {};
  const id = String(q.id || '').trim();
  if (!id) throw new Error('Missing question id.');
  const text = String(q.text || '');
  const options = (q.options || []).map(String);
  const answers = (req.answers || []).map(a => ({
    name: String(a.name || '').slice(0, 40),
    answer: String(a.answer || ''),
  }));
  const savedAt = req.closedAt ? new Date(req.closedAt) : new Date();

  replaceQuestionRows_(RESPONSES_SHEET, RESPONSE_HEADERS, 1, id,
    answers.map(a => [savedAt, id, text, a.name, a.answer]));

  const total = answers.length;
  const parts = options.map(label => {
    const count = answers.filter(a => a.answer === label).length;
    const pct = total ? Math.round(count / total * 100) : 0;
    return label + ': ' + count + ' (' + pct + '%)';
  });
  let average = '';
  if (q.type === 'scale' && total) {
    average = Math.round(answers.reduce((sum, a) => sum + Number(a.answer), 0) / total * 100) / 100;
  }
  replaceQuestionRows_(SUMMARY_SHEET, SUMMARY_HEADERS, 0, id,
    [[id, text, q.type || '', total, average, parts.join(' | '), savedAt]]);

  return { saved: total };
}

/**
 * Stores a participant's link in the activity's tab. One row per person: submitting again (same name,
 * or same device) replaces their earlier row. Different people may submit the same link (group work).
 */
function saveSubmission_(req) {
  const sheetName = String(req.sheet || '').trim();
  if (!/^[A-Za-z0-9 _\-]{1,50}$/.test(sheetName) || RESERVED_SHEETS.indexOf(sheetName) !== -1) {
    throw new Error('Invalid activity.');
  }
  const name = String(req.name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  if (!name) throw new Error('Please enter your name.');
  const link = String(req.link || '').trim();
  if (!/^https?:\/\/\S+$/i.test(link) || link.length > 2000) throw new Error('Please paste a full link (https://…).');
  const playerId = String(req.playerId || '').slice(0, 64);

  const sheet = getOrCreateSheet_(sheetName, SUBMISSION_HEADERS);
  const width = SUBMISSION_HEADERS.length;
  const sameName = n => String(n).trim().toLowerCase() === name.toLowerCase();
  const kept = sheet.getDataRange().getValues().slice(1)
    .filter(r => r.join('') !== '' && !sameName(r[1]) && !(playerId && String(r[3]) === playerId))
    .map(r => { const row = r.slice(0, width); while (row.length < width) row.push(''); return row; });
  const rows = [SUBMISSION_HEADERS].concat(kept, [[new Date(), name, link, playerId]]);
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, width).setValues(rows);
  return { saved: true };
}

// ---------- Questions ----------

function readQuestions_() {
  let sheet = getSpreadsheet_().getSheetByName(QUESTIONS_SHEET);
  if (!sheet) {
    setup();
    sheet = getSpreadsheet_().getSheetByName(QUESTIONS_SHEET);
  }
  const values = sheet.getDataRange().getDisplayValues();
  const header = values[0].map(h => String(h).trim().toLowerCase());
  const col = {};
  QUESTION_HEADERS.forEach(name => { col[name] = header.indexOf(name); });
  if (col.question === -1) throw new Error('The "Questions" tab has no "question" column.');
  const cell = (row, name) => (col[name] === -1 ? '' : String(row[col[name]] || '').trim());

  const questions = [];
  values.slice(1).forEach((row, i) => {
    const text = cell(row, 'question');
    if (!text) return;
    const id = cell(row, 'id') || String(i + 1);
    questions.push(parseQuestion_(id, text, cell(row, 'explanation'), cell(row, 'type'), cell(row, 'options')));
  });
  if (!questions.length) throw new Error('There are no questions in the "Questions" tab.');
  return questions;
}

function parseQuestion_(id, text, explanation, type, options) {
  const kind = (type || 'scale').toLowerCase().replace(/[\s_\-\/]/g, '');
  let opts;
  if (kind === 'yesno') {
    opts = YES_NO.slice();
  } else if (kind === 'scale') {
    const m = (options || '1-10').match(/^\s*(-?\d+)\s*(?:-|–|to|עד)\s*(-?\d+)\s*$/i);
    if (!m) throw new Error('Question ' + id + ': a scale needs a range like 1-10.');
    const lo = Number(m[1]);
    const hi = Number(m[2]);
    if (hi <= lo || hi - lo + 1 > MAX_SCALE_STEPS) throw new Error('Question ' + id + ': invalid range (' + options + ').');
    opts = [];
    for (let v = lo; v <= hi; v++) opts.push(String(v));
  } else if (kind === 'choice') {
    opts = String(options || '').split('|').map(s => s.trim()).filter(Boolean);
    if (opts.length < 2) throw new Error('Question ' + id + ': a choice needs at least two options separated by |.');
  } else {
    throw new Error('Question ' + id + ': unknown type "' + type + '" (scale / yesno / choice).');
  }
  return { id: id, text: text, explanation: explanation, type: kind, options: opts };
}

// ---------- Sheets ----------

/**
 * The game's spreadsheet: the one this script is bound to (Extensions → Apps Script), or,
 * for a standalone script, the one whose id is in the SHEET_ID script property.
 */
function getSpreadsheet_() {
  const active = SpreadsheetApp.getActive();
  if (active) return active;
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('The script is not linked to a spreadsheet. Open it from the Sheet (Extensions → Apps Script) or set SHEET_ID in Script properties.');
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

/** Gets a results tab, creating it if needed. A tab in an older column layout is renamed and kept aside. */
function getOrCreateSheet_(name, headers) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(name);
  if (sheet) {
    const current = sheet.getDataRange().getValues()[0].slice(0, headers.length).map(String);
    if (current.join('') === '' || current.join('|') === headers.join('|')) return sheet;
    sheet.setName(name + ' (old ' + Date.now() + ')');
  }
  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
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

// ---------- Run from the Apps Script editor ----------

/** Creates the game's tabs (Questions with sample questions, Responses, Summary). */
function setup() {
  const ss = getSpreadsheet_();
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
  console.log('The game tabs are ready in "' + ss.getName() + '": ' + ss.getUrl());
}

/** Shows which spreadsheet this script writes to. */
function showSheetUrl() {
  const ss = getSpreadsheet_();
  console.log('This script uses "' + ss.getName() + '": ' + ss.getUrl());
}
