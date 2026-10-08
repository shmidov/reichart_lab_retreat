#!/usr/bin/env node
// Local rehearsal server: runs apps-script/Code.gs against in-memory fakes of the
// Google services, and serves the site from docs/ with API_URL pointed at it.
//
//   node dev/mock-server.js            -> http://localhost:8080  (host password: "host")
//   PORT=9000 HOST_PASSWORD=x node dev/mock-server.js
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

const props = new Map([['HOST_PASSWORD', HOST_PASSWORD]]);
const properties = {
  getProperty: k => (props.has(k) ? props.get(k) : null),
  setProperty: (k, v) => { props.set(k, String(v)); return properties; },
  deleteProperty: k => { props.delete(k); return properties; },
  getProperties: () => Object.fromEntries(props),
};

const cache = new Map();
const scriptCache = {
  get: k => (cache.has(k) ? cache.get(k) : null),
  put: (k, v) => { cache.set(k, v); },
  remove: k => { cache.delete(k); },
};

const context = vm.createContext({
  console,
  SpreadsheetApp: { getActive: () => spreadsheet },
  PropertiesService: { getScriptProperties: () => properties },
  CacheService: { getScriptCache: () => scriptCache },
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
    if (req.method === 'GET') {
      return send(res, 200, 'application/json', context.doGet({ parameter: Object.fromEntries(url.searchParams) }).content);
    }
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => send(res, 200, 'application/json', context.doPost({ postData: { contents: body } }).content));
    return;
  }

  if (url.pathname === '/config.js') {
    return send(res, 200, TYPES['.js'], "window.APP_CONFIG = { API_URL: '/api' };\n");
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
});
