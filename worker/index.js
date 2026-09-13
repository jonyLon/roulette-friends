import { freshRoom, act, publicState, tick } from './game.js';
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export default {async fetch(request,env){
 const url=new URL(request.url);if(!url.pathname.startsWith('/api/')){return env.ASSETS.fetch(request);}
 try{
 if(request.method!=='GET'&&request.method!=='POST')return json({error:'Method not allowed'},405);
 if(request.method==='POST'&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'Заборонений запит.'},403);
 const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token||!/^[a-zA-Z0-9-]{30,80}$/.test(token))return json({error:'Перезавантажте сторінку.'},401);
 const db=env.DB;if(!db)throw Error('Сервер кімнат ще не готовий. Спробуйте пізніше.');
 if(request.method==='POST'&&Number(request.headers.get('Content-Length')||0)>4096)return json({error:'Запит завеликий'},413);
 const body=request.method==='POST'?await request.json():null;
 if(url.pathname==='/api/rooms'&&body){
 for(let i=0;i<5;i++){const code=crypto.randomUUID().replaceAll('-','').slice(0,6).toUpperCase();const s=act(freshRoom(code),token,{action:'join',name:body.name});const r=await db.prepare('INSERT OR IGNORE INTO rooms (code,state,version) VALUES (?,?,0)').bind(code,JSON.stringify(s)).run();if(r.meta.changes)return json(publicState(s,token));}
 throw Error('Не вдалося створити кімнату. Спробуйте ще раз.');}
 const code=url.pathname.split('/')[3]?.toUpperCase();if(!/^[A-F0-9]{6}$/.test(code||''))return json({error:'Невірний код кімнати.'},400);
 for(let attempt=0;attempt<10;attempt++){
 const row=await db.prepare('SELECT state,version FROM rooms WHERE code=?').bind(code).first();if(!row)return json({error:'Кімнату не знайдено. Перевірте код.'},404);
 const s=JSON.parse(row.state);
 if(body)act(s,token,body);else {if(!s.players.some(p=>p.token===token))return json({error:'Увійдіть до кімнати.'},401);const before=JSON.stringify(s);tick(s);if(before===JSON.stringify(s))return json(publicState(s,token));}
 const r=await db.prepare('UPDATE rooms SET state=?,version=version+1 WHERE code=? AND version=?').bind(JSON.stringify(s),code,row.version).run();if(r.meta.changes)return json(publicState(s,token));
 }return json({error:'Кімната зайнята. Спробуйте ще раз.'},409);
 }catch(e){console.error(e);return json({error:e.message||'Не вдалося з’єднатися з кімнатою.'},400);}
}};

