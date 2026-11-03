import { readableText } from './design-system.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeImage = value => /^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(String(value || '')) ? value : '';
const number = (value, fallback) => Number.isFinite(parseFloat(value)) ? parseFloat(value) : fallback;
let projectFontPromise = null, embeddedFontCSS = '', fontLicense = '';

/** Same-origin font bytes are cached in memory and embedded in standalone exports. */
export function loadProjectFonts() {
  if (projectFontPromise) return projectFontPromise;
  if (typeof document === 'undefined') return Promise.resolve();
  projectFontPromise = (async () => {
    if (!document.querySelector('link[data-layerlab-poppins]')) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/studio/fonts/poppins.css'; link.dataset.layerlabPoppins = ''; document.head.append(link); }
    const files = [['/studio/fonts/Poppins-Regular.ttf', '400'], ['/studio/fonts/Poppins-SemiBold.ttf', '600']];
    const faces = await Promise.all(files.map(async ([path, weight]) => {
      const response = await fetch(path, { credentials: 'same-origin' }); if (!response.ok) throw new Error('Poppins 字体暂时无法加载。');
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > 2 * 1024 * 1024) throw new Error('字体文件超过预期大小。');
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('字体读取失败。')); reader.readAsDataURL(new Blob([buffer], { type: 'font/ttf' })); });
      if (typeof FontFace !== 'undefined') { const face = new FontFace('Poppins', buffer, { weight, style: 'normal' }); await face.load(); document.fonts.add(face); }
      return `@font-face{font-family:Poppins;font-style:normal;font-weight:${weight};font-display:swap;src:url("${dataUrl}") format("truetype");}`;
    }));
    const licenseResponse = await fetch('/studio/fonts/Poppins-OFL.txt', { credentials: 'same-origin' });
    fontLicense = licenseResponse.ok ? await licenseResponse.text() : 'Poppins — SIL Open Font License 1.1. See the bundled Poppins-OFL.txt.';
    embeddedFontCSS = faces.join('');
    await document.fonts?.ready;
  })();
  return projectFontPromise;
}

function rgb(color) {
  const hex = String(color).match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (hex) { const h = hex[1].length === 3 ? hex[1].split('').map(c => c + c).join('') : hex[1]; return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
  const match = String(color).match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/i);
  return match ? match.slice(1, 4).map(Number) : [35, 57, 44];
}
export function mix(a, b, ratio) { const aa = rgb(a), bb = rgb(b); return '#' + aa.map((v, i) => Math.round(v * (1 - ratio) + bb[i] * ratio).toString(16).padStart(2, '0')).join(''); }

export const TEMPLATE_DEFAULTS = {
  sports: {
    es: { title: 'Tu próxima gran jugada comienza aquí.', subtitle: 'El deporte que te mueve, en un solo lugar.', buttonLabel: 'Explorar partidos', cards: [{ title: 'América vs. Monterrey', subtitle: 'Liga MX · Hoy, 20:00', tag: 'EN VIVO' }, { title: 'Lakers vs. Celtics', subtitle: 'NBA · Hoy, 21:30', tag: 'DESTACADO' }, { title: 'Real Madrid vs. Barcelona', subtitle: 'La Liga · Mañana, 18:00', tag: 'PRÓXIMAMENTE' }] },
    en: { title: 'Your next great game starts here.', subtitle: 'The sports that move you. All in one place.', buttonLabel: 'Explore matches', cards: [{ title: 'América vs. Monterrey', subtitle: 'Liga MX · Today, 20:00', tag: 'LIVE' }, { title: 'Lakers vs. Celtics', subtitle: 'NBA · Today, 21:30', tag: 'FEATURED' }, { title: 'Real Madrid vs. Barcelona', subtitle: 'La Liga · Tomorrow, 18:00', tag: 'UP NEXT' }] },
  },
  promotions: {
    es: { title: 'Más momentos. Más posibilidades.', subtitle: 'Encuentra una promoción para tu manera de jugar.', buttonLabel: 'Ver promociones', cards: [{ title: 'Una gran bienvenida', subtitle: 'Descubre lo que hemos preparado para tu primera visita.', tag: 'BIENVENIDA' }, { title: 'La emoción del partido', subtitle: 'Explora las promociones de tus deportes favoritos.', tag: 'DEPORTES' }, { title: 'Tu próxima sorpresa', subtitle: 'Nuevas experiencias para descubrir cada semana.', tag: 'CASINO' }] },
    en: { title: 'More moments. More possibilities.', subtitle: 'Discover a promotion for the way you play.', buttonLabel: 'View promotions', cards: [{ title: 'A warm welcome', subtitle: 'Discover what we have prepared for your first visit.', tag: 'WELCOME' }, { title: 'Game-day excitement', subtitle: 'Explore promotions for the sports you love.', tag: 'SPORTS' }, { title: 'Your next surprise', subtitle: 'New experiences to explore every week.', tag: 'CASINO' }] },
  },
  vip: {
    es: { title: 'Una experiencia a tu altura.', subtitle: 'Descubre los detalles que hacen la diferencia.', buttonLabel: 'Explorar beneficios', cards: [{ title: 'Atención personal', subtitle: 'Una experiencia que comienza por escucharte.', tag: '01' }, { title: 'Momentos exclusivos', subtitle: 'Descubre experiencias seleccionadas para ti.', tag: '02' }, { title: 'Cada detalle cuenta', subtitle: 'Conoce los beneficios de cada nivel.', tag: '03' }] },
    en: { title: 'An experience on your level.', subtitle: 'Discover the details that make the difference.', buttonLabel: 'Explore benefits', cards: [{ title: 'Personal attention', subtitle: 'An experience that starts with listening.', tag: '01' }, { title: 'Exclusive moments', subtitle: 'Discover experiences selected for you.', tag: '02' }, { title: 'Every detail matters', subtitle: 'Explore the benefits of each tier.', tag: '03' }] },
  },
  welcome: {
    es: { title: 'Tu bienvenida empieza aquí.', subtitle: 'Descubre los beneficios disponibles y sigue tu progreso en un solo lugar.', buttonLabel: 'Ver mi progreso', cards: [{ title: 'Giros de bienvenida', subtitle: 'Revisa los detalles de tu primera recompensa.', tag: 'PASO 1' }, { title: 'Tu siguiente beneficio', subtitle: 'Consulta los requisitos y avanza a tu ritmo.', tag: 'PASO 2' }, { title: 'Una experiencia más completa', subtitle: 'Encuentra el siguiente paso de tu bienvenida.', tag: 'PASO 3' }] },
    en: { title: 'Your welcome starts here.', subtitle: 'Discover available benefits and follow your progress in one place.', buttonLabel: 'View my progress', cards: [{ title: 'Welcome spins', subtitle: 'Explore the details of your first reward.', tag: 'STEP 1' }, { title: 'Your next benefit', subtitle: 'Review the requirements and move at your pace.', tag: 'STEP 2' }, { title: 'A fuller experience', subtitle: 'Discover the next step in your welcome journey.', tag: 'STEP 3' }] },
  },
};

export function defaultPageConfig(template = 'sports', language = 'es') {
  const selected = TEMPLATE_DEFAULTS[template] || TEMPLATE_DEFAULTS.sports;
  return { template, language, brand: 'MEGWIN', ...structuredClone(selected[language] || selected.es), sections: { hero: true, cards: true, supporting: true, footer: true }, heroImage: '', stepImage: '', device: 'desktop' };
}

let measureContext;
function textWidth(text, size, weight = 400, fontFamily = 'Arial, sans-serif') {
  if (!measureContext && typeof document !== 'undefined') measureContext = document.createElement('canvas').getContext('2d');
  if (measureContext) { measureContext.font = `${weight} ${size}px ${fontFamily}`; return measureContext.measureText(text).width; }
  return [...text].reduce((n, c) => n + (/[\u2e80-\uffff]/.test(c) ? 1 : /[WMOQ@#%]/.test(c) ? .8 : /[il.,'!:;| ]/.test(c) ? .28 : /[A-Z]/.test(c) ? .64 : .53), 0) * size * 1.12;
}
function wrap(text, width, size, maxLines = 3, weight = 400, fontFamily) {
  const lines = [];
  for (const paragraph of String(text).split('\n')) {
    const words = /[\u2e80-\uffff]/.test(paragraph) ? [...paragraph] : paragraph.split(/\s+/);
    const separator = /[\u2e80-\uffff]/.test(paragraph) ? '' : ' ';
    let line = '';
    for (const word of words) {
      const next = line ? line + separator + word : word;
      if (line && textWidth(next, size, weight, fontFamily) > width) { lines.push(line); line = word; } else line = next;
    }
    if (line || !lines.length) lines.push(line);
  }
  if (lines.length > maxLines) { lines.length = maxLines; let last = lines.at(-1); while (last.length && textWidth(last + '…', size, weight, fontFamily) > width) last = last.slice(0, -1); lines[maxLines - 1] = last + '…'; }
  return lines;
}

function makeModel(width, height, values, config) {
  const nodes = [], radius = Math.max(0, Math.min(40, number(values.radius, 16)));
  const rect = (x, y, w, h, fill, r = radius, stroke = null, extra = {}) => nodes.push({ kind: 'rect', x, y, w, h, fill, radius: r, stroke, ...extra });
  const circle = (cx, cy, r, fill, stroke = null, extra = {}) => nodes.push({ kind: 'circle', cx, cy, r, fill, stroke, ...extra });
  const path = (d, fill, stroke = null, strokeWidth = 1, extra = {}) => nodes.push({ kind: 'path', d, fill, stroke, strokeWidth, ...extra });
  const text = (value, x, y, w, size = 16, fill = values.text, weight = 400, maxLines = 3, extra = {}) => {
    const lines = wrap(value, w, size, maxLines, weight, values.fontFamily), lineHeight = size * (extra.lineHeight || 1.3);
    nodes.push({ kind: 'text', text: lines.join('\n'), lines, x, y, w, h: lines.length * lineHeight, size, fill, weight, ...extra, lineHeight });
  };
  const button = (value, x, y, w, h, fill = values.primary, fg = readableText(fill), outline = false, extra = {}) => nodes.push({ kind: 'button', text: value, x, y, w, h, fill, fg, size: Math.min(13, (w - 20) / Math.max(1, textWidth(value, 1, 600, values.fontFamily))), radius: Math.min(radius, h / 2), outline, ...extra });
  const image = (href, x, y, w, h, r = radius, fit = 'cover') => { if (safeImage(href)) nodes.push({ kind: 'image', href, x, y, w, h, radius: r, fit }); };
  return { width, height, values, config, nodes, rect, circle, path, text, button, image };
}

function polygon(points) { return 'M' + points.map(p => p.join(',')).join('L') + 'Z'; }
function star(cx, cy, r, inner = r * .45, points = 5) { return polygon(Array.from({ length: points * 2 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / points, rr = i % 2 ? inner : r; return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; })); }
function ball(model, cx, cy, r, color) {
  const { circle, path } = model;
  circle(cx + r * .12, cy + r * .16, r * 1.02, mix(model.values.background, color, .2));
  circle(cx, cy, r, '#e6eedc');
  circle(cx - r * .28, cy - r * .3, r * .58, '#f3f6eb');
  const pentagon = (x, y, size, angle = -Math.PI / 2) => polygon(Array.from({ length: 5 }, (_, i) => [x + Math.cos(angle + i * Math.PI * .4) * size, y + Math.sin(angle + i * Math.PI * .4) * size]));
  path(pentagon(cx, cy, r * .32), '#203a30');
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * Math.PI * .4;
    const x = cx + Math.cos(a) * r * .73, y = cy + Math.sin(a) * r * .73;
    path(`M${cx + Math.cos(a) * r * .32},${cy + Math.sin(a) * r * .32}L${x},${y}`, 'none', '#93aa93', r * .018);
    path(pentagon(x, y, r * .2, a + Math.PI), '#294b3b');
  }
  circle(cx - r * .85, cy + r * .73, r * .08, color);
  path(star(cx + r * 1.15, cy - r * .8, r * .13, r * .075, 4), color);
}
function medal(model, cx, cy, r, color) {
  const { circle, path } = model;
  path(polygon([[cx - r * .65, cy + r * .3], [cx - r * .85, cy + r * 1.35], [cx - r * .15, cy + r * 1.1], [cx + r * .18, cy + r * .48]]), mix(color, '#111a17', .25));
  path(polygon([[cx + r * .25, cy + r * .35], [cx + r * .7, cy + r * 1.3], [cx + r * .9, cy + r * .8], [cx + r * .65, cy + r * .1]]), color);
  circle(cx + 5, cy + 8, r, mix(color, '#111a17', .36)); circle(cx, cy, r, color);
  circle(cx, cy, r * .79, mix(color, '#ffffff', .13), mix(color, '#111a17', .3), { strokeWidth: 2 });
  path(star(cx, cy - 2, r * .48), mix(color, '#111a17', .65));
  path(star(cx - r * 1.24, cy - r * .72, r * .16, r * .08, 4), color);
  path(star(cx + r * 1.3, cy + r * .36, r * .1, r * .05, 4), color);
}
function gift(model, cx, cy, r, color) {
  const { rect, path, circle } = model;
  const dark = mix(color, '#111a17', .25), pale = mix(color, '#ffffff', .4);
  rect(cx - r * .8, cy - r * .18, r * 1.6, r * 1.13, dark, r * .1);
  rect(cx - r * .9, cy - r * .42, r * 1.8, r * .38, color, r * .08);
  rect(cx - r * .14, cy - r * .41, r * .28, r * 1.36, pale, 0);
  path(`M${cx},${cy-r*.4}C${cx-r*1.2},${cy-r*1.2} ${cx-r*.52},${cy-r*1.48} ${cx},${cy-r*.4}`, 'none', pale, r * .13);
  path(`M${cx},${cy-r*.4}C${cx+r*1.2},${cy-r*1.2} ${cx+r*.52},${cy-r*1.48} ${cx},${cy-r*.4}`, 'none', pale, r * .13);
  circle(cx - r * 1.2, cy + r * .3, r * .08, color);
  path(star(cx + r * 1.2, cy - r * .7, r * .15, r * .08, 4), color);
}

const LABELS = {
  es: { sports: 'Deportes', casino: 'Casino', live: 'En vivo', promotions: 'Promociones', vip: 'VIP', login: 'Iniciar sesión', join: 'Regístrate', football: 'Fútbol', basketball: 'Baloncesto', tennis: 'Tenis', more: 'Más deportes', popular: 'LIGAS POPULARES', featured: 'Lo que está pasando', offers: 'Hechas para ti', benefits: 'Cada detalle suma', explore: 'Explorar', today: 'Hoy', all: 'Todos', quick: 'Todo lo que te mueve', quickCopy: 'Elige tu siguiente experiencia.', favourites: 'Favoritos', upcoming: 'Próximos', footer: '18+ · Juega con responsabilidad.', footerLinks: 'Ayuda    Términos    Privacidad', back: 'Volver a promociones' },
  en: { sports: 'Sports', casino: 'Casino', live: 'Live', promotions: 'Promotions', vip: 'VIP', login: 'Log in', join: 'Sign up', football: 'Football', basketball: 'Basketball', tennis: 'Tennis', more: 'More sports', popular: 'POPULAR LEAGUES', featured: 'Happening now', offers: 'Made for you', benefits: 'Every detail adds up', explore: 'Explore', today: 'Today', all: 'All', quick: 'Everything that moves you', quickCopy: 'Choose your next experience.', favourites: 'Favourites', upcoming: 'Upcoming', footer: '18+ · Play responsibly.', footerLinks: 'Help    Terms    Privacy', back: 'Back to promotions' },
};

export function createPageModel(config, values, device = 'desktop') {
  const mobile = device === 'mobile', W = mobile ? 390 : 1440;
  const labels = LABELS[config.language] || LABELS.es, template = config.template || 'sports';
  const sections = { hero: true, cards: true, supporting: true, footer: true, ...config.sections };
  const cards = (config.cards || []).slice(0, 6), spacing = Math.max(8, Math.min(40, number(values.spacing, 24)));
  const m = makeModel(W, 1100, values, config), { rect, circle, text, button, path, image } = m;
  const primaryText = readableText(values.primary), heroFill = values.surface;
  const hasSidebar = ['sports', 'welcome'].includes(template);
  const margin = mobile ? 20 : template === 'welcome' ? 12 : 36, mainX = !mobile && hasSidebar ? (template === 'welcome' ? 276 : 252) : margin;
  const mainW = W - mainX - margin, gap = mobile ? 14 : spacing;
  rect(0, 0, W, mobile ? 68 : 84, values.surface, 0);
  text(config.brand || 'MEGWIN', mobile ? 20 : 34, mobile ? 21 : 25, 170, mobile ? 22 : 27, values.primary, 900, 1, { letterSpacing: 1, tag: 'strong' });
  if (mobile) { button(labels.login, 235, 18, 91, 34, values.surface, values.text, true); path('M346 26H363M346 33H363M346 40H363', 'none', values.text, 1.5); }
  else {
    [labels.sports, labels.casino, labels.live, labels.promotions, labels.vip].forEach((label, i) => text(label, 266 + i * 127, 34, 116, 15, (template === 'sports' && i === 0) || (template === 'promotions' && i === 3) || (template === 'vip' && i === 4) ? values.primary : values.muted, 600, 1, { tag: 'nav' }));
    button(labels.login, 1122, 23, 130, 39, values.surface, values.text, true); button(labels.join, 1266, 23, 137, 39);
  }
  if (!mobile && hasSidebar) {
    const sidebarW = template === 'welcome' ? 252 : 220;
    rect(0, 85, sidebarW, 1000, values.background, 0); rect(sidebarW - 1, 85, 1, 1000, values.border, 0);
    const nav = [[labels.sports, '◉'], [labels.live, '◌'], [labels.favourites, '☆'], [labels.upcoming, '▤']];
    nav.forEach(([label], i) => { if (i === 0) rect(18, 111 + i * 49, 184, 42, mix(values.surface, values.primary, .13), 9); circle(39, 131 + i * 49, 6, 'none', i === 0 ? values.primary : values.muted); if (i === 0) circle(39, 131, 2.5, values.primary); text(label, 67, 122 + i * 49, 125, 14, i === 0 ? values.text : values.muted, 500, 1); });
    text(labels.popular, 29, 344, 165, 10, values.muted, 600, 1, { letterSpacing: 1.5 });
    ['Liga MX', 'Premier League', 'La Liga', 'NBA', 'NFL'].forEach((label, i) => { circle(38, 393 + i * 47, 5, i % 2 ? '#af9ad7' : values.primary); text(label, 61, 384 + i * 47, 130, 13, values.muted, 500, 1); });
    rect(20, 702, 180, 132, values.surface, 14); text('MEGWIN CLUB', 35, 721, 150, 11, values.primary, 700, 1); text(config.language === 'en' ? 'A place for every fan.' : 'Un lugar para cada fan.', 35, 749, 146, 18, values.text, 650, 2); text(labels.explore, 35, 802, 146, 12, values.muted, 600, 1);
  }
  let y = mobile ? 88 : 116;
  if (template === 'sports') {
    const categories = [labels.football, labels.basketball, labels.tennis, labels.more];
    categories.forEach((label, i) => {
      const x = mainX + i * (mobile ? 99 : 150), w = mobile ? 91 : 136;
      if (mobile && i === 3) return;
      rect(x, y, w, mobile ? 35 : 40, i === 0 ? values.primary : values.surface, 20);
      text(label, x, y + (mobile ? 10 : 12), w, mobile ? 11 : 13, i === 0 ? primaryText : values.muted, 600, 1, { align: 'center' });
    }); y += mobile ? 51 : 62;
  } else if (template === 'vip' || template === 'welcome') { text(labels.back, mainX, y + 2, mainW, 13, values.muted, 500, 1); y += 37; }
  if (sections.hero && template === 'welcome') {
    const heroH = mobile ? 380 : 210, px = mobile ? 23 : 40;
    rect(mainX, y, mainW, heroH, values.surface, 16);
    text(config.title, mainX + px, y + (mobile ? 25 : 32), mobile ? mainW - 46 : mainW - 330, mobile ? 28 : 32, values.text, 600, mobile ? 2 : 1, { lineHeight: 1.25, tag: 'h1' });
    text(config.subtitle, mainX + px, y + (mobile ? 105 : 85), mobile ? mainW - 46 : mainW - 330, 14, values.muted, 400, 2, { lineHeight: 20 / 14 });
    button(config.buttonLabel, mainX + px, y + (mobile ? 164 : 145), 184, 40, values.text, values.background, false, { radius: 8 });
    if (safeImage(config.heroImage)) image(config.heroImage, mobile ? mainX + 154 : mainX + mainW - 255, mobile ? y + 214 : y + 15, mobile ? 171 : 180, mobile ? 154 : 180, 0, 'contain');
    else medal(m, mobile ? mainX + 260 : mainX + mainW - 151, mobile ? y + 285 : y + 95, mobile ? 53 : 63, values.primary);
    if (mobile) text('MEGWIN\nWELCOME', mainX + 23, y + 255, 145, 22, mix(values.text, values.surface, .4), 600, 2, { lineHeight: 1.15 });
    y += heroH + (mobile ? 26 : 24);
  }
  if (sections.hero && template !== 'welcome') {
    const heroH = mobile ? 440 : 320;
    rect(mainX, y, mainW, heroH, heroFill, Math.max(12, number(values.radius, 16)));
    const textX = mainX + (mobile ? 23 : 42), textW = mobile ? mainW - 46 : mainW * .57;
    text(template === 'vip' ? 'MEGWIN VIP' : template === 'promotions' ? (config.language === 'en' ? 'A LITTLE MORE, EVERY DAY' : 'UN POCO MÁS, CADA DÍA') : 'EL JUEGO NOS UNE', textX, y + (mobile ? 25 : 33), textW, mobile ? 9 : 11, values.primary, 700, 1, { letterSpacing: 1.8 });
    text(config.title, textX, y + (mobile ? 54 : 70), textW, mobile ? 30 : 32, values.text, 600, mobile ? 3 : 2, { lineHeight: 1.25, tag: 'h1' });
    text(config.subtitle, textX, y + (mobile ? 172 : 180), textW, 14, mix(values.text, values.background, .16), 400, 2, { lineHeight: 20 / 14 });
    button(config.buttonLabel, textX, y + (mobile ? 216 : 245), mobile ? 185 : 218, mobile ? 41 : 44);
    if (safeImage(config.heroImage)) image(config.heroImage, mobile ? mainX + 116 : mainX + mainW * .65, mobile ? y + 271 : y + 28, mobile ? 206 : mainW * .32 - 16, mobile ? 151 : heroH - 56, Math.max(8, number(values.radius, 16)), config.projectArtworkApplied ? 'contain' : 'cover');
    else {
      const cx = mobile ? mainX + 244 : mainX + mainW * .82, cy = mobile ? y + 345 : y + 161, r = mobile ? 68 : 105;
      circle(cx, cy, r * 1.25, mix(heroFill, values.primary, .09));
      if (template === 'vip') medal(m, cx, cy - 7, r * .77, values.primary);
      else if (template === 'promotions') gift(m, cx, cy + 7, r * .8, values.primary);
      else ball(m, cx, cy, r, values.primary);
      if (mobile) { text(template === 'sports' ? 'GAME\nON.' : template === 'vip' ? 'YOUR\nLEVEL.' : 'MORE\nFOR YOU.', mainX + 24, y + 303, 150, 26, mix(values.primary, heroFill, .4), 800, 2, { lineHeight: 1.05 }); }
    }
    y += heroH + (mobile ? 31 : 36);
  }
  if (sections.cards && cards.length) {
    text(template === 'sports' ? labels.featured : template === 'vip' ? labels.benefits : template === 'welcome' ? (config.language === 'en' ? 'Three steps. Your pace.' : 'Tres pasos. A tu ritmo.') : labels.offers, mainX, y, mainW - (mobile ? 0 : 110), mobile ? 21 : 24, values.text, 600, 2, { tag: 'h2' });
    if (!mobile) text(labels.explore, W - margin - 110, y + 7, 110, 13, values.primary, 600, 1, { align: 'right' });
    y += mobile ? 42 : 51;
    if (template === 'promotions') {
      [labels.all, labels.sports, labels.casino, labels.vip].forEach((label, i) => { const ww = mobile ? [64, 87, 80, 63][i] : 110, x = mainX + (mobile ? [0, 72, 167, 255][i] : i * 122); rect(x, y, ww, 34, i ? values.surface : values.primary, 17); text(label, x, y + 9, ww, 12, i ? values.muted : primaryText, 600, 1, { align: 'center' }); }); y += 54;
    }
    const columns = mobile ? 1 : 3, cardW = (mainW - gap * (columns - 1)) / columns;
    const cardH = template === 'sports' ? (mobile ? 181 : 205) : template === 'vip' ? (mobile ? 202 : 255) : template === 'welcome' ? 255 : (mobile ? 310 : 338);
    cards.forEach((card, index) => {
      const x = mainX + index % columns * (cardW + gap), yy = y + Math.floor(index / columns) * (cardH + gap);
      rect(x, yy, cardW, cardH, values.surface, number(values.radius, 16), values.border);
      const tag = String(card.tag || String(index + 1).padStart(2, '0'));
      if (template === 'welcome') {
        const stepSurface = mix(values.surface, values.border, .45);
        rect(x, yy, cardW, cardH, stepSurface, 16);
        text(tag, x + 18, yy + 16, cardW - 36, 12, values.primary, 400, 1);
        if (index === 0 && safeImage(config.stepImage)) image(config.stepImage, x + (cardW - 157) / 2, yy + 31, 157, 157, 0, 'contain');
        else if (index % 3 === 1) gift(m, x + cardW / 2, yy + 112, 45, values.primary);
        else medal(m, x + cardW / 2, yy + 102, 40, values.primary);
        text(card.title, x + 16, yy + 187, cardW - 32, 16, values.text, 600, 1, { lineHeight: 1.5, align: 'center' });
        text(card.subtitle, x + 16, yy + 216, cardW - 32, 14, values.muted, 400, 2, { lineHeight: 20 / 14, align: 'center' });
      } else if (template === 'sports') {
        text(card.subtitle, x + 18, yy + 17, cardW - 92, 10, values.muted, 500, 1);
        rect(x + cardW - 70, yy + 14, 53, 21, mix(values.surface, values.primary, .15), 5); text(index === 0 ? labels.live.toUpperCase() : labels.today.toUpperCase(), x + cardW - 70, yy + 20, 53, 8, values.primary, 700, 1, { align: 'center' });
        const teams = String(card.title).split(/\s+(?:vs\.?|v\.?|—)\s+/i), left = teams[0] || card.title, right = teams[1] || (config.language === 'en' ? 'Away team' : 'Visitante');
        circle(x + 32, yy + 67, 13, mix(values.primary, values.surface, .35)); text(left.slice(0, 1), x + 20, yy + 61, 24, 11, values.text, 700, 1, { align: 'center' }); text(left, x + 54, yy + 58, cardW - 98, mobile ? 13 : 14, values.text, 650, 1);
        circle(x + 32, yy + 105, 13, mix('#b6a2df', values.surface, .35)); text(right.slice(0, 1), x + 20, yy + 99, 24, 11, values.text, 700, 1, { align: 'center' }); text(right, x + 54, yy + 96, cardW - 98, mobile ? 13 : 14, values.text, 650, 1);
        ['1.85', '3.20', '2.40'].forEach((odd, i) => { const ow = (cardW - 48) / 3, ox = x + 16 + i * (ow + 8), oy = yy + cardH - 49; rect(ox, oy, ow, 33, mix(values.background, values.surface, .35), 7); text(['1', 'X', '2'][i], ox + 9, oy + 10, 16, 10, values.muted, 500, 1); text(odd, ox + 28, oy + 9, ow - 37, 12, values.text, 650, 1, { align: 'right' }); });
      } else if (template === 'vip') {
        rect(x + 21, yy + 21, 43, 43, mix(values.surface, values.primary, .15), 12); text(tag, x + 21, yy + 34, 43, 13, values.primary, 700, 1, { align: 'center' });
        text(card.title, x + 21, yy + 85, cardW - 42, mobile ? 19 : 22, values.text, 700, 2);
        text(card.subtitle, x + 21, yy + (mobile ? 122 : 151), cardW - 42, 13, values.muted, 400, 3, { lineHeight: 1.5 });
      } else {
        const accent = [values.primary, '#b9a2e8', '#e3b382'][index % 3];
        rect(x + 9, yy + 9, cardW - 18, 151, mix(values.surface, accent, .2), Math.max(4, number(values.radius, 16) - 5));
        text(tag, x + 25, yy + 28, cardW - 50, 9, mix(accent, '#ffffff', .25), 700, 1, { letterSpacing: 1.2 });
        if (index % 3 === 0) gift(m, x + cardW * .7, yy + 95, 40, accent);
        else if (index % 3 === 1) ball(m, x + cardW * .7, yy + 94, 42, accent);
        else medal(m, x + cardW * .7, yy + 89, 34, accent);
        text(['PLAY\nYOUR WAY.', 'GAME\nON.', 'A LITTLE\nEXTRA.'][index % 3], x + 25, yy + 66, cardW * .48, 20, values.text, 800, 2, { lineHeight: 1.07 });
        text(card.title, x + 21, yy + 180, cardW - 42, mobile ? 20 : 22, values.text, 700, 2);
        text(card.subtitle, x + 21, yy + 221, cardW - 42, 12, values.muted, 400, 2, { lineHeight: 1.5 });
        text(labels.explore, x + 21, yy + cardH - 37, cardW - 42, 12, values.primary, 650, 1);
      }
    });
    y += Math.ceil(cards.length / columns) * (cardH + gap) + (mobile ? 10 : 18);
  }
  if (sections.supporting) {
    const h = mobile ? 172 : 158;
    rect(mainX, y, mainW, h, mix(values.surface, values.primary, .06), number(values.radius, 16));
    text(template === 'vip' ? (config.language === 'en' ? 'Your journey, your pace.' : 'Tu camino, a tu ritmo.') : labels.quick, mainX + 23, y + 26, mainW - 46, mobile ? 21 : 27, values.text, 700, 2);
    text(labels.quickCopy, mainX + 23, y + (mobile ? 89 : 71), mainW - 46, 13, values.muted, 400, 1);
    text(labels.explore, mainX + 23, y + h - 35, mainW - 46, 12, values.primary, 600, 1);
    if (!mobile) { path(star(mainX + mainW - 97, y + 78, 38, 18, 4), mix(values.primary, values.surface, .5)); circle(mainX + mainW - 159, y + 43, 5, values.primary); }
    y += h + (mobile ? 30 : 38);
  }
  if (sections.footer) {
    rect(mainX, y, mainW, 1, values.border, 0); text(config.brand || 'MEGWIN', mainX, y + 26, 180, 18, values.muted, 800, 1);
    text(labels.footer, mainX, y + 62, mainW, 10, values.muted, 400, 1);
    if (!mobile) text(labels.footerLinks, mainX + mainW - 300, y + 30, 300, 11, values.muted, 400, 1, { align: 'right' });
    y += 106;
  }
  m.height = Math.ceil(Math.max(mobile ? 700 : 970, y + 16));
  // Extend the desktop navigation separator to the final responsive page height.
  if (!mobile && hasSidebar) for (const node of m.nodes) if (node.kind === 'rect' && node.y === 85 && node.x < 253) node.h = m.height - 85;
  return m;
}

function svgNode(node, index) {
  if (node.kind === 'rect') return `<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="${node.radius || 0}" fill="${esc(node.fill)}"${node.stroke ? ` stroke="${esc(node.stroke)}" stroke-width="1"` : ''}/>`;
  if (node.kind === 'circle') return `<circle cx="${node.cx}" cy="${node.cy}" r="${node.r}" fill="${esc(node.fill)}"${node.stroke ? ` stroke="${esc(node.stroke)}" stroke-width="${node.strokeWidth || 1}"` : ''}/>`;
  if (node.kind === 'path') return `<path d="${esc(node.d)}" fill="${esc(node.fill || 'none')}"${node.stroke ? ` stroke="${esc(node.stroke)}" stroke-width="${node.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"` : ''}/>`;
  if (node.kind === 'image') return `<defs><clipPath id="clip-${index}"><rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="${node.radius}"/></clipPath></defs><image xlink:href="${esc(node.href)}" x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" preserveAspectRatio="xMidYMid ${node.fit === 'contain' ? 'meet' : 'slice'}" clip-path="url(#clip-${index})"/>`;
  if (node.kind === 'text') {
    const x = node.align === 'center' ? node.x + node.w / 2 : node.align === 'right' ? node.x + node.w : node.x;
    return `<text x="${x}" y="${node.y + node.size * .85}" fill="${esc(node.fill)}" font-size="${node.size}" font-weight="${node.weight}"${node.letterSpacing ? ` letter-spacing="${node.letterSpacing}"` : ''} text-anchor="${node.align === 'center' ? 'middle' : node.align === 'right' ? 'end' : 'start'}">${node.lines.map((line, i) => `<tspan x="${x}" dy="${i ? node.lineHeight : 0}">${esc(line)}</tspan>`).join('')}</text>`;
  }
  if (node.kind === 'button') return `<g><rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="${node.radius}" fill="${esc(node.fill)}"${node.outline ? ` stroke="${esc(node.fg)}" stroke-opacity=".25"` : ''}/><text x="${node.x + node.w / 2}" y="${node.y + node.h / 2 + node.size * .35}" text-anchor="middle" fill="${esc(node.fg)}" font-size="${node.size}" font-weight="600">${esc(node.text)}</text></g>`;
  return '';
}
export function renderSVG(model) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${model.width}" height="${model.height}" viewBox="0 0 ${model.width} ${model.height}" role="img" aria-label="${esc(model.config.title)}"><title>${esc(model.config.title)}</title><desc>Editable vector layout generated from explicitly bound design tokens. Text remains text; uploaded artwork remains an embedded raster image.</desc>${embeddedFontCSS ? `<defs><style>${esc(embeddedFontCSS)}</style></defs><metadata id="poppins-font-license">${esc(fontLicense)}</metadata>` : ''}<rect width="100%" height="100%" fill="${esc(model.values.background)}"/><g font-family="${esc(model.values.fontFamily)}">${model.nodes.map(svgNode).join('')}</g></svg>`;
}

function htmlNode(node, index, model) {
  const X = v => (v / model.width * 100).toFixed(5) + '%', Y = v => (v / model.height * 100).toFixed(5) + '%';
  const cqw = v => (v / model.width * 100).toFixed(5) + 'cqw';
  const box = `left:${X(node.x)};top:${Y(node.y)};width:${X(node.w)};height:${Y(node.h)};`;
  if (node.kind === 'rect') return `<div aria-hidden="true" class="n rect" style="${box}background:${esc(node.fill)};border-radius:${cqw(node.radius || 0)};${node.stroke ? `border:1px solid ${esc(node.stroke)};` : ''}"></div>`;
  if (node.kind === 'text') {
    const tag = ['h1', 'h2', 'strong', 'nav'].includes(node.tag) ? node.tag : 'p';
    return `<${tag} class="n txt" style="${box}font-size:${cqw(node.size)};line-height:${cqw(node.lineHeight)};font-weight:${node.weight};color:${esc(node.fill)};text-align:${node.align || 'left'};${node.letterSpacing ? `letter-spacing:${cqw(node.letterSpacing)};` : ''}">${node.lines.map(esc).join('<br>')}</${tag}>`;
  }
  if (node.kind === 'button') return `<button type="button" class="n btn" style="${box}background:${esc(node.fill)};color:${esc(node.fg)};border-radius:${cqw(node.radius)};font-size:${cqw(node.size)};${node.outline ? `border:1px solid ${esc(model.values.border)};` : ''}" aria-label="${esc(node.text)}">${esc(node.text)}</button>`;
  if (node.kind === 'image') return `<img class="n artwork" alt="Uploaded hero artwork" src="${esc(node.href)}" style="${box}border-radius:${cqw(node.radius)};object-fit:${node.fit || 'cover'}">`;
  // Decorative geometry stays as editable inline SVG paths, not a screenshot.
  return `<svg class="n vector" viewBox="0 0 ${model.width} ${model.height}" aria-hidden="true" style="left:0;top:0;width:100%;height:100%;overflow:visible">${svgNode(node, index)}</svg>`;
}

export function renderHTML(config, values, metadata = {}) {
  const desktop = createPageModel(config, values, 'desktop'), mobile = createPageModel(config, values, 'mobile');
  const cssVars = Object.entries(values).map(([k, v]) => `--${k.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}:${v};`).join('');
  const section = (model, cls) => `<main class="page ${cls}" style="aspect-ratio:${model.width}/${model.height}" aria-label="${esc(config.title)}">${model.nodes.map((n, i) => htmlNode(n, i, model)).join('')}</main>`;
  const safeMeta = JSON.stringify({ generator: 'UI工作室 UI Studio', source: metadata.source || null, values, bindings: metadata.bindings || {}, template: config.template }).replace(/</g, '\\u003c');
  return `<!doctype html>\n<html lang="${config.language === 'en' ? 'en' : 'es'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(config.subtitle)}"><title>${esc(config.brand)} · ${esc(config.title)}</title><style>
${embeddedFontCSS}:root{${cssVars}}*{box-sizing:border-box}body{margin:0;background:var(--background);color:var(--text);font-family:var(--font-family)}.page{position:relative;container-type:inline-size;width:100%;max-width:1440px;margin:0 auto;overflow:hidden;background:var(--background)}.n{position:absolute;margin:0;padding:0}.txt{overflow:hidden;white-space:nowrap}.rect,.vector{pointer-events:none}.btn{display:flex;align-items:center;justify-content:center;border:0;font-family:inherit;font-weight:600;cursor:default;overflow:hidden;white-space:nowrap}.btn:focus-visible{outline:2px solid var(--primary);outline-offset:3px}.artwork{object-fit:cover}.mobile{display:none}.vector{pointer-events:none}@media(max-width:680px){.desktop{display:none}.mobile{display:block;max-width:680px}}@media print{.page{break-inside:avoid}.btn{print-color-adjust:exact}}
</style></head><body>${section(desktop, 'desktop')}${section(mobile, 'mobile')}<script type="application/json" id="layerlab-design-manifest">${safeMeta}</script>${fontLicense ? `<script type="text/plain" id="poppins-font-license">${fontLicense.replace(/</g, '\\u003c')}</script>` : ''}</body></html>`;
}

/** Render the same editable page model directly, including actual raster assets. */
export async function modelToPng(model) {
  await loadProjectFonts();
  if (model.width * model.height > 16000000) throw new Error('导出画布过大，请减少内容卡片。');
  const sources = [...new Set(model.nodes.filter(n => n.kind === 'image').map(n => n.href))];
  const images = new Map(await Promise.all(sources.map(async source => [source, await new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('主视觉图片无法解码，请重新选择图片。')); img.src = source;
  })])));
  const canvas = document.createElement('canvas'); canvas.width = model.width; canvas.height = model.height;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = model.values.background; ctx.fillRect(0, 0, model.width, model.height);
  ctx.imageSmoothingQuality = 'high';
  const box = n => { ctx.beginPath(); ctx.roundRect(n.x, n.y, n.w, n.h, Math.max(0, Math.min(n.radius || 0, n.w / 2, n.h / 2))); };
  const paint = n => {
    if (n.fill && n.fill !== 'none') { ctx.fillStyle = n.fill; ctx.fill(); }
    if (n.stroke) { ctx.strokeStyle = n.stroke; ctx.lineWidth = n.strokeWidth || 1; ctx.stroke(); }
  };
  for (const node of model.nodes) {
    ctx.save();
    if (node.kind === 'rect') { box(node); paint(node); }
    else if (node.kind === 'circle') { ctx.beginPath(); ctx.arc(node.cx, node.cy, node.r, 0, Math.PI * 2); paint(node); }
    else if (node.kind === 'path') {
      const p = new Path2D(node.d); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (node.fill && node.fill !== 'none') { ctx.fillStyle = node.fill; ctx.fill(p); }
      if (node.stroke) { ctx.strokeStyle = node.stroke; ctx.lineWidth = node.strokeWidth || 1; ctx.stroke(p); }
    } else if (node.kind === 'text') {
      ctx.font = `${node.weight} ${node.size}px ${model.values.fontFamily}`; ctx.fillStyle = node.fill;
      ctx.textAlign = node.align === 'center' ? 'center' : node.align === 'right' ? 'right' : 'left';
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${node.letterSpacing || 0}px`;
      const x = node.align === 'center' ? node.x + node.w / 2 : node.align === 'right' ? node.x + node.w : node.x;
      node.lines.forEach((line, i) => ctx.fillText(line, x, node.y + node.size * .85 + i * node.lineHeight));
    } else if (node.kind === 'button') {
      box(node); ctx.fillStyle = node.fill; ctx.fill();
      if (node.outline) { ctx.strokeStyle = model.values.border; ctx.stroke(); }
      ctx.font = `600 ${node.size}px ${model.values.fontFamily}`; ctx.textAlign = 'center'; ctx.fillStyle = node.fg;
      ctx.fillText(node.text, node.x + node.w / 2, node.y + node.h / 2 + node.size * .35);
    } else if (node.kind === 'image') {
      box(node); ctx.clip(); const img = images.get(node.href);
      const scale = node.fit === 'contain' ? Math.min(node.w / img.width, node.h / img.height) : Math.max(node.w / img.width, node.h / img.height);
      const width = img.width * scale, height = img.height * scale;
      ctx.drawImage(img, node.x + (node.w - width) / 2, node.y + (node.h - height) / 2, width, height);
    }
    ctx.restore();
  }
  return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 编码失败。')), 'image/png'));
}

export async function svgToPng(svg, width, height) {
  if (width * height > 16000000) throw new Error('导出画布过大，请减少内容卡片。');
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('SVG 转换失败，请先下载 SVG。')); image.src = url; });
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 编码失败。')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
