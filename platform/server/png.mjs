import {inflateSync} from 'node:zlib';
export function inspectPNG(bytes){
 const b=Buffer.from(bytes);
 if(b.length<33||b.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('返回文件不是有效 PNG。');
 const width=b.readUInt32BE(16),height=b.readUInt32BE(20),depth=b[24],color=b[25];
 if(!width||!height||width*height>8294400||depth!==8||![2,6].includes(color)||b[28]!==0)throw Error('图片编码或分辨率暂不支持验证。');
 const parts=[];let ended=false;
 for(let p=8;p+12<=b.length;){const n=b.readUInt32BE(p);if(p+12+n>b.length)throw Error('PNG文件不完整。');const t=b.toString('ascii',p+4,p+8);if(t==='IDAT')parts.push(b.subarray(p+8,p+8+n));if(t==='IEND'){ended=true;break;}p+=n+12;}
 if(!ended||!parts.length)throw Error('PNG文件不完整。');
 const channels=color===6?4:3,stride=width*channels,raw=inflateSync(Buffer.concat(parts),{maxOutputLength:(stride+1)*height});
 if(raw.length!==(stride+1)*height)throw Error('像素数据不完整。');
 const paeth=(a,b,c)=>{const p=a+b-c,x=Math.abs(p-a),y=Math.abs(p-b),z=Math.abs(p-c);return x<=y&&x<=z?a:y<=z?b:c;};
 let previous=Buffer.alloc(stride),p=0,transparentPixels=0,visiblePixels=0;
 for(let y=0;y<height;y++){const filter=raw[p++];if(filter>4)throw Error('PNG过滤格式无效。');const row=Buffer.from(raw.subarray(p,p+stride));p+=stride;for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,c=x>=channels?previous[x-channels]:0,u=previous[x];row[x]=(row[x]+(filter===1?a:filter===2?u:filter===3?Math.floor((a+u)/2):filter===4?paeth(a,u,c):0))&255;}for(let x=0;x<stride;x+=channels){const alpha=channels===4?row[x+3]:255;if(alpha<255)transparentPixels++;if(alpha>0)visiblePixels++;}previous=row;}
 if(!visiblePixels)throw Error('返回了全透明空图。');
 return {width,height,bytes:b.length,hasAlpha:color===6,transparentPixels,visiblePixels};
}
