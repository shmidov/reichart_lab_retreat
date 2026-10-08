#!/usr/bin/env node
// Local rehearsal server: serves the site from docs/ and fakes the Google Sheet backend by running
// apps-script/Code.gs against in-memory fakes of the Google services. Live messages still go through
// the real public relays, under a random dev game id, so they never mix with the real game.
//
//   node dev/mock-server.js            -> http://localhost:8080  (host password: "host")
//   PORT=9000 API_DELAY_MS=0 node dev/mock-server.js
//
// GET /mock/sheets shows the fake spreadsheet contents.

const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SITE = path.join(ROOT, 'docs');
const PORT = Number(process.env.PORT || 8080);
const HOST_PASSWORD = process.env.HOST_PASSWORD || 'host';
const GAME_ID = 'dev-' + Math.random().toString(36).slice(2, 10);
const API_DELAY_MS = Number(process.env.API_DELAY_MS ?? 1200); // Apps Script is about this slow

// ---------- fake Google services ----------

class FakeSheet {
  constructor(name) { this.name = name; this.rows = []; }
  grid() {
    const width = Math.max(1, ...this.rows.map(r => r.length));
    const rows = this.rows.length ? this.rows : [[]];
    return rows.map(r => Array.from({ length: width }, (_, i) => (r[i] === undefined ? '' : r[i])));
  }
  getDataRange() {
    return {
      getValues: () => this.grid(),
      getDisplayValues: () => this.grid().map(r => r.map(v => (v instanceof Date ? v.toISOString() : String(v)))),
    };
  }
  getRange(row, col, numRows, numCols) {
    return {
      setNumberFormat() { return this; },
      setValues: values => {
        if (values.length !== numRows || values.some(r => r.length !== numCols)) {
          throw new Error('setValues: data does not match range size');
        }
        values.forEach((r, i) => {
          const target = (this.rows[row - 1 + i] = this.rows[row - 1 + i] || []);
          r.forEach((v, j) => { target[col - 1 + j] = v; });
        });
      },
    };
  }
  setName(name) { sheets.delete(this.name); this.name = name; sheets.set(name, this); return this; }
  clearContents() { this.rows = []; }
  setFrozenRows() {}
}

const sheets = new Map();
const spreadsheet = {
  getName: () => 'Mock spreadsheet',
  getUrl: () => `http://localhost:${PORT}/mock/sheets`,
  getSheetByName: name => sheets.get(name) || null,
  insertSheet: name => { const s = new FakeSheet(name); sheets.set(name, s); return s; },
};

const props = new Map();
const properties = {
  getProperty: k => (props.has(k) ? props.get(k) : null),
  setProperty: (k, v) => { props.set(k, String(v)); return properties; },
  deleteProperty: k => { props.delete(k); return properties; },
  getProperties: () => Object.fromEntries(props),
};

const context = vm.createContext({
  console,
  SpreadsheetApp: { getActive: () => spreadsheet },
  PropertiesService: { getScriptProperties: () => properties },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  ContentService: {
    MimeType: { JSON: 'application/json' },
    createTextOutput: content => ({ content, setMimeType() { return this; } }),
  },
});
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script', 'Code.gs'), 'utf8'), context, { filename: 'Code.gs' });

// ---------- HTTP ----------

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function send(res, status, type, body) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api') {
    const reply = out => setTimeout(() => send(res, 200, 'application/json', out.content), API_DELAY_MS);
    if (req.method === 'GET') return reply(context.doGet({ parameter: Object.fromEntries(url.searchParams) }));
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => reply(context.doPost({ postData: { contents: body } })));
    return;
  }

  if (url.pathname === '/config.js') {
    const real = fs.readFileSync(path.join(SITE, 'config.js'), 'utf8');
    const override = { API_URL: '/api', GAME_ID, HOST_PASSWORD };
    return send(res, 200, TYPES['.js'], real + `\nObject.assign(window.APP_CONFIG, ${JSON.stringify(override)});\n`);
  }

  if (url.pathname === '/mock/sheets') {
    const out = {};
    sheets.forEach((s, name) => { out[name] = s.rows; });
    return send(res, 200, 'application/json', JSON.stringify(out, null, 2));
  }

  let file = path.normalize(path.join(SITE, decodeURIComponent(url.pathname)));
  if (!file.startsWith(SITE)) return send(res, 403, 'text/plain', 'Forbidden');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'text/plain', 'Not found');
    send(res, 200, TYPES[path.extname(file)] || 'application/octet-stream', data);
  });
}).listen(PORT, () => {
  console.log(`Mock game server on http://localhost:${PORT}`);
  console.log(`  players: http://localhost:${PORT}/`);
  console.log(`  host:    http://localhost:${PORT}/host.html   (password: ${HOST_PASSWORD})`);
  console.log(`  screen:  http://localhost:${PORT}/screen.html`);
  console.log(`  sheets:  http://localhost:${PORT}/mock/sheets`);
  console.log(`  game id: ${GAME_ID}   (bots: node dev/bots.js http://localhost:${PORT} 20)`);
});
