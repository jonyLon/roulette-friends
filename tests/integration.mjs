import assert from 'node:assert/strict';
const base='http://127.0.0.1:8787';const a=crypto.randomUUID(),b=crypto.randomUUID();
async function req(path,token,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...body&&{'Content-Type':'application/json'}},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error);return data}
const s=await req('/api/rooms',a,{name:'Тест А'}),path='/api/rooms/'+s.code;
await req(path,b,{action:'join',name:'Тест Б'});
await Promise.all([req(path,a,{action:'bet',key:'red',amount:100,id:crypto.randomUUID()}),req(path,b,{action:'bet',key:'black',amount:100,id:crypto.randomUUID()})]);
const spin=await req(path,a,{action:'spin',id:crypto.randomUUID()});assert.equal(spin.result,null);assert.equal(spin.players.length,2);assert.equal(spin.players.reduce((s,p)=>s+p.balance,0),19800);
await new Promise(r=>setTimeout(r,8200));const end=await req(path,b);assert.equal(end.phase,'result');const after=await req(path,a);assert.equal(after.result,end.result);assert.deepEqual(after.players.map(p=>p.balance),end.players.map(p=>p.balance));
const next=await req(path,a,{action:'next',id:crypto.randomUUID()});assert.equal(next.round,2);console.log('PASS: two independent players, simultaneous bets, hidden result, shared settlement, next round.');
