/**
 * Local image segmentation. No image pixels leave the browser.
 *
 * analyzeImage(ImageData, options, onProgress) -> Promise<{layers,analysis}>
 *   options: mode: 'balanced' | 'detail' | 'subject'; maxLayers: 2..12;
 *   tolerance: 8..72 (default 32); fallback: 'color' | 'source';
 *   strategy: 'auto' | 'color'; analysisSize: 320..1000 (default 800).
 *   onProgress({progress: 0..100, stage: Chinese display text}).
 *
 * Layers are in visual top-to-bottom order. Each has a full-size RGBA buffer,
 * width/height, x/y=0, id, name, type, and stats including bounds/pixelCount.
 * Pixels form a disjoint partition: every original pixel belongs to exactly
 * one layer. Source alpha and antialias pixels are retained without alteration.
 * This is color/geometry analysis, not semantic AI or editable text recovery.
 *
 * selectRegion(ImageData,x,y,tolerance=32,contiguous=true) -> Uint8Array,
 * with one byte per pixel, 0 = unselected, 1 = selected.
 * maskToLayer(ImageData, mask, metadata={}) -> a full-size RGBA layer.
 */

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const distance2 = (r, g, b, rr, gg, bb) => {
  const dr = r - rr, dg = g - gg, db = b - bb;
  return .3 * dr * dr + .5 * dg * dg + .2 * db * db;
};
const uid = () => globalThis.crypto?.randomUUID?.() || `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

function validateImage(image) {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height)
    || image.width < 1 || image.height < 1 || !image.data
    || image.data.length !== image.width * image.height * 4) {
    throw new Error('图片像素数据无效，请重新上传图片。');
  }
}

function downsample(image, maxSize) {
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const rgba = new Uint8ClampedArray(width * height * 4);
  const sx = image.width / width, sy = image.height / height;
  const src = image.data;
  for (let y = 0; y < height; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < width; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let iy = y0; iy < Math.min(image.height, y1); iy++) {
        for (let ix = x0; ix < Math.min(image.width, x1); ix++) {
          const p = (iy * image.width + ix) * 4, alpha = src[p + 3] / 255;
          r += src[p] * alpha; g += src[p + 1] * alpha; b += src[p + 2] * alpha;
          a += alpha; count++;
        }
      }
      const p = (y * width + x) * 4;
      if (a) { rgba[p] = r / a; rgba[p + 1] = g / a; rgba[p + 2] = b / a; }
      rgba[p + 3] = count ? a * 255 / count : 0;
    }
  }
  return { width, height, data: rgba };
}

function borderPalette(image) {
  const { width: w, height: h, data } = image;
  const bins = new Map();
  let transparent = 0, total = 0;
  const take = index => {
    const p = index * 4; total++;
    if (data[p + 3] < 16) { transparent++; return; }
    const key = ((data[p] >> 4) << 8) | ((data[p + 1] >> 4) << 4) | (data[p + 2] >> 4);
    let bin = bins.get(key);
    if (!bin) { bin = { n: 0, r: 0, g: 0, b: 0 }; bins.set(key, bin); }
    bin.n++; bin.r += data[p]; bin.g += data[p + 1]; bin.b += data[p + 2];
  };
  const inset = Math.min(2, Math.floor(Math.min(w, h) / 8));
  for (let x = 0; x < w; x++) { take(inset * w + x); if (h > 1) take((h - 1 - inset) * w + x); }
  for (let y = 1; y < h - 1; y++) { take(y * w + inset); if (w > 1) take(y * w + w - 1 - inset); }
  const ranked = [...bins.values()].sort((a, b) => b.n - a.n);
  const palette = [];
  for (const bin of ranked) {
    const r = bin.r / bin.n, g = bin.g / bin.n, b = bin.b / bin.n;
    const nearest = palette.find(c => distance2(r, g, b, c.r, c.g, c.b) < 26 * 26);
    if (nearest) {
      const n = nearest.n + bin.n;
      nearest.r = (nearest.r * nearest.n + bin.r) / n;
      nearest.g = (nearest.g * nearest.n + bin.g) / n;
      nearest.b = (nearest.b * nearest.n + bin.b) / n;
      nearest.n = n;
    } else if (palette.length < 8) palette.push({ r, g, b, n: bin.n });
  }
  palette.sort((a, b) => b.n - a.n);
  const dominant = palette[0]?.n || 0;
  const solid = dominant / Math.max(1, total - transparent);
  // Rare border objects must not define the inferred background palette.
  const allowed = palette.filter(c => c.n >= Math.max(3, dominant * .12));
  return { colors: allowed.slice(0, solid > .7 ? 3 : 6), transparent: transparent / total, solid };
}

async function backgroundMask(image, palette, tolerance, progress) {
  const { width: w, height: h, data } = image, n = w * h;
  const mask = new Uint8Array(n), queue = new Int32Array(n), eligible = new Uint8Array(n);
  const t2 = tolerance * tolerance;
  const colors = palette.colors;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    if (data[p + 3] < 16) { eligible[i] = 1; continue; }
    let best = Infinity;
    for (let k = 0; k < colors.length; k++) {
      const c = colors[k];
      const d = distance2(data[p], data[p + 1], data[p + 2], c.r, c.g, c.b);
      if (d < best) best = d;
    }
    if (best <= t2) eligible[i] = 1;
  }
  let head = 0, tail = 0;
  const seed = i => { if (!mask[i] && eligible[i]) { mask[i] = 1; queue[tail++] = i; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 1; y < h - 1; y++) { seed(y * w); seed(y * w + w - 1); }
  while (head < tail) {
    const end = Math.min(tail, head + 40000);
    while (head < end) {
      const i = queue[head++], x = i % w;
      if (x > 0) seed(i - 1);
      if (x < w - 1) seed(i + 1);
      if (i >= w) seed(i - w);
      if (i < n - w) seed(i + w);
    }
    if (head % 120000 < 40000) { progress(18 + 10 * head / n, '识别背景边界'); await tick(); }
  }
  return { mask, count: tail };
}

function dilate(mask, w, h, radius) {
  if (!radius) return mask;
  const temp = new Uint8Array(mask.length), out = new Uint8Array(mask.length);
  for (let y = 0; y < h; y++) {
    let sum = 0, row = y * w;
    for (let x = 0; x <= Math.min(w - 1, radius); x++) sum += mask[row + x];
    for (let x = 0; x < w; x++) {
      temp[row + x] = sum > 0 ? 1 : 0;
      if (x - radius >= 0) sum -= mask[row + x - radius];
      if (x + radius + 1 < w) sum += mask[row + x + radius + 1];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(h - 1, radius); y++) sum += temp[y * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum > 0 ? 1 : 0;
      if (y - radius >= 0) sum -= temp[(y - radius) * w + x];
      if (y + radius + 1 < h) sum += temp[(y + radius + 1) * w + x];
    }
  }
  return out;
}

async function connectedGroups(foreground, w, h, mode, progress) {
  const radius = mode === 'detail' ? 1 : Math.max(2, Math.round(Math.min(w, h) / 180));
  const expanded = dilate(foreground, w, h, Math.min(4, radius));
  const labels = new Uint32Array(w * h), queue = new Int32Array(w * h), groups = [];
  let id = 0;
  for (let start = 0; start < expanded.length; start++) {
    if (!expanded[start] || labels[start]) continue;
    id++;
    let head = 0, tail = 1, area = 0, minX = w, minY = h, maxX = 0, maxY = 0;
    queue[0] = start; labels[start] = id;
    while (head < tail) {
      const i = queue[head++], x = i % w, y = (i / w) | 0;
      if (foreground[i]) { area++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
      let j;
      if (x > 0) { j = i - 1; if (expanded[j] && !labels[j]) { labels[j] = id; queue[tail++] = j; } }
      if (x < w - 1) { j = i + 1; if (expanded[j] && !labels[j]) { labels[j] = id; queue[tail++] = j; } }
      if (i >= w) { j = i - w; if (expanded[j] && !labels[j]) { labels[j] = id; queue[tail++] = j; } }
      if (i < expanded.length - w) { j = i + w; if (expanded[j] && !labels[j]) { labels[j] = id; queue[tail++] = j; } }
    }
    // A thin flourish can touch a word after dilation and inflate its bounding
    // box across several rows. Use dense bounds only to compare alignment;
    // every original component pixel still travels with the final group.
    let coreMinX = minX, coreMinY = minY, coreMaxX = maxX, coreMaxY = maxY;
    if (area > 60) {
      const rows = new Uint32Array(maxY - minY + 1), cols = new Uint32Array(maxX - minX + 1);
      for (let q = 0; q < tail; q++) {
        const i = queue[q];
        if (foreground[i]) { cols[i % w - minX]++; rows[((i / w) | 0) - minY]++; }
      }
      const trim = Math.max(1, Math.floor(area * .018));
      const limits = histogram => {
        let lo = 0, hi = histogram.length - 1, count = 0;
        while (lo < hi && count + histogram[lo] <= trim) count += histogram[lo++];
        count = 0;
        while (hi > lo && count + histogram[hi] <= trim) count += histogram[hi--];
        return [lo, hi];
      };
      const [x0, x1] = limits(cols), [y0, y1] = limits(rows);
      coreMinX = minX + x0; coreMaxX = minX + x1;
      coreMinY = minY + y0; coreMaxY = minY + y1;
    }
    groups.push({ id, area, minX, minY, maxX, maxY, coreMinX, coreMinY, coreMaxX, coreMaxY });
    if (id % 100 === 0) { progress(34 + 10 * start / expanded.length, '合并相邻内容'); await tick(); }
  }
  return { labels, groups };
}

function groupComponents(groups, mode, maxCount, pixelCount) {
  const meaningful = groups.filter(g => g.area >= Math.max(5, pixelCount * (mode === 'detail' ? .000025 : .00006)))
    .sort((a, b) => b.area - a.area);
  if (mode === 'subject') return { clusters: meaningful.length ? [{ members: groups.map(g => g.id), area: groups.reduce((a, g) => a + g.area, 0) }] : [], residual: [] };
  // Merge word/letter pieces on a common baseline. Iteration is important:
  // an earlier skipped neighbor can become adjacent after the next word joins.
  const clusters = meaningful.slice(0, 240).map(g => ({ ...g, members: [g.id] }));
  if (mode !== 'detail') {
    let changed = true, passes = 0;
    while (changed && passes++ < 8) {
      changed = false;
      for (let a = 0; a < clusters.length; a++) {
        const ca = clusters[a]; if (!ca) continue;
        for (let b = a + 1; b < clusters.length; b++) {
          const cb = clusters[b]; if (!cb) continue;
          const ha = ca.coreMaxY - ca.coreMinY + 1, hb = cb.coreMaxY - cb.coreMinY + 1;
          const minH = Math.min(ha, hb), maxH = Math.max(ha, hb);
          const overlapY = Math.min(ca.coreMaxY, cb.coreMaxY) - Math.max(ca.coreMinY, cb.coreMinY) + 1;
          const gapX = Math.max(0, Math.max(ca.coreMinX, cb.coreMinX) - Math.min(ca.coreMaxX, cb.coreMaxX) - 1);
          const baselineDifference = Math.abs(ca.coreMaxY - cb.coreMaxY);
          const aligned = overlapY / minH > .65 && baselineDifference <= Math.max(3, minH * .32);
          const nearby = gapX <= Math.min(28, Math.max(5, minH * .85));
          const similarHeight = maxH / minH < 1.85;
          if (aligned && nearby && similarHeight) {
            ca.members.push(...cb.members); ca.area += cb.area;
            ca.minX = Math.min(ca.minX, cb.minX); ca.maxX = Math.max(ca.maxX, cb.maxX);
            ca.minY = Math.min(ca.minY, cb.minY); ca.maxY = Math.max(ca.maxY, cb.maxY);
            ca.coreMinX = Math.min(ca.coreMinX, cb.coreMinX); ca.coreMaxX = Math.max(ca.coreMaxX, cb.coreMaxX);
            ca.coreMinY = Math.min(ca.coreMinY, cb.coreMinY); ca.coreMaxY = Math.max(ca.coreMaxY, cb.coreMaxY);
            clusters[b] = null; changed = true;
          }
        }
      }
    }
  }
  const ranked = clusters.filter(Boolean).sort((a, b) => b.area - a.area);
  const selected = ranked.slice(0, maxCount);
  const included = new Set(selected.flatMap(g => g.members));
  const residual = groups.filter(g => !included.has(g.id)).map(g => g.id);
  return { clusters: selected, residual };
}

async function colorPartition(image, maxLayers, progress) {
  const { data, width: w, height: h } = image, n = w * h;
  const stride = Math.max(1, Math.floor(n / 28000));
  const samples = [];
  for (let i = 0; i < n; i += stride) if (data[i * 4 + 3] > 8) samples.push(i * 4);
  if (!samples.length) return { labels: new Uint16Array(n), descriptions: [{ name: '原图', type: 'original' }] };
  const bins = new Map();
  for (const p of samples) {
    const key = ((data[p] >> 5) << 6) | ((data[p + 1] >> 5) << 3) | (data[p + 2] >> 5);
    const bin = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bin.n++; bin.r += data[p]; bin.g += data[p + 1]; bin.b += data[p + 2]; bins.set(key, bin);
  }
  const ranked = [...bins.values()].sort((a, b) => b.n - a.n);
  const centers = [];
  for (const bin of ranked) {
    const c = [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n];
    if (!centers.some(k => distance2(...c, ...k) < 25 * 25)) centers.push(c);
    if (centers.length >= Math.min(6, maxLayers)) break;
  }
  if (!centers.length) centers.push([0, 0, 0]);
  const nearest = p => {
    let id = 0, best = Infinity;
    for (let k = 0; k < centers.length; k++) {
      const d = distance2(data[p], data[p + 1], data[p + 2], ...centers[k]);
      if (d < best) { best = d; id = k; }
    }
    return id;
  };
  for (let iteration = 0; iteration < 7; iteration++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of samples) { const sum = sums[nearest(p)]; sum[0] += data[p]; sum[1] += data[p + 1]; sum[2] += data[p + 2]; sum[3]++; }
    sums.forEach((s, k) => { if (s[3]) centers[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
    progress(38 + iteration * 3, '按实际色彩划分区域'); await tick();
  }
  const labels = new Uint16Array(n), counts = centers.map(() => 0);
  for (let i = 0; i < n; i++) { const k = nearest(i * 4); labels[i] = k; counts[k]++; }
  const order = counts.map((count, id) => ({ count, id })).sort((a, b) => a.count - b.count);
  const remap = new Uint16Array(centers.length);
  const descriptions = order.map((g, i) => {
    remap[g.id] = i;
    return { name: `色彩区域 ${String(i + 1).padStart(2, '0')}`, type: 'color', color: centers[g.id].map(Math.round) };
  });
  for (let i = 0; i < n; i++) labels[i] = remap[labels[i]];
  return { labels, descriptions };
}

async function materialize(image, small, labels, descriptions, progress) {
  const { width: W, height: H, data: source } = image, { width: w, height: h, data: sampled } = small;
  const layers = descriptions.map(description => ({
    id: uid(), ...description, width: W, height: H, x: 0, y: 0,
    rgba: new Uint8ClampedArray(W * H * 4),
    stats: { pixelCount: 0, opaquePixelCount: 0, minX: W, minY: H, maxX: -1, maxY: -1 }
  }));
  const boundaries = new Uint8Array(w * h);
  if (W !== w || H !== h) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, k = labels[i];
      boundaries[i] = (x > 0 && labels[i - 1] !== k) || (x < w - 1 && labels[i + 1] !== k)
        || (y > 0 && labels[i - w] !== k) || (y < h - 1 && labels[i + w] !== k) ? 1 : 0;
    }
  }
  for (let y = 0; y < H; y++) {
    const fy = (y + .5) * h / H - .5, sy = clamp(Math.round(fy), 0, h - 1);
    for (let x = 0; x < W; x++) {
      const fx = (x + .5) * w / W - .5, sx = clamp(Math.round(fx), 0, w - 1), si = sy * w + sx;
      const p = (y * W + x) * 4;
      let label = labels[si];
      // Refine a low-resolution boundary with the original pixel color. Copying
      // the exact source pixel retains existing antialias and translucent edges.
      if (boundaries[si]) {
        let best = Infinity;
        for (let dy = -1; dy <= 1; dy++) {
          const iy = sy + dy; if (iy < 0 || iy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const ix = sx + dx; if (ix < 0 || ix >= w) continue;
            const ni = iy * w + ix, q = ni * 4;
            const da = source[p + 3] - sampled[q + 3];
            const score = distance2(source[p], source[p + 1], source[p + 2], sampled[q], sampled[q + 1], sampled[q + 2])
              + da * da * .2 + ((ix - fx) ** 2 + (iy - fy) ** 2) * 32;
            if (score < best) { best = score; label = labels[ni]; }
          }
        }
      }
      const layer = layers[label], out = layer.rgba, stats = layer.stats;
      out[p] = source[p]; out[p + 1] = source[p + 1]; out[p + 2] = source[p + 2]; out[p + 3] = source[p + 3];
      stats.pixelCount++;
      if (source[p + 3]) {
        stats.opaquePixelCount++;
        if (x < stats.minX) stats.minX = x; if (x > stats.maxX) stats.maxX = x;
        if (y < stats.minY) stats.minY = y; if (y > stats.maxY) stats.maxY = y;
      }
    }
    if (y % 48 === 0) { progress(65 + 33 * y / H, '生成透明图层'); await tick(); }
  }
  return layers.filter(layer => layer.stats.pixelCount > 0).map(layer => {
    const s = layer.stats;
    s.bounds = s.maxX >= 0 ? { x: s.minX, y: s.minY, width: s.maxX - s.minX + 1, height: s.maxY - s.minY + 1 }
      : { x: 0, y: 0, width: 0, height: 0 };
    s.coverage = s.opaquePixelCount / (W * H);
    delete s.minX; delete s.minY; delete s.maxX; delete s.maxY;
    return layer;
  });
}

export async function analyzeImage(imageData, options = {}, onProgress = () => {}) {
  validateImage(imageData);
  const startTime = globalThis.performance?.now?.() ?? Date.now();
  const progress = (value, stage) => onProgress({ progress: Math.round(value), stage });
  const mode = ['balanced', 'detail', 'subject'].includes(options.mode) ? options.mode : 'balanced';
  const tolerance = clamp(Number(options.tolerance) || 32, 8, 72);
  const memoryLimit = Math.max(2, Math.floor(150 * 1024 * 1024 / (imageData.width * imageData.height * 4)));
  const maxLayers = Math.min(clamp(Number(options.maxLayers) || (mode === 'detail' ? 10 : 7), 2, 12), memoryLimit);
  progress(3, '读取图片像素'); await tick();
  const small = downsample(imageData, clamp(Number(options.analysisSize) || 800, 320, 1000));
  const { width: w, height: h, data } = small, n = w * h;
  const analysis = {
    method: 'border-connected-regions', mode, confidence: 'medium', warnings: [],
    originalSize: { width: imageData.width, height: imageData.height }, analysisSize: { width: w, height: h },
    backgroundCoverage: 0, foregroundCoverage: 0, groupCount: 0, fallbackUsed: false,
    note: '基于颜色与连通区域拆分，图层为位图；不推断被遮挡内容。'
  };
  let labels, descriptions;
  if (options.strategy !== 'color') {
    progress(12, '采样画面边缘'); await tick();
    const palette = borderPalette(small);
    const bg = await backgroundMask(small, palette, tolerance, progress);
    analysis.backgroundCoverage = bg.count / n;
    analysis.foregroundCoverage = 1 - analysis.backgroundCoverage;
    analysis.confidence = palette.solid > .65 || palette.transparent > .65 ? 'high' : 'medium';
    const fg = new Uint8Array(n);
    let visibleForeground = 0;
    for (let i = 0; i < n; i++) if (!bg.mask[i] && data[i * 4 + 3] > 8) { fg[i] = 1; visibleForeground++; }
    if (visibleForeground < Math.max(5, n * .00004)) {
      labels = new Uint16Array(n); descriptions = [{ name: '原图', type: 'original' }];
      analysis.method = 'single-region'; analysis.confidence = 'low';
      analysis.warnings.push('未找到明显可分离的内容区域，已保留原图；可使用框选或魔棒手动拆分。');
    } else if (analysis.backgroundCoverage >= .035) {
      progress(31, '查找独立内容区域'); await tick();
      const components = await connectedGroups(fg, w, h, mode, progress);
      const grouped = groupComponents(components.groups, mode, Math.max(1, maxLayers - 2), n);
      if (grouped.clusters.length) {
        const componentLayer = new Int16Array(components.groups.length + 1); componentLayer.fill(-1);
        descriptions = [];
        grouped.clusters.forEach((group, index) => {
          group.members.forEach(id => { componentLayer[id] = index; });
          const isDetail = group.area / n < .018;
          descriptions.push({ name: `${isDetail ? '细节区域' : '主体区域'} ${String(index + 1).padStart(2, '0')}`, type: isDetail ? 'detail' : 'foreground' });
        });
        if (grouped.residual.length && descriptions.length < maxLayers - 1) {
          const residualIndex = descriptions.length;
          grouped.residual.forEach(id => { componentLayer[id] = residualIndex; });
          descriptions.push({ name: '零散细节', type: 'detail' });
        } else if (grouped.residual.length) {
          grouped.residual.forEach(id => { componentLayer[id] = 0; });
        }
        const bgIndex = descriptions.length;
        descriptions.push({ name: '背景底层', type: 'background' });
        labels = new Uint16Array(n);
        for (let i = 0; i < n; i++) {
          const k = fg[i] ? componentLayer[components.labels[i]] : -1;
          labels[i] = k >= 0 ? k : bgIndex;
        }
        if (palette.solid < .25 && palette.transparent < .25) {
          analysis.confidence = 'low';
          analysis.warnings.push('画面边缘颜色复杂，自动边界可能包含背景；可用魔棒或选区继续细分。');
        }
        if (grouped.clusters.length === 1 && !grouped.residual.length && mode !== 'subject') {
          analysis.warnings.push('主体内容相互连通，当前保留为同一图层；可用框选继续拆分。');
        }
      }
    }
  }
  if (!labels) {
    if (options.fallback === 'source' && options.strategy !== 'color') {
      labels = new Uint16Array(n); descriptions = [{ name: '原图', type: 'original' }];
      analysis.method = 'single-region';
      analysis.warnings.push('背景与主体边界不明显，已保留完整原图，请使用框选或魔棒拆分。');
    } else {
      const partition = await colorPartition(small, maxLayers, progress);
      labels = partition.labels; descriptions = partition.descriptions;
      analysis.method = 'color-regions';
      if (options.strategy !== 'color') {
        analysis.fallbackUsed = true;
        analysis.warnings.push('背景与主体边界不明显，已按实际色彩聚类拆分；这些色彩区域不代表物体或可编辑文字。');
      }
    }
    analysis.confidence = 'low';
  }
  progress(62, '细化原始分辨率边缘'); await tick();
  const layers = await materialize(imageData, small, labels, descriptions, progress);
  analysis.groupCount = layers.length;
  analysis.elapsedMs = Math.round((globalThis.performance?.now?.() ?? Date.now()) - startTime);
  analysis.pixelPerfectPartition = true;
  progress(100, '图层拆分完成');
  return { layers, analysis };
}

/** Select contiguous pixels similar to the clicked color, or all similar pixels. */
export function selectRegion(imageData, seedX, seedY, tolerance = 32, contiguous = true) {
  validateImage(imageData);
  const { width: w, height: h, data } = imageData, n = w * h;
  const x = clamp(Math.floor(seedX), 0, w - 1), y = clamp(Math.floor(seedY), 0, h - 1);
  const seed = y * w + x, p = seed * 4, r = data[p], g = data[p + 1], b = data[p + 2], a = data[p + 3];
  const threshold = clamp(Number(tolerance) || 32, 1, 128) ** 2;
  const mask = new Uint8Array(n);
  const matches = index => {
    const q = index * 4;
    if (a < 8) return data[q + 3] < 8;
    if (data[q + 3] < 8) return false;
    return distance2(r, g, b, data[q], data[q + 1], data[q + 2]) + .15 * (a - data[q + 3]) ** 2 <= threshold;
  };
  if (!contiguous) { for (let i = 0; i < n; i++) if (matches(i)) mask[i] = 1; return mask; }
  const queue = new Int32Array(n);
  let head = 0, tail = 1; queue[0] = seed; mask[seed] = 1;
  const push = i => { if (!mask[i] && matches(i)) { mask[i] = 1; queue[tail++] = i; } };
  while (head < tail) {
    const i = queue[head++], col = i % w;
    if (col > 0) push(i - 1); if (col < w - 1) push(i + 1);
    if (i >= w) push(i - w); if (i < n - w) push(i + w);
  }
  return mask;
}

/** Copy selected pixels to a transparent, full-size raster layer. */
export function maskToLayer(imageData, mask, metadata = {}) {
  validateImage(imageData);
  const { width, height, data } = imageData;
  if (!mask || mask.length !== width * height) throw new Error('选区尺寸与图片不一致。');
  const rgba = new Uint8ClampedArray(data.length);
  let count = 0, opaque = 0, minX = width, minY = height, maxX = -1, maxY = -1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const p = i * 4; rgba[p] = data[p]; rgba[p + 1] = data[p + 1]; rgba[p + 2] = data[p + 2]; rgba[p + 3] = data[p + 3]; count++;
    if (data[p + 3]) { opaque++; const x = i % width, y = (i / width) | 0; minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  }
  return {
    id: uid(), name: '手动选区', type: 'detail', ...metadata, width, height, x: 0, y: 0, rgba,
    stats: { pixelCount: count, opaquePixelCount: opaque, coverage: opaque / (width * height),
      bounds: maxX >= 0 ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } : { x: 0, y: 0, width: 0, height: 0 } }
  };
}
