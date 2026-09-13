import {test} from 'node:test';import assert from 'node:assert/strict';
import {initPhysics,RoulettePhysics} from '../public/physics.js';
import {POCKETS,pocketAt,DT} from '../public/physics-shared.js';
import {freshRoom,act,tick,payout} from '../worker/game.js';
await initPhysics();
function finish(launch){const s=new RoulettePhysics(launch);for(let i=0;i<9000&&!s.result&&!s.failed;i++)s.step();const proof=s.proof();assert.ok(proof.result,'must settle naturally in a pocket');assert.equal(proof.ballSpeed,0);assert.equal(proof.wheelSpeed,0);assert.equal(pocketAt(proof.position,proof.rotation),proof.result);s.free();return proof;}
test('38 physical sectors and payouts include distinct 0 and 00',()=>{assert.equal(new Set(POCKETS).size,38);for(let i=0;i<38;i++){const a=i*Math.PI*2/38;assert.equal(pocketAt({x:.66*Math.sin(a),y:.038,z:-.66*Math.cos(a)},{x:0,y:0,z:0,w:1}),POCKETS[i]);assert.equal(payout('n:'+POCKETS[i],POCKETS[i]),36);}for(const n of ['0','00'])for(const k of ['red','black','even','odd','low','high'])assert.equal(payout(k,n),0);});
test('native CCD simulation: laps, deflectors, actual rest; identical replay',()=>{const launch={ballSpeed:7.2,wheelSpeed:1.18,radialSpeed:0};const a=finish(launch),b=finish(launch);assert.deepEqual(a,b);assert.ok(a.laps>2);assert.ok(a.contacts>0);assert.ok(a.step>600);});
test('different initial velocities settle without any target number',()=>{const outcomes=[];for(let i=0;i<6;i++){const p=finish({ballSpeed:6.8+i*.17,wheelSpeed:1.02+i*.06,radialSpeed:0});assert.ok(p.laps>2);outcomes.push(p.result);}assert.ok(new Set(outcomes).size>1);});
test('turns, public bets, ledger, native result and single payout',()=>{const s=freshRoom('ABCDEF'),now=Date.now();act(s,'a',{action:'join',name:'А'},now);act(s,'b',{action:'join',name:'Б'},now);act(s,'a',{action:'bet',key:'red',amount:100,id:'bet'},now);act(s,'a',{action:'bet',key:'red',amount:100,id:'bet'},now);assert.equal(s.players[0].balance,9900);assert.throws(()=>act(s,'b',{action:'bet',key:'black',amount:100},now));assert.throws(()=>act(s,'b',{action:'spin'},now));act(s,'a',{action:'spin'},now);assert.equal(s.result,null);assert.equal(s.spin.target,undefined);assert.equal(s.spin.result,undefined);const proof=finish(s.spin),at=s.spin.startedAt+proof.step*DT*1000+100;assert.throws(()=>act(s,'b',{action:'finish',spinId:s.spin.id,proof:{...proof,ballSpeed:1}},at));act(s,'b',{action:'finish',spinId:s.spin.id,proof},at);assert.equal(s.result,proof.result);const balance=s.players[0].balance;act(s,'a',{action:'finish',spinId:s.spin.id,proof},at+1);assert.equal(s.players[0].balance,balance);assert.equal(s.last[0].bets[0].amount,100);assert.equal(s.ledger.filter(e=>e.reason.startsWith('Ставка')).length,1);tick(s,at+6001);assert.equal(s.turn,s.players[1].id);act(s,'b',{action:'bet',key:'n:00',amount:50},at+6002);act(s,'b',{action:'undo'},at+6003);assert.equal(s.players[1].balance,10000);assert.equal(s.players[1].delta.amount,50);});

test('regression: resting inner pocket must not time out and refund',()=>{
 const launch={ballSpeed:7.209000110626221,wheelSpeed:1.0870000123977661,radialSpeed:-0.003000000026077032,wheelRotation:{x:0,y:0,z:0,w:1}};
 const p=finish(launch);
 assert.ok(Math.hypot(p.position.x,p.position.z)<.57,'exercise original rejected inner band');
 assert.ok(p.step<9000);assert.equal(p.result,'27');
 assert.deepEqual({...p.position},{x:.3702983558177948,y:.036724019795656204,z:-.4305278956890106});
 const room=freshRoom('REFUND'),now=Date.now();act(room,'a',{action:'join',name:'Гравець'},now);act(room,'a',{action:'bet',key:'n:27',amount:100},now);act(room,'a',{action:'spin'},now);
 const at=room.spin.startedAt+p.step*DT*1000+10;
 act(room,'a',{action:'finish',spinId:room.spin.id,proof:p},at);
 assert.equal(room.result,'27');assert.equal(room.players[0].balance,13500);
 assert.equal(room.ledger.at(-1).reason,'Виплата · 27');
});
test('pocket detector rejects the hub, race and divider tops',()=>{
 const q={x:0,y:0,z:0,w:1};
 assert.equal(pocketAt({x:0,y:.038,z:-.4},q),null);
 assert.equal(pocketAt({x:0,y:.12,z:-.875},q),null);
 assert.equal(pocketAt({x:0,y:.089,z:-.65},q),null);
});

