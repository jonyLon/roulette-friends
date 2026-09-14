import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initPhysics,RoulettePhysics} from '../public/physics.js';
import {freshRoom,act,publicState} from '../worker/game.js';
import {DT} from '../public/physics-shared.js';
await initPhysics();
test('shared mode is actor-only, locked by bets and captured for a spin',()=>{
 const s=freshRoom('SWITCH'),now=Date.now();
 act(s,'a',{action:'join',name:'А'},now);act(s,'b',{action:'join',name:'Б'},now);
 assert.throws(()=>act(s,'b',{action:'deflectors',enabled:false},now));
 act(s,'a',{action:'deflectors',enabled:false},now);
 assert.equal(publicState(s,'b').deflectors,false);
 act(s,'a',{action:'bet',key:'red',amount:100},now);
 assert.throws(()=>act(s,'a',{action:'deflectors',enabled:true},now));
 act(s,'a',{action:'spin'},now);assert.equal(s.spin.deflectors,false);
 assert.throws(()=>act(s,'a',{action:'deflectors',enabled:true},now));
 const sim=new RoulettePhysics(s.spin);assert.equal(sim.deflectorHandles.size,0);
 for(let i=0;i<9000&&!sim.result&&!sim.failed;i++)sim.step();
 const proof=sim.proof();assert.ok(proof.result);assert.equal(proof.contacts,0);
 const at=s.spin.startedAt+proof.step*DT*1000+100;
 assert.throws(()=>act(s,'b',{action:'finish',spinId:s.spin.id,proof:{...proof,deflectors:true}},at));
 act(s,'b',{action:'finish',spinId:s.spin.id,proof},at);assert.equal(s.result,proof.result);sim.free();
});
test('no-deflector physics settles naturally and replays identically',()=>{
 for(let i=0;i<4;i++){
 const launch={deflectors:false,ballSpeed:6.8+i*.25,wheelSpeed:1.02+i*.12,radialSpeed:0};
 let previous;
 for(let replay=0;replay<2;replay++){
 const sim=new RoulettePhysics(launch);assert.equal(sim.deflectorHandles.size,0);
 for(let step=0;step<9000&&!sim.result&&!sim.failed;step++)sim.step();
 const p=sim.proof();assert.ok(p.result);assert.equal(p.contacts,0);assert.ok(p.laps>2);assert.equal(p.ballSpeed,0);
 if(previous)assert.deepEqual(p,previous);previous=p;sim.free();
 }
 }
});
