/** Shared presentation pass for the actual 3D render. Shadows and rim glow are
 * written into the output alpha, so PNG downloads match the editor exactly. */
const clamp = (value, low, high) => Math.max(low, Math.min(high, Number(value) || 0));

export function compositeArtwork(canvas, raw, opts = {}, palette = {}) {
  const width = opts.width || raw.width, height = opts.height || raw.height;
  const doc = canvas.ownerDocument || globalThis.document;
  const shadow = clamp(opts.shadow ?? 68, 0, 100) / 100;
  const glow = clamp(opts.glow ?? 28, 0, 100) / 100;
  const angle = clamp(opts.lightDirection ?? -35, -180, 180) * Math.PI / 180;
  const unit = Math.min(width, height) / 600;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建艺术字合成画布。');
  ctx.clearRect(0, 0, width, height);
  if (!opts.transparent) { ctx.fillStyle = opts.background || '#181025'; ctx.fillRect(0, 0, width, height); }
  // Tint only the already-rendered geometry silhouette, retaining holes and
  // per-object transparency. No rectangle/backplate is added to PNG outputs.
  const mask = doc.createElement('canvas'); mask.width = width; mask.height = height;
  const maskContext = mask.getContext('2d');
  maskContext.drawImage(raw, 0, 0, width, height);
  maskContext.globalCompositeOperation = 'source-in';
  if (glow > 0) {
    maskContext.fillStyle = palette.glow || palette.accent || '#6736ea';
    maskContext.fillRect(0, 0, width, height);
    ctx.save(); ctx.globalAlpha = glow * .35;
    ctx.filter = `blur(${Math.max(1, 18 * unit)}px)`; ctx.drawImage(mask, 0, 0); ctx.restore();
  }
  if (shadow > 0) {
    maskContext.fillStyle = '#060410'; maskContext.fillRect(0, 0, width, height);
    const dx = -Math.sin(angle), dy = Math.cos(angle);
    ctx.save();
    ctx.globalAlpha = shadow * .62; ctx.filter = `blur(${Math.max(.5, 11 * unit)}px)`;
    ctx.drawImage(mask, dx * 15 * unit, dy * 15 * unit);
    ctx.globalAlpha = shadow * .78; ctx.filter = `blur(${Math.max(.4, 2.5 * unit)}px)`;
    ctx.drawImage(mask, dx * 5 * unit, dy * 5 * unit);
    ctx.restore();
  }
  ctx.drawImage(raw, 0, 0, width, height);
  return { shadow: Math.round(shadow * 100), gloss: clamp(opts.gloss ?? 78, 0, 100), lightDirection: opts.lightDirection ?? -35 };
}
