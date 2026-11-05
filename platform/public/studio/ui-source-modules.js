import {UI_SOURCE_BLOCKS} from './ui-source-library.js';
import {loadMainFigmaPage,renderMainFigmaHTML} from './figma-main-page.js';
import {loadFigmaPage,renderFigmaHTML} from './figma-page.js';
export const moduleKey=n=>JSON.stringify([n.family,n.block,n.title,n.subtitle,n.buttonLabel]);
const toBase64=text=>{const bytes=new TextEncoder().encode(text);let raw='';for(let i=0;i<bytes.length;i+=16384)raw+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(raw);};
// Isolate archived CSS inside a script-free frame. SVG viewBox scales it without
// introducing executable model HTML, changing SVG paths, or fabricating H5 variants.
export async function prepareSourceModules(plan){const modules=new Map();
 async function visit(n){if(!n)return;if(n.type==='source-block'){
  const key=moduleKey(n);if(modules.has(key))return;const meta=UI_SOURCE_BLOCKS[n.family]?.[n.block];if(!meta)throw Error('未知原稿区块。');
  const main=n.family==='main',page=await(main?loadMainFigmaPage():loadFigmaPage()),render=main?renderMainFigmaHTML:renderFigmaHTML;
  const options={mode:plan.mode,embedAssets:true};for(const field of ['title','subtitle','buttonLabel'])if(n[field]!==undefined)options[field]=n[field];
  options.compose=(body,css)=>{const doc=new DOMParser().parseFromString(body,'text/html');let art=doc.querySelector(main?'.figma-main-artboard':'.figma-artboard');if(!art)throw Error('原稿画板缺失。');
   if(n.block!=='page'){const source=doc.querySelector(`[data-node-id="${meta.nodeId}"]`);if(!source)throw Error('原稿区块缺失。');const label=main&&n.block==='navbar'?doc.querySelector('[data-node-id="5529:785678"]')?.cloneNode(true):null;const selected=source.cloneNode(true);art.replaceChildren(selected);selected.style.position='absolute';selected.style.top='0';selected.style.left='0';selected.style.margin='0';selected.style.width=meta.width+'px';selected.style.height=meta.height+'px';
    // The live label is a separate sibling in the original desktop navbar.
    if(label){label.style.position='absolute';label.style.top='18px';label.style.left='301px';art.append(label);}
   }
   css+=`\nhtml,body{margin:0!important;padding:0!important;min-height:0!important;width:${meta.width}px!important;height:${meta.height}px!important;overflow:hidden!important} ${main?'.figma-main-artboard':'.figma-artboard'}{position:relative!important;margin:0!important;padding:0!important;width:${meta.width}px!important;height:${meta.height}px!important;min-height:0!important;overflow:hidden!important}`;
   return {body:doc.body.innerHTML,css};};
  const html=await render(options);modules.set(key,{...meta,family:n.family,block:n.block,mode:plan.mode,dataUrl:'data:text/html;base64,'+toBase64(html),capturedAt:page.manifest.capturedAt,copy:Object.fromEntries(['title','subtitle','buttonLabel'].filter(k=>n[k]!==undefined).map(k=>[k,n[k]]))});
 }for(const child of n.children||[])await visit(child);}
 await visit(plan.root);return modules;
}
