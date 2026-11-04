import {embedFigmaAssets} from './figma-embed.js';
/** Actual Figma main-homepage composition. All layout and imagery come from the
 * recorded source nodes; this is not the earlier free-form welcome template. */
export const MAIN_FIGMA_PAGE_META = Object.freeze({
  width:1600,height:3941,nodeId:'3607:898490',fileKey:'ZFDvXEgggNZ49dZU7hmSLP',
  frameName:'Homepage · 登录后体育首页',
  sourceUrl:'https://www.figma.com/design/ZFDvXEgggNZ49dZU7hmSLP/Megwin?node-id=3607-898490',
});
export const MAIN_FIGMA_PAGE_DEFAULTS = Object.freeze({
  title:'FORTUNE TIGER',
  subtitle:'Desperte sua fortuna!',
  buttonLabel:'Play Now',mode:'dark',
});
export const MAIN_FIGMA_PAGE_EDITABLE_FIELDS=Object.freeze(['title','subtitle','buttonLabel']);
let pagePromise=null;
const escapeHTML=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c');
async function readText(url){const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw new Error(`Figma 原稿资源暂时无法读取：${url.split('/').pop()}`);return response.text();}
export async function loadMainFigmaPage(){
  if(!pagePromise)pagePromise=Promise.all([
    readText('/studio/figma-main-assets/main-body.html'),readText('/studio/figma-main-page.css'),
    readText('/studio/figma-main-assets/main-manifest.json'),readText('/studio/fonts/Poppins-OFL.txt'),readText('/studio/figma-main-assets/Rowdies-OFL.txt'),
  ]).then(([body,css,raw,poppins,rowdies])=>({body,css,manifest:JSON.parse(raw),license:`POPPINS\n${poppins}\n\nROWDIES\n${rowdies}`})).catch(error=>{pagePromise=null;throw error;});
  return pagePromise;
}
function editHero(body,options){
  const fields=[['title','[data-node-id="2273:603378"]',32],['subtitle','[data-node-id="2273:603389"]',80],['buttonLabel','[data-node-id="I2273:603395;269:4274"] p',20]];
  if(!fields.some(([key])=>Object.hasOwn(options,key)))return body;
  const doc=new DOMParser().parseFromString(body,'text/html');
  for(const [key,selector,max]of fields){if(!Object.hasOwn(options,key))continue;const node=doc.querySelector(selector);if(!node)throw new Error('原稿编辑节点缺失，请重新加载页面。');node.textContent=String(options[key]??'').slice(0,max);}
  return doc.body.innerHTML;
}
/** @returns {Promise<string>} A fixed 1600 × 3941 desktop document with live text.
 * embedAssets:true produces a standalone HTML file with original SVG/PNG and fonts.
 * mode:'light' is an actual-token preview; the source frame and raster assets are dark.
 */
export async function renderMainFigmaHTML(options={}){
  const page=await loadMainFigmaPage();let body=editHero(page.body,options),css=page.css;
  const mode=options.mode==='light'?'light':'dark';
  if(options.compose)({body,css}=options.compose(body,css,page.manifest));
  if(options.embedAssets)({body,css}=await embedFigmaAssets(page.manifest,body,css));
  const meta={...MAIN_FIGMA_PAGE_META,format:'editable-html-with-original-assets',mode,assetCount:page.manifest.assets.length,variableCount:page.manifest.variableCount,desktopOnly:true,embedded:!!options.embedAssets,lightModeNote:mode==='light'?'真实变量浅色预览；原稿静态图像仍使用读取到的素材。':undefined,...options.compositionMeta};
  return `<!doctype html><html lang="en" data-figma-mode="${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=1600"><meta name="color-scheme" content="${mode}"><title>${escapeHTML(options.title??MAIN_FIGMA_PAGE_DEFAULTS.title)} · Megwin</title><style>${css}</style></head><body>${body}<script type="application/json" id="figma-source-manifest">${safeJSON(meta)}</script><script type="text/plain" id="figma-main-font-licenses">${page.license.replace(/</g,'\\u003c')}</script></body></html>`;
}
