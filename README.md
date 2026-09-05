# 手帐 · scrapbook

A scrapbook where **the author writes each page as free-form HTML**, and
**the reader can only stick things on top** — notes, emoji, stickers, photos.
The reader's annotations are anchored to *content*, not coordinates, so the
author can rewrite a page from scratch and everything the reader said stays
next to what it was said about.

---

一个手帐。**作者写页面，读者往上贴。**

## 为什么不是"拖出来的拼贴"

一开始是坐标式的：每件东西存 `{x, y, rot, w}`，一个算法自动排版。三个毛病：

- **排版靠 14 处随机** —— 好看纯属撞运气，撞到了也复现不了
- **高度靠估** —— `estHeight()` 猜文字行数、照片按 4:3 拍脑袋，猜错就重叠或留白
- **只有一种版式** —— 一张票和九张图排得一模一样

后来发现这些全是**自找的**：溢出、重叠、纸高不够，浏览器天生就做对，
是绝对定位把它们请回来的。所以改成——**一页 = 一份自由的 HTML**。
flex / grid / SVG / 动画随便用，排版问题消失，因为压根没在自己实现排版。

## 批注怎么活下来

页面归作者，可以整份推倒重写。那读者贴的东西怎么办？

**不存坐标，存"挂在哪块内容上"。**

```html
<figure data-block="chart">…</figure>
<p data-block="p-step">然后 20:41:06，三个轴同时跳了一下。</p>
```

```json
{ "anchor": "p-step", "dx": 12, "dy": -4, "text": "咪" }
```

渲染时先让浏览器把页面排好，再按 `data-block` 的实际位置把批注放上去。
**作者换版式、调顺序、加东西，只要那块内容还在，读者的话就还在它旁边。**

读者不需要知道有锚点这回事：她只管拖，松手时脚本算出落点压在哪块上。

三条附带的规矩：

- **`anchor: "note:<id>"`** —— 挂在另一条批注上，就是"回你这句"
- **挂的那块没了 → 不许无声消失**，收进页脚「掉下来的」，写明原本挂在哪
- **批注单独存**，作者重写整页碰不到它

## 两边都能做页，两边都能贴

```
一页 = 作者内容（HTML） + 贴上去的东西（批注层）

AI 做的一页    有作者内容，人往上贴、往上问
人做的一页     没有作者内容 —— 整页就是她贴出来的
               （批注层本来就支持「不挂内容块、钉在纸上」）
```

**所以"自己做一页"不需要第二套编辑器**：书架上点「开一页空白」，
得到的就是一张空白纸，贴便签、表情、贴纸、照片，随便拖。
AI 之后可以在同一页上贴、可以用 `note:<id>` 回她某一条，她也能回回去。

## 顺带解决的：读起来有意义

坐标格式读出来是「一张便签在 43,62」—— 什么都没说。锚点格式读出来是：

```
[p-step]  然后 20:41:06，三个轴同时跳了一下
   └ 便签  「咪」
[numbers] x 12.6 → 36.8
   └ 表情  ✨
   └ 便签  「哼哼～」
```

**"挂在哪"本身就是语义**。给人看、给程序看、给模型看，都比坐标有用。

## 跑起来

```sh
node server.js          # → http://localhost:4321
```

页面放 `data/pages/<id>.html`，元信息写在页面自己的头里：

```html
<meta name="sb-title" content="十三分钟的磁场">
<meta name="sb-date"  content="2023-09-28">
<meta name="sb-tags"  content="古董,磁力计">
<meta name="sb-blurb" content="一句话摘要">
```

**一个文件就是一整页**，没有另立的索引文件，拷走就能用。

页面末尾加一行就有批注层：

```html
<script>window.ANCHORED_NOTES = { pageId: 'demo' };</script>
<script src="/anchored-notes.js"></script>
```

## 文件

| | |
|---|---|
| `anchored-notes.js` | 批注层：显示、拖动、撕掉、贴纸/照片。对页面零要求 |
| `notes-store.js` | 批注存储，只增不改 |
| `pages-store.js` | 页面 = HTML 文件，元信息从 `<meta>` 读 |
| `server.js` | ~60 行，把上面串起来。零依赖 |
| `shelf.html` | 书架 |

## 手感上踩过的坑（都在代码注释里）

- **长按 320ms 才"拎起来"** —— 纸可以很长，碰到就拖的话根本没法滚页面
- 编辑态要 `touch-action:none` + `user-select:none`，否则一拖变成选中文字
- `pointermove` 上 `preventDefault` **挡不住页面滚动**，只有 `touchmove` 能
- 弹出的菜单要**排除自己的 pointerdown**，否则点菜单那一下先把菜单关了，click 落空
- 撕掉要**先让它消失再去后台删** —— 等服务器回来再重画的话，点完要愣一秒
- 每次重新渲染前要清掉上一轮的「掉下来的」，否则往下翻全是重复的

MIT
