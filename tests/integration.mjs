import assert from 'node:assert/strict';
import {initPhysics,RoulettePhysics} from '../public/physics.js';
import {DT} from '../public/physics-shared.js';
const base='http://127.0.0.1:8787',a=crypto.randomUUID(),b=crypto.randomUUID();
async function req(path,token,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...body&&{'Content-Type':'application/json'}},body:body?JSON.stringify(body):undefined});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
await initPhysics();const s=await req('/api/rooms',a,{name:'Тест А'}),path='/api/rooms/'+s.code;
await req(path,b,{action:'join',name:'Тест Б'});
await req(path,a,{action:'bet',key:'red',amount:100,id:crypto.randomUUID()});
const spectator=await req(path,b);assert.equal(spectator.players[0].bets[0].amount,100);assert.equal(spectator.players[0].balance,9900);assert.equal(spectator.ledger.at(-1).amount,-100);
await assert.rejects(req(path,b,{action:'spin'}));
const spinning=await req(path,a,{action:'spin',id:crypto.randomUUID()});assert.equal(spinning.result,null);assert.equal(spinning.spin.target,undefined);
const simulation=new RoulettePhysics(spinning.spin);while(!simulation.result&&!simulation.failed)simulation.step();assert.ok(simulation.result);const proof=simulation.proof();simulation.free();
await new Promise(r=>setTimeout(r,Math.max(0,spinning.spin.startedAt+proof.step*DT*1000-Date.now()+100)));
const end=await req(path,b,{action:'finish',spinId:spinning.spin.id,proof,id:crypto.randomUUID()});assert.equal(end.result,proof.result);const other=await req(path,a);assert.equal(other.result,end.result);assert.deepEqual(other.players.map(p=>p.balance),end.players.map(p=>p.balance));
const next=await req(path,a,{action:'next',id:crypto.randomUUID()});assert.equal(next.turn,next.players[1].id);
await req(path,b,{action:'bet',key:'n:00',amount:50});const seen=await req(path,a);assert.equal(seen.players[1].bets[0].key,'n:00');
console.log('PASS: physical result, visible spectator bets/balances/ledger, blocked out-of-turn spin, next player.');
