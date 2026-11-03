import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ttf':'font/ttf','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/') && req.method!=='GET') {
      res.writeHead(503,{'Content-Type':'application/json; charset=utf-8'});
      res.end(JSON.stringify({ok:false,error:{code:'SERVICE_NOT_CONFIGURED',message:'重建版尚未配置模型或 Figma 在线服务。可继续使用本地编辑、导出和设计快照。'}}));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    let filename=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(filename!==root&&!filename.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    let stat=await fs.stat(filename);
    if(stat.isDirectory()){filename=path.join(filename,'index.html');stat=await fs.stat(filename);}
    const type=url.pathname==='/api/studio/status'?'application/json; charset=utf-8':types[path.extname(filename)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Content-Length':stat.size,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:await fs.readFile(filename));
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('未找到这个文件。');}
});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log(`UI工作室: http://127.0.0.1:${server.address().port}/studio/#start`));
