import { mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
function cpSync(src,dest){const entries=readdirSync(src,{withFileTypes:true});mkdirSync(dest,{recursive:true});for(const e of entries){if(e.isDirectory())cpSync(src+'/'+e.name,dest+'/'+e.name);else writeFileSync(dest+'/'+e.name,readFileSync(src+'/'+e.name));}}
mkdirSync('dist/server', {recursive:true});
mkdirSync('dist/client', {recursive:true});
mkdirSync('dist/.openai', {recursive:true});
const html=readFileSync('public/index.html','utf8');
const css=readFileSync('public/style.css','utf8');
const js=readFileSync('public/app.js','utf8');
const source=readFileSync('worker/index.js','utf8').replace("import { freshRoom, act, publicState } from './game.js';",readFileSync('worker/game.js','utf8').replaceAll('export ',''));
writeFileSync('dist/server/index.js', 'const STATIC = '+JSON.stringify({'/':{body:html,type:'text/html; charset=utf-8'},'/style.css':{body:css,type:'text/css; charset=utf-8'},'/app.js':{body:js,type:'text/javascript; charset=utf-8'}})+';\n'+source.replace('return env.ASSETS.fetch(request);',"const asset=STATIC[url.pathname]; return asset ? new Response(asset.body,{headers:{'Content-Type':asset.type}}) : new Response('Not found',{status:404});"));
cpSync('public','dist/client',{recursive:true});
writeFileSync('dist/.openai/hosting.json',readFileSync('.openai/hosting.json'));
cpSync('drizzle','dist/.openai/drizzle',{recursive:true});
console.log('Built roulette Worker and assets.');
