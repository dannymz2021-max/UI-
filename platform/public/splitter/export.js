/**
 * UI工作室 file writers. Browser ES module with no network/dependencies.
 * A project is {width,height,layers,name?,originalName?}.
 * Layers are ordered TOP to BOTTOM and contain:
 * {id,name,type,width,height,x?,y?,rgba:Uint8ClampedArray,visible?,opacity?}.
 * Opacity is 0..1. Exported layers remain raster pixels, not vector/text objects.
 * Writers preserve hidden layers, names, offsets and opacity in project formats.
 */

const utf8 = new TextEncoder();
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bytesOf(text) { return utf8.encode(text); }
function concat(parts) {
  const out = new Uint8Array(parts.reduce((sum, value) => sum + value.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}

export function safeFilename(value, fallback = 'UIStudio') {
  return String(value || fallback).replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/\.+$/g, '').trim().slice(0, 100) || fallback;
}

function normalizeProject(project) {
  const {width, height} = project;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 30000 || height > 30000) {
    throw new Error('画布尺寸无效，支持 1–30000 像素。');
  }
  if (!Array.isArray(project.layers) || project.layers.length === 0 || project.layers.length > 32767) {
    throw new Error('请先创建至少一个图层。');
  }
  const layers = project.layers.map((layer, index) => {
    const w = layer.width ?? width, h = layer.height ?? height;
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1 || !layer.rgba || layer.rgba.length !== w * h * 4) {
      throw new Error(`图层 ${index + 1} 的像素数据不完整。`);
    }
    return {
      ...layer,
      width: w, height: h, x: Math.round(layer.x || 0), y: Math.round(layer.y || 0),
      name: String(layer.name || `图层 ${index + 1}`).slice(0, 200),
      visible: layer.visible !== false,
      opacity: Number.isFinite(layer.opacity) ? clamp(layer.opacity, 0, 1) : 1,
    };
  });
  return {...project, width, height, layers, name: String(project.name || 'UI工作室项目')};
}

/** Return merged straight-alpha RGBA pixels. Layers are ordered top-to-bottom. */
export function compositeLayers(project) {
  const {width, height, layers} = normalizeProject(project);
  const out = new Uint8ClampedArray(width * height * 4);
  for (let index = layers.length - 1; index >= 0; index--) {
    const layer = layers[index];
    if (!layer.visible || layer.opacity === 0) continue;
    const left = Math.max(0, layer.x), top = Math.max(0, layer.y);
    const right = Math.min(width, layer.x + layer.width), bottom = Math.min(height, layer.y + layer.height);
    for (let y = top; y < bottom; y++) {
      let src = ((y - layer.y) * layer.width + left - layer.x) * 4;
      let dst = (y * width + left) * 4;
      for (let x = left; x < right; x++, src += 4, dst += 4) {
        const sourceAlpha = layer.rgba[src + 3] / 255 * layer.opacity;
        if (sourceAlpha === 0) continue;
        if (sourceAlpha === 1) {
          out[dst] = layer.rgba[src]; out[dst + 1] = layer.rgba[src + 1];
          out[dst + 2] = layer.rgba[src + 2]; out[dst + 3] = 255;
          continue;
        }
        const baseAlpha = out[dst + 3] / 255;
        const alpha = sourceAlpha + baseAlpha * (1 - sourceAlpha);
        const baseWeight = baseAlpha * (1 - sourceAlpha);
        out[dst] = (layer.rgba[src] * sourceAlpha + out[dst] * baseWeight) / alpha;
        out[dst + 1] = (layer.rgba[src + 1] * sourceAlpha + out[dst + 1] * baseWeight) / alpha;
        out[dst + 2] = (layer.rgba[src + 2] * sourceAlpha + out[dst + 2] * baseWeight) / alpha;
        out[dst + 3] = alpha * 255;
      }
    }
  }
  return out;
}

function pngChunk(type, data) {
  const result = new Uint8Array(data.length + 12);
  const view = new DataView(result.buffer);
  view.setUint32(0, data.length);
  result.set(bytesOf(type), 4);
  result.set(data, 8);
  view.setUint32(data.length + 8, crc32(result.subarray(4, data.length + 8)));
  return result;
}

// Standards-compliant zlib/DEFLATE store blocks for browsers without CompressionStream.
function zlibStore(bytes) {
  const blocks = Math.max(1, Math.ceil(bytes.length / 65535));
  const out = new Uint8Array(2 + blocks * 5 + bytes.length + 4);
  out[0] = 0x78; out[1] = 0x01;
  let input = 0, output = 2, a = 1, b = 0;
  for (let block = 0; block < blocks; block++) {
    const size = Math.min(65535, bytes.length - input);
    out[output++] = block === blocks - 1 ? 1 : 0;
    out[output++] = size & 255; out[output++] = size >>> 8;
    const inverse = 65535 ^ size;
    out[output++] = inverse & 255; out[output++] = inverse >>> 8;
    out.set(bytes.subarray(input, input + size), output);
    for (let i = input; i < input + size; i++) { a = (a + bytes[i]) % 65521; b = (b + a) % 65521; }
    input += size; output += size;
  }
  new DataView(out.buffer).setUint32(output, ((b << 16) | a) >>> 0);
  return out;
}

/** Encode exact RGBA bytes as a genuine transparent PNG. No canvas re-sampling. */
export async function encodePng(width, height, rgba) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || rgba.length !== width * height * 4) {
    throw new Error('PNG 像素数据无效。');
  }
  const stride = width * 4;
  const scanlines = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1), src = y * stride;
    scanlines[row] = 1; // PNG SUB filter; compresses transparent areas and flat graphics well.
    for (let x = 0; x < stride; x++) scanlines[row + x + 1] = rgba[src + x] - (x >= 4 ? rgba[src + x - 4] : 0);
    if (y && y % 512 === 0) await pause();
  }
  let compressed;
  if (typeof CompressionStream === 'function') {
    const stream = new Blob([scanlines]).stream().pipeThrough(new CompressionStream('deflate'));
    compressed = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    compressed = zlibStore(scanlines);
  }
  const ihdr = new Uint8Array(13), view = new DataView(ihdr.buffer);
  view.setUint32(0, width); view.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 6; // 8 bit truecolor with alpha.
  return new Blob([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', new Uint8Array()),
  ], {type: 'image/png'});
}

export async function zipArchive(entries, type = 'application/zip') {
  const localParts = [], centralParts = [];
  let localOffset = 0, centralSize = 0;
  const now = new Date();
  const time = now.getHours() << 11 | now.getMinutes() << 5 | now.getSeconds() >> 1;
  const date = (clamp(now.getFullYear(), 1980, 2107) - 1980) << 9 | (now.getMonth() + 1) << 5 | now.getDate();
  for (const entry of entries) {
    const name = bytesOf(entry.name);
    const data = typeof entry.data === 'string' ? bytesOf(entry.data)
      : entry.data instanceof Blob ? new Uint8Array(await entry.data.arrayBuffer()) : entry.data;
    const crc = crc32(data);
    if (data.length > 0xffffffff || localOffset + data.length + 30 + name.length > 0xffffffff) throw new Error('文件过大，无法导出 ZIP。');
    const local = new Uint8Array(30 + name.length), lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); lv.setUint16(8, 0, true); // UTF-8, stored method.
    lv.setUint16(10, time, true); lv.setUint16(12, date, true); lv.setUint32(14, crc, true);
    lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true);
    lv.setUint16(26, name.length, true); local.set(name, 30);
    const central = new Uint8Array(46 + name.length), cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, time, true); cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true); cv.setUint32(42, localOffset, true); central.set(name, 46);
    localParts.push(local, data); centralParts.push(central);
    localOffset += local.length + data.length; centralSize += central.length;
    await pause();
  }
  const end = new Uint8Array(22), view = new DataView(end.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, entries.length, true); view.setUint16(10, entries.length, true);
  view.setUint32(12, centralSize, true); view.setUint32(16, localOffset, true);
  return new Blob([...localParts, ...centralParts, end], {type});
}

function progress(callback, percent, message) { callback?.(percent, message); }

/** ZIP: individual PNGs, a merged preview and a documented layer manifest. */
export async function buildLayerZip(input, onProgress) {
  const project = normalizeProject(input), entries = [], manifestLayers = [];
  for (let i = 0; i < project.layers.length; i++) {
    const layer = project.layers[i];
    const path = `layers/${String(i + 1).padStart(2, '0')}_${safeFilename(layer.name)}.png`;
    entries.push({name: path, data: await encodePng(layer.width, layer.height, layer.rgba)});
    manifestLayers.push({id: layer.id ?? `layer-${i + 1}`, name: layer.name, type: layer.type || 'raster', file: path,
      width: layer.width, height: layer.height, x: layer.x, y: layer.y, visible: layer.visible, opacity: layer.opacity});
    progress(onProgress, Math.round((i + 1) / (project.layers.length + 2) * 100), `正在导出图层 ${i + 1} / ${project.layers.length}`);
  }
  entries.push({name: 'preview.png', data: await encodePng(project.width, project.height, compositeLayers(project))});
  entries.push({name: 'manifest.json', data: JSON.stringify({format: 'LayerLab', version: 1, name: project.name,
    source: project.originalName || '', width: project.width, height: project.height, order: 'top-to-bottom',
    blendMode: 'normal', colorMode: 'RGBA 8-bit', layers: manifestLayers}, null, 2)});
  entries.push({name: '使用说明.txt', data: [
    'UI工作室图层导出包', '', `项目：${project.name}`, `工作画布：${project.width} × ${project.height} 像素`,
    `图层数量：${project.layers.length}`, '',
    'layers/：每个图层的透明 PNG，编号从顶层到底层排列。',
    'preview.png：按当前可见性与不透明度合成的预览。',
    'manifest.json：图层名称、位置、尺寸、可见性与不透明度。', '',
    '在 Photoshop 或 Figma 中导入 PNG 后，可依照编号顺序叠放。',
    '隐藏图层也会包含在导出包中；PNG 保留图层原始像素，不直接烘焙整体不透明度。',
    '图层是从图片中提取的栅格像素，不会恢复原始设计文件中的可编辑文字、矢量、特效或被遮挡内容。',
    '若图片在导入时为性能进行了缩放，导出使用显示的工作画布尺寸。',
  ].join('\n')});
  progress(onProgress, 92, '正在打包 ZIP');
  const result = await zipArchive(entries);
  progress(onProgress, 100, '导出完成');
  return result;
}

function xml(value) {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]));
}

/** OpenRaster archive. Standard stack.xml, transparent PNG layers and merged image. */
export async function buildOra(input, onProgress) {
  const project = normalizeProject(input);
  const entries = [{name: 'mimetype', data: 'image/openraster'}];
  const stack = [];
  for (let i = 0; i < project.layers.length; i++) {
    const layer = project.layers[i], path = `data/layer${String(i).padStart(3, '0')}.png`;
    entries.push({name: path, data: await encodePng(layer.width, layer.height, layer.rgba)});
    stack.push(`    <layer name="${xml(layer.name)}" src="${path}" x="${layer.x}" y="${layer.y}" opacity="${layer.opacity}" visibility="${layer.visible ? 'visible' : 'hidden'}" composite-op="svg:src-over"/>`);
    progress(onProgress, Math.round((i + 1) / (project.layers.length + 2) * 100), `正在写入图层 ${i + 1}`);
  }
  entries.push({name: 'stack.xml', data: `<?xml version="1.0" encoding="UTF-8"?>\n<image version="0.0.3" w="${project.width}" h="${project.height}" name="${xml(project.name)}" xres="72" yres="72">\n  <stack>\n${stack.join('\n')}\n  </stack>\n</image>\n`});
  const merged = compositeLayers(project);
  entries.push({name: 'mergedimage.png', data: await encodePng(project.width, project.height, merged)});
  // A thumbnail is optional, but helpful to common OpenRaster file pickers.
  const scale = Math.min(1, 256 / Math.max(project.width, project.height));
  const tw = Math.max(1, Math.round(project.width * scale)), th = Math.max(1, Math.round(project.height * scale));
  const thumb = new Uint8ClampedArray(tw * th * 4);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const source = (Math.min(project.height - 1, Math.floor(y / scale)) * project.width + Math.min(project.width - 1, Math.floor(x / scale))) * 4;
    thumb.set(merged.subarray(source, source + 4), (y * tw + x) * 4);
  }
  entries.push({name: 'Thumbnails/thumbnail.png', data: await encodePng(tw, th, thumb)});
  progress(onProgress, 92, '正在打包 OpenRaster');
  const result = await zipArchive(entries, 'image/openraster');
  progress(onProgress, 100, '导出完成');
  return result;
}

class BigEndianWriter {
  constructor(size) { this.bytes = new Uint8Array(size); this.view = new DataView(this.bytes.buffer); this.pos = 0; }
  u8(value) { this.bytes[this.pos++] = value; }
  u16(value) { this.view.setUint16(this.pos, value); this.pos += 2; }
  i16(value) { this.view.setInt16(this.pos, value); this.pos += 2; }
  u32(value) { this.view.setUint32(this.pos, value); this.pos += 4; }
  i32(value) { this.view.setInt32(this.pos, value); this.pos += 4; }
  text(value) { for (let i = 0; i < value.length; i++) this.u8(value.charCodeAt(i) & 255); }
  data(value) { this.bytes.set(value, this.pos); this.pos += value.length; }
  zeros(count) { this.pos += count; }
}

function u32(value) { const w = new BigEndianWriter(4); w.u32(value); return w.bytes; }

function psdLayerRecord(layer, index) {
  // The Pascal name is ASCII for old readers; luni stores the complete Unicode name.
  const legacyName = layer.name.replace(/[^\x20-\x7e]/g, '_').slice(0, 255) || `Layer ${index + 1}`;
  const pascalSize = Math.ceil((legacyName.length + 1) / 4) * 4;
  const unicodeCount = layer.name.length;
  const unicodeLength = 4 + unicodeCount * 2;
  const extraLength = 8 + pascalSize + 12 + unicodeLength + 16;
  const record = new BigEndianWriter(16 + 2 + 4 * 6 + 4 + 4 + 4 + 4 + extraLength);
  record.i32(layer.y); record.i32(layer.x); record.i32(layer.y + layer.height); record.i32(layer.x + layer.width);
  record.u16(4);
  for (const channel of [0, 1, 2, -1]) { record.i16(channel); record.u32(2 + layer.width * layer.height); }
  record.text('8BIM'); record.text('norm');
  record.u8(Math.round(layer.opacity * 255)); record.u8(0);
  record.u8(layer.visible ? 0 : 2); record.u8(0); // Flag bit 1 marks a hidden layer in PSD readers.
  record.u32(extraLength); record.u32(0); record.u32(0);
  record.u8(legacyName.length); record.text(legacyName); record.zeros(pascalSize - legacyName.length - 1);
  record.text('8BIM'); record.text('luni'); record.u32(unicodeLength); record.u32(unicodeCount);
  for (let i = 0; i < unicodeCount; i++) record.u16(layer.name.charCodeAt(i));
  record.text('8BIM'); record.text('lyid'); record.u32(4); record.u32(index + 1);
  return record.bytes;
}

function planarChannel(rgba, channel) {
  const result = new Uint8Array(rgba.length / 4);
  for (let p = 0, offset = channel; p < result.length; p++, offset += 4) result[p] = rgba[offset];
  return result;
}

/** Genuine PSD v1 with 8-bit raster RGBA layers and a compatibility composite. */
export async function buildPsd(input, onProgress) {
  const project = normalizeProject(input);
  // PSD serializes layers from the bottom upwards, opposite to our UI/ORA order.
  const psdLayers = [...project.layers].reverse();
  const layerRecords = psdLayers.map(psdLayerRecord);
  const layerDataLength = project.layers.reduce((total, layer) => total + 4 * (2 + layer.width * layer.height), 0);
  const rawInfoLength = 2 + layerRecords.reduce((total, record) => total + record.length, 0) + layerDataLength;
  const layerInfoLength = rawInfoLength + rawInfoLength % 2;
  const maskLength = 4 + layerInfoLength + 4;
  const totalLength = 26 + 4 + 4 + 4 + maskLength + 2 + project.width * project.height * 4;
  if (totalLength > 1_500_000_000) throw new Error('PSD 文件过大，请减少图层或缩小画布后重试。');
  const header = new BigEndianWriter(26 + 4 + 4 + 4 + 4 + 2);
  header.text('8BPS'); header.u16(1); header.zeros(6); header.u16(4);
  header.u32(project.height); header.u32(project.width); header.u16(8); header.u16(3);
  header.u32(0); header.u32(0); header.u32(maskLength); header.u32(layerInfoLength);
  header.i16(-project.layers.length); // Negative count identifies merged alpha as transparency.
  const parts = [header.bytes, ...layerRecords];
  for (let i = 0; i < psdLayers.length; i++) {
    const layer = psdLayers[i];
    for (const channel of [0, 1, 2, 3]) parts.push(new Uint8Array(2), planarChannel(layer.rgba, channel));
    progress(onProgress, Math.round((i + 1) / (project.layers.length + 1) * 88), `正在写入 PSD 图层 ${i + 1} / ${project.layers.length}`);
    await pause();
  }
  if (rawInfoLength % 2) parts.push(new Uint8Array(1));
  parts.push(u32(0)); // Empty global layer mask.
  parts.push(new Uint8Array(2)); // Raw compression for the merged composite.
  progress(onProgress, 90, '正在生成合成预览');
  const merged = compositeLayers({...project, layers: project.layers.map(layer => ({
    ...layer, opacity: Math.round(layer.opacity * 255) / 255,
  }))});
  // PSD's compatibility composite uses a white matte for partial alpha.
  // Layer channel data stays straight-alpha; PSD readers remove this matte only
  // from the merged preview. Using straight RGB here would darken that preview.
  for (let p = 0; p < merged.length; p += 4) {
    const alpha = merged[p + 3];
    if (alpha > 0 && alpha < 255) {
      const a = alpha / 255, white = 255 - alpha;
      merged[p] = merged[p] * a + white;
      merged[p + 1] = merged[p + 1] * a + white;
      merged[p + 2] = merged[p + 2] * a + white;
    }
  }
  for (const channel of [0, 1, 2, 3]) { parts.push(planarChannel(merged, channel)); await pause(); }
  const result = new Blob(parts, {type: 'image/vnd.adobe.photoshop'});
  progress(onProgress, 100, '导出完成');
  return result;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = safeFilename(filename); anchor.style.display = 'none';
  (document.querySelector('dialog[open]') || document.body).appendChild(anchor); anchor.click(); anchor.remove();
  // Keep the URL alive long enough for mobile browsers to start reading the file.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
