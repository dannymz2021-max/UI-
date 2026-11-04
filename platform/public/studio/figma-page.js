import {embedFigmaAssets} from './figma-embed.js';
/** Actual Figma activity-frame composition. All layout and imagery come from the
 * recorded source nodes; this is not the earlier free-form welcome template. */
export const FIGMA_PAGE_META = Object.freeze({
  width:1600,height:3526,nodeId:'10002:56600',fileKey:'2EBmHXzEU62LfXXaE1CEza',
  frameName:'Homepage · 新客专属奖励',
  sourceUrl:'https://www.figma.com/design/2EBmHXzEU62LfXXaE1CEza/Megwin活动?node-id=10002-56600',
});
export const FIGMA_PAGE_DEFAULTS = Object.freeze({
  title:'Every step,there are new rewards！',
  subtitle:'Unlock nine cash stages with total deposits and claim up to 10,650 MXN. Make a first deposit of any amount to receive a daily Free Spin.',
  buttonLabel:'Deposita Ahora',mode:'dark',
});
let pagePromise=null;
const escapeHTML=value=>String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c');
async function readText(url){const response=await fetch(url,{credentials:'same-origin'});if(!response.ok)throw new Error(`Figma 原稿资源暂时无法读取：${url.split('/').pop()}`);return response.text();}
export async function loadFigmaPage(){
  if(!pagePromise)pagePromise=Promise.all([
    readText('/studio/figma-assets/activity-body.html'),readText('/studio/figma-page.css'),
    readText('/studio/figma-assets/activity-manifest.json'),readText('/studio/fonts/Poppins-OFL.txt'),
  ]).then(([body,css,raw,license])=>({body,css,manifest:JSON.parse(raw),license})).catch(error=>{pagePromise=null;throw error;});
  return pagePromise;
}
function editHero(body,options){
  const fields=[['title','[data-node-id="10002:56616"]',80],['subtitle','[data-node-id="10002:56618"]',260],['buttonLabel','[data-node-id="I10002:56621;266:4082"] p',40]];
  if(!fields.some(([key])=>Object.hasOwn(options,key)))return body;
  const doc=new DOMParser().parseFromString(body,'text/html');
  for(const [key,selector,max]of fields){if(!Object.hasOwn(options,key))continue;const node=doc.querySelector(selector);if(!node)throw new Error('原稿编辑节点缺失，请重新加载页面。');node.textContent=String(options[key]??'').slice(0,max);}
  return doc.body.innerHTML;
}
/** @returns {Promise<string>} A fixed 1600 × 3526 desktop document with live text.
 * embedAssets:true produces a standalone HTML file with original SVG/PNG and fonts.
 * mode:'light' is an actual-token preview; the source frame and raster assets are dark.
 */
export async function renderFigmaHTML(options={}){
  const page=await loadFigmaPage();let body=editHero(page.body,options),css=page.css;
  const mode=options.mode==='light'?'light':'dark';
  if(options.compose)({body,css}=options.compose(body,css,page.manifest));
  if(options.embedAssets)({body,css}=await embedFigmaAssets(page.manifest,body,css));
  const meta={...FIGMA_PAGE_META,format:'editable-html-with-original-assets',mode,assetCount:page.manifest.assets.length,variableCount:page.manifest.variableCount,desktopOnly:true,embedded:!!options.embedAssets,lightModeNote:mode==='light'?'真实变量浅色预览；原稿静态图像仍使用读取到的素材。':undefined,...options.compositionMeta};
  return `<!doctype html><html lang="en" data-figma-mode="${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=1600"><meta name="color-scheme" content="${mode}"><title>${escapeHTML(options.title??FIGMA_PAGE_DEFAULTS.title)} · Megwin</title><style>${css}</style></head><body>${body}<script type="application/json" id="figma-source-manifest">${safeJSON(meta)}</script><script type="text/plain" id="poppins-font-license">${page.license.replace(/</g,'\\u003c')}</script></body></html>`;
}
