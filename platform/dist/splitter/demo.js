/**
 * Original, locally rendered sample artwork for LayerLab.
 * Each sample is deliberately flattened to PNG before entering the editor, so
 * demos follow the same pixel analysis path as a user's uploaded photograph.
 * No original vector layers are exposed to, or used by, the segmentation tool.
 */

export const DEMOS = [
  { id: 'sports', title: '体育活动 Banner', subtitle: '文字 · 球体 · 按钮 · 背景', color: '#0d403b' },
  { id: 'ui', title: '旅行探索界面', subtitle: '卡片 · 插画 · 导航 · 排版', color: '#f2ede4' },
  { id: 'poster', title: '创意视觉海报', subtitle: '几何造型 · 标题 · 色块', color: '#ddd4f0' },
];

const SANS = 'Arial, "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", sans-serif';

function rounded(ctx, x, y, w, h, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function text(ctx, value, x, y, size, color, weight = 400, align = 'left') {
  ctx.font = `${weight} ${size}px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(value, x, y);
}

function spacedText(ctx, value, x, y, size, color, tracking = 3, weight = 600) {
  ctx.font = `${weight} ${size}px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  for (const char of value) {
    ctx.fillText(char, x, y);
    x += ctx.measureText(char).width + tracking;
  }
}

function circle(ctx, x, y, r, fill, stroke) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function polygon(ctx, pts, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.stroke(); }
}

function arrow(ctx, x, y, size, color, direction = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(direction, 1);
  ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-size / 2, 0); ctx.lineTo(size / 2, 0);
  ctx.moveTo(size / 8, -size / 3); ctx.lineTo(size / 2, 0); ctx.lineTo(size / 8, size / 3); ctx.stroke();
  ctx.restore();
}

function drawBall(ctx, cx, cy, r) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(-0.18);
  circle(ctx, 0, 0, r, '#ecf2dc');
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.clip();
  const white = ctx.createRadialGradient(-r * 0.36, -r * 0.46, r * 0.12, r * 0.3, r * 0.28, r * 1.3);
  white.addColorStop(0, '#fffef0'); white.addColorStop(0.65, '#dde7cc'); white.addColorStop(1, '#9cb9a4');
  ctx.fillStyle = white; ctx.fillRect(-r, -r, r * 2, r * 2);
  const pentagon = (x, y, radius, rotation) => Array.from({ length: 5 }, (_, i) => {
    const a = rotation + i * Math.PI * 2 / 5;
    return [x + Math.cos(a) * radius, y + Math.sin(a) * radius];
  });
  const mid = pentagon(-r * 0.055, -r * 0.055, r * 0.33, -Math.PI / 2);
  const outer = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    const x = Math.cos(a) * r * 0.94;
    const y = Math.sin(a) * r * 0.94;
    outer.push(pentagon(x, y, r * 0.28, a + Math.PI));
  }
  ctx.strokeStyle = '#789180'; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
    ctx.beginPath(); ctx.moveTo(mid[i][0], mid[i][1]);
    ctx.lineTo(Math.cos(a) * r * 0.71, Math.sin(a) * r * 0.71); ctx.stroke();
    const a2 = a + Math.PI / 5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.71, Math.sin(a) * r * 0.71);
    ctx.lineTo(Math.cos(a2) * r * 0.91, Math.sin(a2) * r * 0.91);
    ctx.lineTo(Math.cos(a + Math.PI * 2 / 5) * r * 0.71, Math.sin(a + Math.PI * 2 / 5) * r * 0.71);
    ctx.stroke();
  }
  const dark = ctx.createLinearGradient(-r, -r, r, r);
  // Sage panels remain visibly separate from the dark teal page even at the
  // perimeter, so the flattened sample has an unambiguous ball silhouette.
  dark.addColorStop(0, '#66876f'); dark.addColorStop(1, '#416b54');
  polygon(ctx, mid, dark);
  for (const p of outer) polygon(ctx, p, dark);
  ctx.restore();
}

function drawSports(ctx, w, h) {
  ctx.fillStyle = '#092f2b'; ctx.fillRect(0, 0, w, h);

  // Quiet, disconnected linework behind the main ball.
  ctx.save(); ctx.translate(1090, 425); ctx.rotate(-0.45);
  ctx.lineWidth = 1.6; ctx.strokeStyle = '#2b5c50';
  ctx.beginPath(); ctx.ellipse(0, 0, 330, 278, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, 0, 370, 309, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  rounded(ctx, 82, 70, 42, 42, 12, '#c8f56d');
  ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.strokeStyle = '#173c2f';
  ctx.beginPath(); ctx.moveTo(94, 98); ctx.lineTo(106, 83); ctx.lineTo(106, 95); ctx.lineTo(114, 95); ctx.stroke();
  spacedText(ctx, 'MATCHDAY / 2026', 146, 98, 18, '#b5cbb8', 2.5, 500);

  spacedText(ctx, 'CADA JUGADA CUENTA', 84, 236, 15, '#b7d798', 2.7, 600);
  text(ctx, 'EL JUEGO', 76, 358, 111, '#f0f1df', 800);
  text(ctx, 'EMPIEZA AQUÍ', 80, 466, 79, '#f0f1df', 800);
  text(ctx, 'La emoción está en el próximo movimiento.', 85, 526, 23, '#a8bfb1', 400);
  rounded(ctx, 84, 578, 279, 76, 38, '#c7f66d');
  text(ctx, 'Vive el partido', 112, 626, 23, '#12392e', 700);
  arrow(ctx, 329, 616, 24, '#12392e');

  drawBall(ctx, 1093, 422, 235);

  // Small detached corner motif and a ball label.
  ctx.save(); ctx.translate(1309, 170); ctx.rotate(Math.PI / 10);
  rounded(ctx, -8, -25, 16, 50, 3, '#c7f66d');
  rounded(ctx, -25, -8, 50, 16, 3, '#c7f66d'); ctx.restore();
  rounded(ctx, 953, 699, 282, 49, 25, '#164b3e');
  circle(ctx, 978, 723, 4, '#c7f66d');
  spacedText(ctx, 'EL FUTURO ES JUEGO', 995, 730, 12, '#c4d7c3', 1.2, 600);

  ctx.strokeStyle = '#2a5044'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(84, 790); ctx.lineTo(1356, 790); ctx.stroke();
  spacedText(ctx, 'PASIÓN EN CADA JUGADA.', 85, 841, 13, '#9bb6a4', 1.4, 500);
  text(ctx, '01 — 90′', 1355, 841, 17, '#c6d6c2', 500, 'right');
}

function landscape(ctx, x, y, w, h, type) {
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.clip();
  if (type === 'mountain') {
    ctx.fillStyle = '#d6dfcd'; ctx.fillRect(x, y, w, h);
    circle(ctx, x + w * 0.75, y + 62, 31, '#f9e9bd');
    polygon(ctx, [[x - 20, y + h], [x + w * 0.29, y + 55], [x + w * 0.63, y + h]], '#8f9f82');
    polygon(ctx, [[x + w * 0.25, y + h], [x + w * 0.75, y + 81], [x + w + 40, y + h]], '#afba96');
    polygon(ctx, [[x - 15, y + h], [x + w * 0.44, y + 141], [x + w + 80, y + h]], '#4d6a56');
    ctx.fillStyle = '#b5c4a1';
    ctx.beginPath(); ctx.moveTo(x + 220, y + h); ctx.bezierCurveTo(x + 330, y + 225, x + 200, y + 230, x + 245, y + 185);
    ctx.bezierCurveTo(x + 225, y + 228, x + 390, y + 242, x + 300, y + h); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const tx = x + 36 + i * 18, ty = y + h - 27 + (i % 2) * 10;
      polygon(ctx, [[tx - 10, ty], [tx, ty - 34], [tx + 10, ty]], '#304e40');
    }
  } else if (type === 'coast') {
    ctx.fillStyle = '#c7dce0'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#6ca6b1'; ctx.fillRect(x, y + h * 0.45, w, h * 0.55);
    polygon(ctx, [[x - 10, y + h], [x + 10, y + 130], [x + 65, y + 95], [x + 110, y + 148], [x + 168, y + h]], '#e1c8a6');
    polygon(ctx, [[x - 10, y + h], [x + 10, y + 143], [x + 60, y + 110], [x + 105, y + 160], [x + 125, y + h]], '#b4b397');
    ctx.strokeStyle = '#a7d3cf'; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(x + 146, y + 171 + i * 22); ctx.lineTo(x + 232, y + 171 + i * 22); ctx.stroke();
    }
    circle(ctx, x + w - 52, y + 50, 24, '#f4e8c7');
  } else {
    ctx.fillStyle = '#efcbb1'; ctx.fillRect(x, y, w, h);
    rounded(ctx, x + 17, y + 82, 84, h - 82, 2, '#a95c45');
    rounded(ctx, x + 111, y + 43, 107, h - 43, 2, '#d39769');
    rounded(ctx, x + 226, y + 114, 58, h - 114, 2, '#c97a58');
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 2; col++) {
        rounded(ctx, x + 34 + col * 35, y + 109 + row * 43, 15, 24, 6, '#ead5b7');
        rounded(ctx, x + 131 + col * 50, y + 79 + row * 50, 21, 31, 10, '#875e45');
      }
    }
    rounded(ctx, x + 143, y + 214, 43, 82, [22, 22, 0, 0], '#6d5142');
    ctx.fillStyle = '#d3b093'; ctx.fillRect(x, y + h - 19, w, 19);
  }
  ctx.restore();
}

function drawUI(ctx, w, h) {
  ctx.fillStyle = '#f7f4ee'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fdfbf7'; ctx.fillRect(0, 0, w, 89);
  circle(ctx, 75, 44, 18, '#d96245');
  ctx.strokeStyle = '#fff7ec'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(66, 48); ctx.lineTo(75, 35); ctx.lineTo(84, 48); ctx.stroke();
  text(ctx, '旅程', 106, 53, 23, '#2d3832', 700);
  text(ctx, '探索', 514, 52, 16, '#c5563d', 600);
  text(ctx, '目的地', 590, 52, 16, '#68726b', 400);
  text(ctx, '我的收藏', 682, 52, 16, '#68726b', 400);
  text(ctx, '中文', 1066, 51, 14, '#68726b', 400);
  circle(ctx, 1166, 44, 19, '#e7dccb');
  circle(ctx, 1166, 39, 6, '#b1a087');
  ctx.beginPath(); ctx.arc(1166, 55, 10, Math.PI, Math.PI * 2); ctx.fillStyle = '#b1a087'; ctx.fill();

  spacedText(ctx, 'FIND YOUR NEXT MOMENT', 72, 145, 12, '#a1735a', 1.6, 600);
  text(ctx, '探索下一站', 67, 214, 58, '#293a32', 700);
  text(ctx, '离开日常片刻，走进你向往的风景。', 72, 251, 18, '#8b9188', 400);

  rounded(ctx, 859, 164, 350, 61, 30, '#fffdf8');
  ctx.strokeStyle = '#878f85'; ctx.lineWidth = 1.8;
  circle(ctx, 887, 192, 7, null, '#878f85');
  ctx.beginPath(); ctx.moveTo(892, 197); ctx.lineTo(897, 202); ctx.stroke();
  text(ctx, '想去哪里？', 913, 201, 15, '#959b91');
  rounded(ctx, 1147, 173, 44, 44, 22, '#d96648'); arrow(ctx, 1169, 195, 19, '#fff6eb');

  const filterLabels = ['为你推荐', '山野漫游', '海岸时光', '城市发现'];
  const filterX = [72, 198, 324, 450];
  filterLabels.forEach((label, i) => {
    rounded(ctx, filterX[i], 285, 110, 37, 19, i === 0 ? '#d76244' : '#eee9e0');
    text(ctx, label, filterX[i] + 55, 309, 14, i === 0 ? '#fff8ec' : '#778173', i === 0 ? 600 : 400, 'center');
  });

  const cards = [
    { x: 72, w: 548, title: '去山里，听风的声音', place: '山野漫游 · 森林步道', type: 'mountain', tag: '本周精选' },
    { x: 645, w: 269, title: '沿着海岸，慢下来', place: '海岸时光 · 日落散步', type: 'coast', tag: '自在时光' },
    { x: 939, w: 269, title: '城市里的旧时光', place: '城市发现 · 街巷漫步', type: 'city', tag: '灵感漫游' },
  ];
  for (const card of cards) {
    rounded(ctx, card.x, 348, card.w, 389, 22, '#fffdf9');
    landscape(ctx, card.x + 11, 359, card.w - 22, 268, card.type);
    rounded(ctx, card.x + 26, 374, 88, 29, 15, '#fffaf0');
    text(ctx, card.tag, card.x + 70, 394, 11, '#777a68', 500, 'center');
    circle(ctx, card.x + card.w - 38, 389, 15, '#fffaf0');
    ctx.strokeStyle = '#8d8d7d'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(card.x + card.w - 43, 383); ctx.lineTo(card.x + card.w - 33, 383);
    ctx.lineTo(card.x + card.w - 33, 396); ctx.lineTo(card.x + card.w - 38, 392);
    ctx.lineTo(card.x + card.w - 43, 396); ctx.closePath(); ctx.stroke();
    text(ctx, card.title, card.x + 22, 666, card.w > 300 ? 24 : 19, '#374237', 600);
    text(ctx, card.place, card.x + 22, 699, 13, '#929487', 400);
    arrow(ctx, card.x + card.w - 31, 695, 17, '#b7b7a8');
  }

  text(ctx, '给自己一段慢下来的时间', 73, 805, 23, '#354136', 600);
  text(ctx, '每一个想出发的瞬间，都值得被认真对待。', 73, 840, 15, '#95978b');
  rounded(ctx, 1032, 791, 176, 48, 24, '#e9ede2');
  text(ctx, '探索更多目的地', 1114, 821, 14, '#73816b', 500, 'center');
  arrow(ctx, 1183, 815, 14, '#73816b');
}

function drawPoster(ctx, w, h) {
  ctx.fillStyle = '#ded6ef'; ctx.fillRect(0, 0, w, h);
  spacedText(ctx, 'VISUAL STUDIES / 026', 67, 70, 15, '#37313d', 1.8, 600);
  text(ctx, '01 — SHAPE', 1035, 70, 15, '#37313d', 500, 'right');
  text(ctx, 'FORM', 51, 280, 235, '#29252e', 900);
  text(ctx, '& SPACE', 58, 445, 151, '#29252e', 800);

  // A sculptural donut with an off-center hole; strong simple silhouette.
  ctx.save(); ctx.translate(674, 853); ctx.rotate(-0.35);
  const ring = ctx.createLinearGradient(-260, -270, 290, 330);
  ring.addColorStop(0, '#f29468'); ring.addColorStop(0.48, '#e77b56'); ring.addColorStop(1, '#c4523c');
  ctx.fillStyle = ring; ctx.beginPath();
  ctx.ellipse(0, 0, 291, 318, 0, 0, Math.PI * 2);
  ctx.ellipse(-9, -22, 133, 152, 0, 0, Math.PI * 2, true); ctx.fill('evenodd');
  ctx.restore();

  ctx.save(); ctx.translate(237, 757); ctx.rotate(-0.18);
  rounded(ctx, -111, -155, 222, 310, 11, '#37323d');
  rounded(ctx, -111, -155, 222, 33, [11, 11, 0, 0], '#4e4555');
  ctx.restore();
  const sphere = ctx.createRadialGradient(186, 517, 8, 228, 556, 130);
  sphere.addColorStop(0, '#f0e9f7'); sphere.addColorStop(0.6, '#c0afcf'); sphere.addColorStop(1, '#9483a6');
  circle(ctx, 221, 555, 94, sphere);

  // Detached small editorial marks, keeping the artwork easy to inspect.
  ctx.strokeStyle = '#83768e'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(68, 1019); ctx.lineTo(68, 1100); ctx.moveTo(54, 1086); ctx.lineTo(82, 1086); ctx.stroke();
  text(ctx, '形状之外', 97, 1055, 23, '#4b4154', 500);
  text(ctx, '让空间开始对话', 97, 1090, 15, '#76667e', 400);
  spacedText(ctx, 'A STUDY IN BALANCE', 687, 1196, 13, '#63546d', 1.4, 500);

  ctx.fillStyle = '#2e2933'; ctx.fillRect(0, 1227, w, 173);
  text(ctx, '关于形状、留白与空间的视觉练习', 66, 1301, 25, '#eae3f0', 500);
  spacedText(ctx, 'FORM. FEELING. FREEDOM.', 67, 1352, 12, '#b2a6bc', 1.8, 500);
  circle(ctx, 1012, 1312, 33, null, '#aea2b9');
  arrow(ctx, 1012, 1312, 29, '#ded5e7');
}

/**
 * @param {'sports'|'ui'|'poster'} kind
 * @returns {Promise<{blob:Blob,name:string,width:number,height:number}>}
 */
export async function createDemo(kind = 'sports') {
  const dimensions = {
    sports: [1440, 900, 'Matchday-体育活动示例.png', drawSports],
    ui: [1280, 900, '探索下一站-界面示例.png', drawUI],
    poster: [1100, 1400, 'Form-and-Space-海报示例.png', drawPoster],
  };
  const [width, height, name, draw] = dimensions[kind] || dimensions.sports;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('此浏览器暂不支持 Canvas 图片绘制。');
  draw(ctx, width, height);
  const blob = await new Promise((resolve, reject) => canvas.toBlob(value => {
    if (value) resolve(value); else reject(new Error('示例图片生成失败，请重试。'));
  }, 'image/png'));
  return { blob, name, width, height };
}
