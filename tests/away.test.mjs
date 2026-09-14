import {test} from 'node:test';
import assert from 'node:assert/strict';
import {freshRoom,act,tick,publicState} from '../worker/game.js';
const now=Date.now();
function room(){const s=freshRoom('AWAY');for(const token of ['a','b','c'])act(s,token,{action:'join',name:token},now);return s;}
test('away skips current player, refunds bets once, is public and return does not steal turn',()=>{
 const s=room();act(s,'a',{action:'bet',key:'red',amount:100},now);
 act(s,'a',{action:'away',enabled:true,id:'away'},now+1);
 assert.equal(s.turn,s.players[1].id);assert.equal(s.players[0].balance,10000);assert.equal(s.players[0].bets.length,0);
 assert.equal(publicState(s,'b').players[0].away,true);assert.equal(s.ledger.at(-1).amount,100);
 const count=s.ledger.length;act(s,'a',{action:'away',enabled:true,id:'away'},now+2);assert.equal(s.ledger.length,count);
 act(s,'b',{action:'pass'},now+3);act(s,'c',{action:'pass'},now+4);assert.equal(s.turn,s.players[1].id);
 assert.throws(()=>act(s,'a',{action:'bet',key:'red',amount:100},now+5));
 act(s,'a',{action:'away',enabled:false},now+6);assert.equal(s.turn,s.players[1].id);
 act(s,'b',{action:'pass'},now+7);act(s,'c',{action:'pass'},now+8);assert.equal(s.turn,s.players[0].id);
});
test('all away pauses safely and returning or joining starts a fresh turn',()=>{
 const s=room();for(const token of ['a','b','c'])act(s,token,{action:'away',enabled:true},now);
 assert.equal(s.turn,null);const round=s.round;tick(s,now+500000);assert.equal(s.turn,null);assert.equal(s.round,round);
 act(s,'b',{action:'away',enabled:false},now+500001);assert.equal(s.turn,s.players[1].id);assert.equal(s.turnStarted,now+500001);
 act(s,'b',{action:'away',enabled:true},now+500002);act(s,'d',{action:'join',name:'d'},now+500003);assert.equal(s.turn,s.players[3].id);
});
test('away during spin preserves round and stake; next turn skips absent players',()=>{
 const s=room();act(s,'a',{action:'bet',key:'red',amount:100},now);act(s,'a',{action:'spin'},now);
 const id=s.spin.id;act(s,'a',{action:'away',enabled:true},now+1);act(s,'b',{action:'away',enabled:true},now+2);
 assert.equal(s.phase,'spinning');assert.equal(s.turn,s.players[0].id);assert.equal(s.spin.id,id);assert.equal(s.players[0].balance,9900);assert.equal(s.players[0].bets.length,1);
 tick(s,s.spin.startedAt+100001);assert.equal(s.phase,'result');tick(s,s.advanceAt);assert.equal(s.turn,s.players[2].id);assert.equal(s.players[0].balance,10000);
});
test('status only changes authenticated player and old players remain active',()=>{
 const s=room();delete s.players[1].away;
 act(s,'c',{action:'away',enabled:true,player:s.players[0].id},now);assert.equal(s.players[0].away,false);assert.equal(s.players[2].away,true);
 assert.throws(()=>act(s,'x',{action:'away',enabled:true},now));assert.throws(()=>act(s,'a',{action:'away',enabled:'true'},now));
 act(s,'a',{action:'pass'},now);assert.equal(s.turn,s.players[1].id);
});
