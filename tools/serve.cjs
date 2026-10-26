const http=require('node:http'), fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'../build/web-desktop'), port=Number(process.env.PORT||7456);
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.png':'image/png','.wav':'audio/wav','.css':'text/css','.wasm':'application/wasm'};
if(!fs.existsSync(path.join(root,'index.html'))) { console.error('Build the Cocos project first: npm run build'); process.exit(1); }
http.createServer((req,res)=>{ let p; try { p=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
const file=path.resolve(root,'.'+(p==='/'?'/index.html':p)); if(!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
fs.readFile(file,(e,b)=>{if(e){res.writeHead(404).end('Not found');return;} res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(b);});
}).listen(port,'127.0.0.1',()=>console.log(`Cocos build: http://127.0.0.1:${port}`));
