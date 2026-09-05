#!/usr/bin/env node
// 一个能直接跑起来的手帐：node server.js  → http://localhost:4321
//
// 作者写页面（pages/*.html，随便怎么排版），读者只能往上贴批注。
// 两边分开存，作者把整页推倒重写也碰不到读者贴的东西。
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = process.env.SB_DATA || path.join(ROOT, 'data');
const notes = require('./notes-store')(path.join(DATA, 'notes'));
const pages = require('./pages-store')(path.join(DATA, 'pages'), notes);
const MEDIA = path.join(DATA, 'media');
if (!fs.existsSync(MEDIA)) fs.mkdirSync(MEDIA, { recursive: true });

const MIME = { html: 'text/html; charset=utf-8', js: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
const mimeOf = (f) => MIME[(f.split('.').pop() || '').toLowerCase()] || 'application/octet-stream';
const json = (res, o) => { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
const body = (req) => new Promise((ok) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { try { ok(JSON.parse(b)); } catch (e) { ok({}); } }); });

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  if (p === '/api/notes' && req.method === 'GET') return json(res, { ok: true, notes: notes.list(u.searchParams.get('id') || '') });
  if (p === '/api/notes' && req.method === 'POST') { const d = await body(req); return json(res, { ok: true, note: notes.add(d.id, d) }); }
  if (p === '/api/notes/patch' && req.method === 'POST') { const d = await body(req); return json(res, { ok: true, note: notes.patch(d.id, d.nid, d) }); }
  if (p === '/api/notes/del' && req.method === 'POST') { const d = await body(req); return json(res, { ok: notes.del(d.id, d.nid) }); }
  if (p === '/api/pages' && req.method === 'GET') return json(res, { ok: true, pages: pages.list() });

  // 开一页空白 —— **这就是"读者自己做的一页"**：没有作者内容，
  // 整页都是她贴出来的（批注层本来就支持不挂任何内容块，钉在纸上）。
  // 所以两边用的是同一套东西，不需要第二个编辑器。
  if (p === '/api/pages' && req.method === 'POST') {
    const d = await body(req);
    const id = (d.id || 'p' + Date.now().toString(36)).replace(/[^\w-]/g, '');
    if (pages.html(id)) return json(res, { ok: false, error: 'exists' });
    const esc = (x) => String(x || '').replace(/[<>"&]/g, '');
    pages.write(id, [
      '<!doctype html><html lang="zh"><head><meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width,initial-scale=1">',
      '<title>' + esc(d.title || '还没起名字') + '</title>',
      '<meta name="sb-title" content="' + esc(d.title || '还没起名字') + '">',
      '<meta name="sb-date" content="' + esc(d.date || new Date().toISOString().slice(0, 10)) + '">',
      '<meta name="sb-tags" content="' + esc(d.tags || '') + '">',
      '<style>body{margin:0;background:#efe9dd;font:16px system-ui,sans-serif}',
      '.wrap{max-width:680px;margin:0 auto;min-height:150vh;position:relative}</style>',
      '</head><body><div class="wrap"></div>',
      '<script>window.ANCHORED_NOTES={pageId:"' + id + '"};<\/script>',
      '<script src="/anchored-notes.js"><\/script>',
      '</body></html>',
    ].join('\n'));
    return json(res, { ok: true, page: pages.meta(id) });
  }

  // 贴照片：JSON + base64（比 multipart 少一个依赖）
  if (p === '/api/media' && req.method === 'POST') {
    const d = await body(req);
    if (!d.data) return json(res, { ok: false, error: 'no data' });
    const ext = ((d.media_type || 'image/jpeg').split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '');
    const name = Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + '.' + ext;
    fs.writeFileSync(path.join(MEDIA, name), Buffer.from(d.data, 'base64'));
    return json(res, { ok: true, src: '/media/' + name });
  }

  const send = (full, cache) => {
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': mimeOf(full), 'Cache-Control': cache || 'no-store' });
    res.end(fs.readFileSync(full));
  };
  // 页面会被作者反复重写，一律不缓存；媒体是不变的，可以长缓存
  if (p.startsWith('/pages/')) return send(pages.file(path.basename(p).replace(/\.html$/, '')));
  if (p.startsWith('/media/')) return send(path.join(MEDIA, path.basename(p)), 'public, max-age=31536000');
  if (p === '/anchored-notes.js') return send(path.join(ROOT, 'anchored-notes.js'));
  if (p === '/' || p === '/index.html') return send(path.join(ROOT, 'shelf.html'));
  res.writeHead(404); res.end('not found');
}).listen(process.env.PORT || 4321, () => {
  console.log('手帐在 http://localhost:' + (process.env.PORT || 4321));
  console.log('页面放 ' + path.join(DATA, 'pages') + '/<id>.html');
});
