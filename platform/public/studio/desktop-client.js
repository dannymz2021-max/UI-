const base='http://127.0.0.1:9231';
let token;
export async function desktopRequest(path,body,{blob=false}={}){
 let response;try{response=await fetch(base+path,{method:body?'POST':'GET',mode:'cors',credentials:'omit',targetAddressSpace:'loopback',headers:{'X-UIStudio-Desktop':'1',...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});}catch(cause){console.warn('UIStudio desktop connection:',cause.name,cause.message);throw Error('未连接本机豆包。请启动“连接豆包桌面”，并在浏览器允许此网站访问本机网络；然后点击“连接豆包桌面”。');}
 if(blob&&response.ok)return response.blob();const value=await response.json();if(!response.ok||!value.ok){if(response.status===401)token=null;const e=Error(value.error?.message||'本机连接暂时不可用。');e.code=value.error?.code;throw e;}if(path==='/session')token=value.token;return value;
}
export const connectDesktop=()=>desktopRequest('/session',{});
