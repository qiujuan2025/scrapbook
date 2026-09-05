// pages-store.js —— 一页 = 一份完整的 HTML 文件。
//
// 没有另立索引文件：元信息就写在页面自己的 <meta name="sb-*"> 里，
// 一个文件就是一整页，拷走就能用。
const fs = require('fs');
const path = require('path');

module.exports = function pages(dir, notes) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = (id) => path.join(dir, path.basename(id) + '.html');

  function meta(id) {
    const f = file(id);
    if (!fs.existsSync(f)) return null;
    const head = fs.readFileSync(f, 'utf8').slice(0, 4000);   // 头部就够，别读整份
    const pick = (k) => {
      const m = head.match(new RegExp('<meta\\s+name=["\']sb-' + k + '["\']\\s+content=["\']([^"\']*)["\']', 'i'));
      return m ? m[1].trim() : '';
    };
    const t = head.match(/<title>([^<]*)<\/title>/i);
    const st = fs.statSync(f);
    return {
      id,
      title: pick('title') || (t ? t[1].trim() : id),
      date: pick('date') || new Date(st.mtimeMs).toISOString().slice(0, 10),
      tags: pick('tags').split(/[,，\s]+/).filter(Boolean).slice(0, 8),
      cover: pick('cover'),
      blurb: pick('blurb'),
      notes: notes ? notes.list(id).length : 0,
      updated: Math.floor(st.mtimeMs / 1000),
    };
  }
  return {
    file, meta,
    list: () => fs.readdirSync(dir).filter((f) => /\.html$/i.test(f))
      .map((f) => meta(f.replace(/\.html$/i, ''))).filter(Boolean)
      .sort((a, b) => String(b.date).localeCompare(String(a.date))),
    html: (id) => (fs.existsSync(file(id)) ? fs.readFileSync(file(id), 'utf8') : null),
    write: (id, body) => { fs.writeFileSync(file(id), body, 'utf8'); return meta(id); },
  };
};
