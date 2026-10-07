import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const base=path.resolve(import.meta.dirname,'..',process.argv[2]||'public');
const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(base,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
    const body=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(body);
  } catch {res.writeHead(404).end('Not found');}
});
server.listen(Number(process.env.PORT||4317),'127.0.0.1',()=>console.log('NJCSV: http://127.0.0.1:4317'));
