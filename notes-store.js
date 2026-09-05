// notes-store.js —— 批注的存储层：**只增不改**（对被批注的页面而言）。
//
// 设计前提：页面由作者写，读者不能改它，只能往上贴。
// 所以批注单独存一个文件，作者把整页推倒重写也碰不到它。
const fs = require('fs');
const path = require('path');

module.exports = function store(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const file = (id) => path.join(dir, path.basename(id) + '.json');
  const load = (id) => { try { return JSON.parse(fs.readFileSync(file(id), 'utf8')); } catch (e) { return []; } };
  const save = (id, l) => fs.writeFileSync(file(id), JSON.stringify(l), 'utf8');

  return {
    list: load,
    add(id, n) {
      const l = load(id);
      const it = {
        id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        at: Math.floor(Date.now() / 1000),
        by: n.by || 'reader',
        kind: n.kind || 'note',          // note | emoji | sticker
        text: String(n.text || '').slice(0, 800),
        src: n.src || '',
        anchor: n.anchor || '',          // data-block 名，或 note:<id>（= 回某条批注）
        dx: Number(n.dx) || 0, dy: Number(n.dy) || 0, rot: Number(n.rot) || 0,
      };
      l.push(it); save(id, l);
      return it;
    },
    // 只改批注自己的位置/文字 —— 改不到页面内容
    patch(id, nid, d) {
      const l = load(id); const it = l.find((x) => x.id === nid);
      if (!it) return null;
      ['anchor', 'text'].forEach((k) => { if (d[k] !== undefined) it[k] = String(d[k]).slice(0, 800); });
      ['dx', 'dy', 'rot'].forEach((k) => { if (d[k] !== undefined) it[k] = Number(d[k]) || 0; });
      save(id, l); return it;
    },
    del(id, nid) {
      const l = load(id); const i = l.findIndex((x) => x.id === nid);
      if (i < 0) return false;
      l.splice(i, 1); save(id, l); return true;
    },
  };
};
