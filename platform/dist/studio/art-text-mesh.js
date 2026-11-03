/** Convert the browser's actual font outlines into closed, beveled 3D meshes.
 * Rasterization is used only to discover outlines: the final render uses real
 * vertex geometry with front, back, sides, holes, normals and lighting. */
import * as THREE from './vendor/three.module.js';

const shapeCache = new Map();
const geometryCache = new Map();
let fontRevision = 0;
const FONT_SIZE = 256;
const GEOMETRY_SCALE = 160 / FONT_SIZE;

export function invalidateTextMeshes() {
  fontRevision++;
  shapeCache.clear();
  for (const geometry of geometryCache.values()) geometry.dispose();
  geometryCache.clear();
}

function signedArea(points) {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) area += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  return area / 2;
}

function pointInLoop(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function simplifyLine(points, epsilon = .7) {
  if (points.length < 4) return points;
  const [ax, ay] = points[0], [bx, by] = points[points.length - 1], dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
  let best = epsilon * epsilon, at = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i], t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
    const d = (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
    if (d > best) { best = d; at = i; }
  }
  return at < 0 ? [points[0], points[points.length - 1]] : [...simplifyLine(points.slice(0, at + 1), epsilon).slice(0, -1), ...simplifyLine(points.slice(at), epsilon)];
}

function simplifyLoop(points) {
  // Split a closed loop at opposite positions so simplification never compares
  // an identical start/end point and inadvertently removes its whole outline.
  const n = points.length, mid = Math.floor(n / 2);
  const reduced=[...simplifyLine(points.slice(0, mid + 1)).slice(0, -1), ...simplifyLine([...points.slice(mid), points[0]]).slice(0, -1)];
  // One corner-cutting pass removes pixel stair steps before the outline is
  // extruded. The contour remains closed and its real holes are preserved.
  return reduced.flatMap((a,i)=>{const b=reduced[(i+1)%reduced.length];return[[a[0]*.82+b[0]*.18,a[1]*.82+b[1]*.18],[a[0]*.18+b[0]*.82,a[1]*.18+b[1]*.82]];});
}

/** Trace oriented pixel-edge loops. Exported for deterministic topology checks. */
export function traceMaskLoops(alpha, width, height, threshold = 110) {
  const edges = new Map(), stride = width + 1;
  const solid = (x, y) => x >= 0 && y >= 0 && x < width && y < height && alpha[y * width + x] > threshold;
  const add = (x, y, dir) => {
    const key = y * stride + x;
    if (!edges.has(key)) edges.set(key, []);
    edges.get(key).push({ x, y, dir, used: false });
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (solid(x, y)) {
    if (!solid(x, y - 1)) add(x, y, 0);
    if (!solid(x + 1, y)) add(x + 1, y, 1);
    if (!solid(x, y + 1)) add(x + 1, y + 1, 2);
    if (!solid(x - 1, y)) add(x, y + 1, 3);
  }
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]], loops = [];
  for (const bucket of edges.values()) for (const start of bucket) {
    if (start.used) continue;
    const points = []; let edge = start;
    for (let guard = 0; edge && guard < width * height * 4; guard++) {
      edge.used = true; points.push([edge.x, edge.y]);
      const nextX = edge.x + directions[edge.dir][0], nextY = edge.y + directions[edge.dir][1];
      if (nextX === start.x && nextY === start.y) break;
      const candidates = (edges.get(nextY * stride + nextX) || []).filter(item => !item.used);
      const priority = [(edge.dir + 1) % 4, edge.dir, (edge.dir + 3) % 4, (edge.dir + 2) % 4];
      edge = candidates.sort((a, b) => priority.indexOf(a.dir) - priority.indexOf(b.dir))[0];
    }
    if (points.length >= 5 && Math.abs(signedArea(points)) > 2) loops.push(simplifyLoop(points));
  }
  return loops;
}

function contourPath(points, height, ShapeClass = THREE.Path, scale = 1) {
  const result = new ShapeClass();
  points.forEach(([x, y], i) => i ? result.lineTo(x * scale, (height - y) * scale) : result.moveTo(x * scale, (height - y) * scale));
  result.closePath();
  return result;
}

export function maskShapes(alpha, width, height, scale = 1) {
  const loops = traceMaskLoops(alpha, width, height);
  const outer = loops.filter(p => signedArea(p) > 0).map(points => ({ points, area: signedArea(points), shape: contourPath(points, height, THREE.Shape, scale) }));
  for (const hole of loops.filter(p => signedArea(p) < 0)) {
    const [x, y] = hole[0];
    const owner = outer.filter(o => pointInLoop(x, y, o.points)).sort((a, b) => a.area - b.area)[0];
    if (owner) owner.shape.holes.push(contourPath(hole, height, THREE.Path, scale));
  }
  return outer.map(o => o.shape);
}

export function getTextShape(text, font, doc = document, strokeWidth = 1.25) {
  const key = `${fontRevision}|${font}|${text}|${strokeWidth}`;
  if (shapeCache.has(key)) return shapeCache.get(key);
  const canvas = doc.createElement('canvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.font = font.replace(/\b\d+(?:\.\d+)?px\b/, FONT_SIZE + 'px');
  const metrics = ctx.measureText(text), pad = Math.ceil((16 + strokeWidth) / GEOMETRY_SCALE);
  const ascent=Math.max(1,metrics.actualBoundingBoxAscent||FONT_SIZE*1.2),descent=Math.max(0,metrics.actualBoundingBoxDescent||0),baseline=pad+ascent;
  canvas.width = Math.max(1, Math.ceil(Math.max(metrics.width, (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0))) + pad * 2);
  canvas.height = Math.ceil(ascent+descent) + pad * 2;
  ctx.font = font.replace(/\b\d+(?:\.\d+)?px\b/, FONT_SIZE + 'px');
  ctx.fillStyle = '#fff'; ctx.strokeStyle='#fff';ctx.lineWidth=strokeWidth / GEOMETRY_SCALE;ctx.lineJoin='round';ctx.textBaseline = 'alphabetic';
  ctx.strokeText(text, pad + Math.max(0, metrics.actualBoundingBoxLeft || 0), baseline);
  ctx.fillText(text, pad + Math.max(0, metrics.actualBoundingBoxLeft || 0), baseline);
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const alpha = new Uint8Array(canvas.width * canvas.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
  const data = { key, shapes: maskShapes(alpha, canvas.width, canvas.height, GEOMETRY_SCALE), width: canvas.width * GEOMETRY_SCALE, height: canvas.height * GEOMETRY_SCALE };
  shapeCache.set(key, data);
  if (shapeCache.size > 64) shapeCache.delete(shapeCache.keys().next().value);
  return data;
}

export function textGeometry(text, font, depth, bevel, doc = document, strokeWidth = 1.25, separateBevel = false) {
  const contours = getTextShape(text, font, doc, strokeWidth), key = `${contours.key}|${depth.toFixed(2)}|${bevel.toFixed(2)}|${separateBevel}`;
  if (geometryCache.has(key)) {
    const cached = geometryCache.get(key); geometryCache.delete(key); geometryCache.set(key, cached); return cached;
  }
  if (!contours.shapes.length) return null;
  const geometry = new THREE.ExtrudeGeometry(contours.shapes, {
    steps: 1, depth, bevelEnabled: true, bevelThickness: bevel * .85,
    bevelSize: bevel, bevelOffset: -Math.min(bevel * .14, .6), bevelSegments: separateBevel ? 5 : 3, curveSegments: 4,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox, cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2;
  geometry.translate(-cx, -cy, -depth / 2); geometry.computeBoundingBox();
  // Normalized planar UVs make the reflected studio bands continuous across
  // every letter, including the sides and real curved bevel faces.
  const positions = geometry.attributes.position, uv = new Float32Array(positions.count * 2);
  const bounds = geometry.boundingBox, width = bounds.max.x - bounds.min.x || 1, height = bounds.max.y - bounds.min.y || 1;
  for (let i = 0; i < positions.count; i++) { uv[i * 2] = (positions.getX(i) - bounds.min.x) / width; uv[i * 2 + 1] = (positions.getY(i) - bounds.min.y) / height; }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  if (separateBevel) {
    // Keep the broad, continuous front bevel distinct from the dark extrusion.
    // Three's default material group combines both surfaces, which makes a
    // polished word look like a flat gradient with a black outline.
    const originalGroups = [...geometry.groups]; geometry.clearGroups();
    for (const group of originalGroups) {
      let runStart = group.start, runMaterial = -1;
      for (let i = group.start; i < group.start + group.count; i += 3) {
        const z = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
        const materialIndex = group.materialIndex === 1 && z >= depth / 2 - .01 ? 2 : group.materialIndex;
        if (runMaterial !== -1 && materialIndex !== runMaterial) { geometry.addGroup(runStart, i - runStart, runMaterial); runStart = i; }
        runMaterial = materialIndex;
      }
      geometry.addGroup(runStart, group.start + group.count - runStart, runMaterial);
    }
  }
  smoothGeometryNormals(geometry);geometry.userData.persistentText = true;
  geometryCache.set(key, geometry);
  if (geometryCache.size > 42) { const first = geometryCache.keys().next().value; geometryCache.get(first).dispose(); geometryCache.delete(first); }
  return geometry;
}

/** Smooth the actual shared bevel vertices while retaining the real mesh body. */
export function smoothGeometryNormals(geometry) {
  const positions=geometry.attributes.position,normals=geometry.attributes.normal;
  if(!positions||!normals)return geometry;
  const sums=new Map(),keys=new Array(positions.count);
  for(let i=0;i<positions.count;i++){
    const key=`${Math.round(positions.getX(i)*1000)},${Math.round(positions.getY(i)*1000)},${Math.round(positions.getZ(i)*1000)}`;keys[i]=key;
    let value=sums.get(key);if(!value){value=[0,0,0];sums.set(key,value);}value[0]+=normals.getX(i);value[1]+=normals.getY(i);value[2]+=normals.getZ(i);
  }
  for(let i=0;i<positions.count;i++){const value=sums.get(keys[i]),length=Math.hypot(...value)||1;normals.setXYZ(i,value[0]/length,value[1]/length,value[2]/length);}
  normals.needsUpdate=true;return geometry;
}
