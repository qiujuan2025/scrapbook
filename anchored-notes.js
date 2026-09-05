/* sb-note.js —— 手帐 HTML 页上的批注层。2026-09-05。
 *
 * 规矩（她定的）：**她只能读、只能增，不能改我写的东西。**
 * 所以批注不在页面 HTML 里，单独存 notes/<id>.json，我整份重写也碰不到。
 *
 * 挂法：批注记的是「挂在哪个 data-block 上 + 一点偏移」，不是纸上的绝对坐标。
 * 这样我改版式、调顺序、加东西，只要那块内容还在，她的话就还跟着它走。
 * 挂的那块没了 → 不许无声消失，收进页脚「掉下来的」。
 *
 * 这个脚本对页面本身零要求：我爱怎么设计怎么设计，它只负责在上面浮一层。
 */
(function () {
  // 接口路径都在这儿改；页面 id 默认从 /pages/<id>.html 里取，也可以自己传。
  var CFG = Object.assign({
    api:      '/api/notes',          // GET ?id= / POST 新增
    patch:    '/api/notes/patch',    // POST 挪位置
    del:      '/api/notes/del',      // POST 撕掉
    media:    '/api/media',          // POST {data:base64, media_type} → {src}
    stickers: '',                    // 可选：GET → {list:[{url,tag}]}
    review:   '',                    // 可选：POST {id} 叫作者来看
    pageId:   (location.pathname.match(/\/([^/]+?)\.html$/) || [])[1],
  }, window.ANCHORED_NOTES || {});
  var ID = CFG.pageId;
  if (!ID) return;
  var LAYER, notes = [];

  function el(t, cls, css) { var e = document.createElement(t); if (cls) e.className = cls; if (css) e.style.cssText = css; return e; }

  function style() {
    var s = el('style');
    s.textContent = [
      '.sbn-layer{position:absolute;inset:0;pointer-events:none;z-index:60}',
      '.sbn{position:absolute;pointer-events:auto;max-width:min(74vw,300px);',
      '  font:14px/1.65 -apple-system,"Noto Sans CJK SC",sans-serif;white-space:pre-wrap;',
      '  background:#fff6cf;color:#3a352e;padding:9px 12px;border-radius:2px;',
      '  box-shadow:0 2px 8px #0000004d,0 0 0 1px #0000000f;transform-origin:50% 0}',
      '.sbn.her{background:#fff6cf}',
      '.sbn.gu{background:#e8eef7}',
      '.sbn .who{display:block;font-size:11px;color:#00000059;text-align:right;margin-top:4px}',
      '.sbn-emoji{position:absolute;pointer-events:auto;font-size:30px;line-height:1;filter:drop-shadow(0 2px 3px #0006)}',
      '.sbn-fallen{max-width:720px;margin:6vh auto 0;padding:14px 22px;border-top:1px dashed #ffffff2e;',
      '  font:13px/1.8 -apple-system,sans-serif;color:#8b919b}',
      '.sbn-fallen b{display:block;font-weight:500;margin-bottom:6px;color:#a9aeb7}',
      '.sbn-sticker{position:absolute;pointer-events:auto;width:96px}',
      '.sbn-sticker img{display:block;width:100%;border-radius:3px;box-shadow:0 2px 8px #00000059}',
      '.sbn.lift,.sbn-emoji.lift,.sbn-sticker.lift{opacity:.85;z-index:99}',
      // 拖不动、一拖就选中文字 —— 是没禁掉文字选择和浏览器的触摸手势（2026-09-06 她报的）。
      // 只在编辑态禁，平时看页面照样能选字、能滚。
      'body.sbn-editing .sbn,body.sbn-editing .sbn-emoji,body.sbn-editing .sbn-sticker{',
      '  touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}',
      'body.sbn-editing .sbn{cursor:grab}',
      '.sbn-menu{position:fixed;z-index:95;background:#1c1f24;border-radius:10px;padding:6px;',
      '  box-shadow:0 6px 24px #000a;display:flex;gap:6px}',
      '.sbn-menu button{border:0;border-radius:7px;padding:9px 14px;background:#2a2e35;color:#e8e4dc;font-size:14px}',
      '.sbn-menu button.del{background:#7a3630}',
      '.sbn-call{position:fixed;left:18px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:80;',
      '  border:0;border-radius:999px;padding:12px 18px;background:#2a2e35;color:#e8e4dc;',
      '  font-size:14px;box-shadow:0 4px 16px #0009;cursor:pointer}',
      '.sbn-call:disabled{opacity:.6}',
      '.sbn-fab{position:fixed;right:18px;bottom:calc(18px + env(safe-area-inset-bottom));z-index:80;',
      '  width:52px;height:52px;border-radius:50%;border:0;background:#e8e4dc;color:#14161a;',
      '  font-size:21px;box-shadow:0 4px 16px #0009;cursor:pointer}',
      '.sbn-bar{position:fixed;left:0;right:0;bottom:0;z-index:82;display:flex;gap:8px;',
      '  padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:#181b20f2;',
      '  backdrop-filter:blur(8px);border-top:1px solid #ffffff1a}',
      '.sbn-bar button{flex:1;padding:11px 0;border:0;border-radius:9px;background:#2a2e35;',
      '  color:#e8e4dc;font-size:14px;cursor:pointer}',
      '.sbn-bar button.done{flex:0 0 68px;background:#e8e4dc;color:#14161a}',
      '.sbn-pickwrap{position:fixed;inset:0;z-index:90;background:#000000b8;display:grid;place-items:center}',
      '.sbn-pick{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:16px;',
      '  max-width:min(92vw,420px);max-height:70vh;overflow:auto;background:#1c1f24;border-radius:14px}',
      '.sbn-pick img{width:100%;border-radius:8px;cursor:pointer}',
    ].join('\n');
    document.head.appendChild(s);
  }

  function place(n) {
    // anchor 有两种：data-block（挂在页面内容上）和 note:<id>（挂在她某条批注上 = 回她这句）
    var host = null;
    if (n.anchor && n.anchor.indexOf('note:') === 0) host = LAYER.querySelector('[data-note="' + n.anchor.slice(5) + '"]');
    else if (n.anchor) host = document.querySelector('[data-block="' + n.anchor + '"]');
    if (n.anchor && !host) return null;                 // 掉下来了，交给 fallen
    var node;
    if (n.kind === 'emoji') { node = el('div', 'sbn-emoji'); node.textContent = n.text || '⭐'; }
    else if (n.kind === 'sticker') {
      node = el('div', 'sbn-sticker');
      var im = document.createElement('img'); im.src = n.src || ''; node.appendChild(im);
    }
    else {
      node = el('div', 'sbn ' + (n.by === 'gu' ? 'gu' : 'her'));
      node.textContent = n.text || '';   // 不署名 —— 她说「便签能不能把名字去掉」
    }
    node.dataset.note = n.id;
    node.style.rotate = (n.rot || 0) + 'deg';
    LAYER.appendChild(node);

    // 位置在布局完成之后算：贴在那块内容的右下，超出右边就翻到左边
    var pr = LAYER.getBoundingClientRect(), hr;
    if (host) hr = host.getBoundingClientRect();
    else hr = { left: pr.left + pr.width * 0.5, top: pr.top + pr.height * 0.35, width: 0, height: 0 };
    var nw = node.offsetWidth, x = hr.left - pr.left + hr.width - nw * 0.35 + (n.dx || 0);
    if (x + nw > pr.width - 8) x = hr.left - pr.left - nw * 0.65 + (n.dx || 0);
    node.style.left = Math.max(8, Math.min(pr.width - nw - 8, x)) + 'px';
    node.style.top = (hr.top - pr.top + hr.height - 18 + (n.dy || 0)) + 'px';
    bindDrag(node, n);
    return node;
  }

  function fallen(list) {
    // render() 会被 load / 字体就绪 / resize 反复调用，
    // 以前每调一次就往 body 追加一块 —— 她往下翻全是重复的（2026-09-06）。
    [].forEach.call(document.querySelectorAll('.sbn-fallen'), function (x) { x.remove(); });
    if (!list.length) return;
    var box = el('div', 'sbn-fallen');
    var b = el('b'); b.textContent = '掉下来的批注（原本挂着的那块内容没了）';
    box.appendChild(b);
    list.forEach(function (n) {
      var p = el('div');
      p.textContent = '· ' + (n.text || n.kind) + '　—— 原本挂在「' + n.anchor + '」';
      box.appendChild(p);
    });
    document.body.appendChild(box);
  }

  function render() {
    if (LAYER) LAYER.remove();
    LAYER = el('div', 'sbn-layer');
    var anchorBox = document.querySelector('.wrap') || document.body;
    if (getComputedStyle(anchorBox).position === 'static') anchorBox.style.position = 'relative';
    anchorBox.appendChild(LAYER);
    var lost = [];
    // 先放她的，再放我的 —— 我的回复可能挂在她某条批注上，得等那条先存在
    var mine = [], hers = [];
    notes.forEach(function (n) { (String(n.anchor || '').indexOf('note:') === 0 ? mine : hers).push(n); });
    hers.forEach(function (n) { if (!place(n)) lost.push(n); });
    mine.forEach(function (n) { if (!place(n)) lost.push(n); });
    fallen(lost);
  }


  /* ---------------- 贴东西（③）----------------
   * 她原来那套是围着坐标系统写的；这里搬过来的是「手感」不是代码：
   * 随便拖、能转能缩、长按撕掉。区别只在**松手时自动算锚点** ——
   * 落在哪一块内容上就挂在哪块，她不用知道有锚点这回事。
   */
  var EDIT = false, DRAG = null;

  function blocks() {
    return [].slice.call(document.querySelectorAll('[data-block]'));
  }
  // 松手时：落点在谁身上就挂谁；都不在就挂最近的那块；一个都没有才钉纸上
  function anchorAt(cx, cy) {
    var best = null, bestD = 1e9;
    blocks().forEach(function (b) {
      var r = b.getBoundingClientRect();
      var inside = cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
      var dx = cx - (r.left + r.width / 2), dy = cy - (r.top + r.height / 2);
      var d = inside ? 0 : Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { bestD = d; best = b; }
    });
    if (!best || bestD > 420) return null;
    var r = best.getBoundingClientRect();
    return { anchor: best.dataset.block,
             dx: Math.round(cx - (r.left + r.width)),      // 相对那块的右下角
             dy: Math.round(cy - (r.top + r.height)) };
  }

  function toolbar() {
    var bar = el('div', 'sbn-bar');
    bar.innerHTML =
      '<button data-t="note">便签</button>' +
      '<button data-t="emoji">表情</button>' +
      '<button data-t="sticker">贴纸</button>' +
      '<button data-t="photo">照片</button>' +
      '<button data-t="done" class="done">好了</button>';
    document.body.appendChild(bar);
    bar.onclick = function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t === 'done') {
        EDIT = false; document.body.classList.remove('sbn-editing');
        bar.remove(); fab().style.display = ''; render(); return;
      }
      pick(b.dataset.t);
    };
    return bar;
  }

  function callBtn() {
    var b = document.querySelector('.sbn-call');
    if (b) return b;
    b = el('button', 'sbn-call'); b.textContent = '叫 AI 来看';
    b.onclick = function () {
      b.disabled = true; b.textContent = '叫了，等他…';
      fetch(CFG.review || '/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ID }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          b.textContent = d && d.queued ? '他正忙，排上了' : '叫了，等他…';
          // 他写完会落进批注层，隔一会儿自己拉一次看看
          var tries = 0, t = setInterval(function () {
            tries++;
            fetch(CFG.api + '?id=' + encodeURIComponent(ID)).then(function (r) { return r.json(); })
              .then(function (d2) {
                var now = (d2 && d2.notes) || [];
                if (now.length > notes.length) {
                  notes = now; render(); clearInterval(t);
                  b.textContent = '他回了'; setTimeout(function () { b.remove(); }, 2600);
                }
              });
            if (tries > 60) { clearInterval(t); b.disabled = false; b.textContent = '叫 AI 来看'; }
          }, 4000);
        })
        .catch(function () { b.disabled = false; b.textContent = '叫 AI 来看'; });
    };
    document.body.appendChild(b);
    return b;
  }

  function fab() {
    var f = document.querySelector('.sbn-fab');
    if (f) return f;
    f = el('button', 'sbn-fab'); f.textContent = '✎';
    f.onclick = function () {
      EDIT = true; document.body.classList.add('sbn-editing');
      f.style.display = 'none'; toolbar();
    };
    document.body.appendChild(f);
    return f;
  }

  function pick(kind) {
    if (kind === 'note') {
      var t = prompt('写点什么');
      if (t && t.trim()) drop({ kind: 'note', text: t.trim() });
      return;
    }
    if (kind === 'emoji') {
      // 原来写了 split(/\s+/)[0] 只取第一个 —— 她在后面加的永远出不来（2026-09-06）。
      // 现在整串照用，她想贴几个就几个。
      var e2 = prompt('贴个表情', '🙀');
      if (e2 && e2.trim()) drop({ kind: 'emoji', text: e2.trim() });
      return;
    }
    if (kind === 'sticker') {
      // 两个库长得不一样，别弄混（2026-09-06 混过一次，她看到一屏破图）：
      // 贴纸库是**可选的、要自己接**：CFG.stickers 指向一个 GET，
      // 回 {list:[{url,tag}]} 就行。tag 是人写的描述（"猫咪/亲亲/抱住亲亲"），
      // 贴的时候会跟着一起存 —— 这样读这一页的人/AI 不用看图也知道贴的是什么。
      if (!CFG.stickers) { alert('没配贴纸库'); return; }
      fetch(CFG.stickers).then(function (r) { return r.json(); }).then(function (d) {
        var list = ((d && (d.list || d.stickers)) || [])
          .filter(function (x) { return x.url; })
          .map(function (x) { return { u: x.url, tag: x.tag || '' }; });
        if (!list.length) { alert('贴纸库是空的'); return; }
        var sh = el('div', 'sbn-pickwrap');
        sh.innerHTML = '<div class="sbn-pick">' + list.map(function (x) {
          return '<img src="' + x.u + '" data-src="' + x.u + '" data-tag="' + (x.tag || '').replace(/"/g, '') + '" title="' + (x.tag || '') + '" loading="lazy">';
        }).join('') + '</div>';
        document.body.appendChild(sh);
        sh.onclick = function (ev) {
          var im = ev.target.closest('img');
          if (im) drop({ kind: 'sticker', src: im.dataset.src, text: im.dataset.tag || '' });
          sh.remove();          // 点空白处也关得掉，不至于卡在一屏图里
        };
      });
      return;
    }
    if (kind === 'photo') {
      var inp = el('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = function () {
        var f = inp.files && inp.files[0]; if (!f) return;
        // /api/sb/media 收的是 JSON + base64（回 src，不是 url）—— 我一开始发 FormData，
        // 服务端 JSON.parse 失败，静默什么都没发生（2026-09-06 她报「贴不了图片」）。
        var fr = new FileReader();
        fr.onload = function () {
          fetch(CFG.media, { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: String(fr.result).split(',')[1], media_type: f.type }) })
            .then(function (r) { return r.json(); })
            .then(function (d) {
              if (d && d.src) drop({ kind: 'sticker', src: d.src });
              else alert('图片没传上去：' + ((d && d.error) || '不知道为什么'));
            });
        };
        fr.readAsDataURL(f);
      };
      inp.click();
    }
  }

  // 新贴的东西先落在屏幕中间，等她拖到想要的地方，松手才算锚点
  function drop(spec) {
    var vw = innerWidth / 2, vh = innerHeight * 0.45;
    var a = anchorAt(vw, vh) || {};
    var n = Object.assign({ id: 'tmp', by: 'her', rot: (Math.random() * 8 - 4) | 0 }, spec, a);
    notes.push(n);
    render();          // 先显示，别等服务器
    save(n);
  }

  function save(n) {
    fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      // ⚠️ 顺序不能反：n.id 是批注自己的 id（新贴的是占位 'tmp'），
      // 写成 Object.assign({id:ID}, n) 会被它顶掉，整批存进 notes/tmp.json（2026-09-06 踩过）。
      body: JSON.stringify(Object.assign({}, n, { id: ID })) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.note) { n.id = d.note.id; } });
  }


  /* 拖动自己贴的东西：长按 320ms 拎起来（短按滑过去还是滚页面，跟她原来的手感一样），
     松手时重新算挂在哪一块 —— 她只管拖，锚点是我算的。 */
  function bindDrag(node, n) {
    var t0 = 0, lifted = false, sx = 0, sy = 0, ox = 0, oy = 0, timer = null;
    node.addEventListener('pointerdown', function (e) {
      if (!EDIT) return;
      e.preventDefault();               // 不 preventDefault 的话长按会变成「选中文字」
      sx = e.clientX; sy = e.clientY;
      ox = parseFloat(node.style.left) || 0; oy = parseFloat(node.style.top) || 0;
      t0 = Date.now();
      timer = setTimeout(function () {
        lifted = true; node.classList.add('lift');
        try { node.setPointerCapture(e.pointerId); } catch (er) {}
        if (navigator.vibrate) navigator.vibrate(12);
      }, 320);
    });
    node.addEventListener('pointermove', function (e) {
      if (!lifted) { if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 10) clearTimeout(timer); return; }
      e.preventDefault();
      node.style.left = (ox + e.clientX - sx) + 'px';
      node.style.top = (oy + e.clientY - sy) + 'px';
    });
    node.addEventListener('touchmove', function (e) { if (lifted) e.preventDefault(); }, { passive: false });
    node.addEventListener('pointerup', function (e) {
      clearTimeout(timer);
      if (!lifted) {
        // 原来写的是「长按超过 600ms = 撕掉」，可 320ms 就一定拎起来了，
        // 这个分支永远走不到 —— 等于删除功能根本不存在（2026-09-06 她报「没办法删掉」）。
        // 换成：编辑态里**轻点一下**弹菜单，看得见、点得着。
        if (EDIT && Date.now() - t0 < 320) menu(n, e.clientX, e.clientY);
        return;
      }
      lifted = false; node.classList.remove('lift');
      var r = node.getBoundingClientRect();
      var a = anchorAt(r.left + r.width / 2, r.top + r.height / 2) || { anchor: '', dx: 0, dy: 0 };
      Object.assign(n, a);
      fetch(CFG.patch, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ID, nid: n.id, anchor: a.anchor, dx: a.dx, dy: a.dy }) })
        .then(function () { render(); });
    });
  }

  function menu(n, x, y) {
    var old = document.querySelector('.sbn-menu'); if (old) old.remove();
    var m = el('div', 'sbn-menu');
    m.innerHTML = '<button data-a="del" class="del">撕掉</button>';
    document.body.appendChild(m);
    var w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(innerWidth - w - 8, x - w / 2)) + 'px';
    m.style.top = Math.max(8, y - h - 14) + 'px';
    m.onclick = function (ev) {
      var b = ev.target.closest('button'); if (!b) return;
      m.remove();
      if (b.dataset.a === 'del') tear(n);
    };
    // ⚠️ 点「撕掉」本身也是一次 pointerdown —— 不排除自己的话，
    // 菜单会在 click 落地之前就被关掉，表现就是「点了没用」（2026-09-06 她报的）。
    setTimeout(function () {
      document.addEventListener('pointerdown', function once(ev) {
        if (m.contains(ev.target)) return;      // 点在菜单里，不关
        m.remove(); document.removeEventListener('pointerdown', once);
      });
    }, 50);
  }

  function tear(n) {
    // 先让它消失，再去后台删 —— 她走域名，一来一回 1~1.5 秒，
    // 等服务器回来再重画的话，点完要愣一下（2026-09-06 她说「撕掉有点慢」）。
    // 删失败就放回来并说一声，不静默。
    var backup = notes.slice();
    notes = notes.filter(function (x) { return x.id !== n.id; });
    render();
    fetch(CFG.del, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ID, nid: n.id }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d || !d.ok) throw new Error('删除没成功'); })
      .catch(function (e) { notes = backup; render(); alert('没撕掉：' + e.message); });
  }

  fetch(CFG.api + '?id=' + encodeURIComponent(ID))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      notes = (d && d.notes) || [];
      style();
      fab();                       // 一条都没有时也得能贴（第一版在这儿 return 了）
      // 「叫 AI 来看」的按钮只在服务端真的配了 agent 时才出现 ——
      // 没配就是纯人用的手帐，别给一个按了没反应的按钮。
      fetch('/api/config').then(function (r) { return r.json(); })
        .then(function (c) { if (c && c.agent) callBtn(); }).catch(function () {});
      // 等字体和图都稳定了再定位，否则量到的是旧盒子
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(render); else render();
      addEventListener('load', render);
      var t; addEventListener('resize', function () { clearTimeout(t); t = setTimeout(render, 150); });
    })
    .catch(function () {});
})();
