export async function desktopPage(kind='doubao-chat'){
 if(!['doubao-chat','doubao-launcher'].includes(kind))throw Error('Unsupported desktop page type');
 const res=await fetch('http://127.0.0.1:9229/json/list',{signal:AbortSignal.timeout(4000)});if(!res.ok)throw Error('Desktop endpoint unavailable');
 const list=await res.json(),pages=list.filter(t=>t.type==='page'&&new RegExp('^(doubao|chrome):\\/\\/'+kind+'\\/').test(t.url));
 if(pages.length!==1)throw Error('Expected exactly one Doubao chat page, found '+pages.length);
 const target=pages[0],url=new URL(target.webSocketDebuggerUrl);
 if(url.protocol!=='ws:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.port!=='9229')throw Error('Nonlocal desktop endpoint rejected');
 const ws=new WebSocket(url),pending=new Map();let seq=0;
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.close();reject(Error('Connection timeout'));},5000);ws.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Connection failed'));},{once:true});});
 ws.addEventListener('message',event=>{const m=JSON.parse(event.data),p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
 return {target,call(method,params={}){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timeout'));},12000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});},async dom(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;},close(){ws.close();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Connection closed'));}pending.clear();}};
}
