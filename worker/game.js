import { POCKETS, DT, ENGINE_VERSION, pocketAt } from '../public/physics-shared.js';
export const RED=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
export function payout(key,result){const n=Number(result),zero=result==='0'||result==='00';if(key.startsWith('n:'))return key.slice(2)===result?36:0;if(zero)return 0;if(key==='red')return RED.includes(n)?2:0;if(key==='black')return RED.includes(n)?0:2;if(key==='even')return n%2===0?2:0;if(key==='odd')return n%2?2:0;if(key==='low')return n<=18?2:0;if(key==='high')return n>=19?2:0;if(key.startsWith('dozen:'))return Math.ceil(n/12)===Number(key.slice(6))?3:0;if(key.startsWith('col:'))return (n-1)%3+1===Number(key.slice(4))?3:0;return 0;}
export const validKey=k=>/^(n:(00|[0-9]|[12][0-9]|3[0-6])|red|black|even|odd|low|high|dozen:[123]|col:[123])$/.test(k);
export function freshRoom(code){return {code,deflectors:true,players:[],host:null,turn:null,round:1,phase:'betting',result:null,history:[],last:[],requests:[],ledger:[],turnStarted:Date.now()};}
function change(s,p,amount,reason,now){if(!amount)return;p.balance+=amount;const e={id:crypto.randomUUID(),player:p.id,name:p.name,amount,balance:p.balance,reason,round:s.round,at:now};s.ledger.push(e);p.delta=e;}
function advance(s,now){const index=s.players.findIndex(p=>p.id===s.turn);s.turn=null;for(let offset=1;offset<=s.players.length;offset++){const next=s.players[(index+offset)%s.players.length];if(!next.away){s.turn=next.id;break;}}s.phase='betting';s.result=null;s.round++;s.turnStarted=now;s.advanceAt=0;}
export function tick(s,now=Date.now()){
 s.ledger??=[];
 if(!s.turn&&s.phase==='betting'){s.turn=s.players.find(p=>!p.away)?.id??null;s.turnStarted=now;}
 // Safely migrate unfinished scripted rounds without announcing a fabricated number.
 if(s.phase==='spinning'&&![ENGINE_VERSION,'rapier-0.19.3-roulette-v1'].includes(s.spin?.engine)){for(const p of s.players){change(s,p,p.bets.reduce((a,b)=>a+b.amount,0),'Повернення після оновлення',now);p.bets=[];}s.spin=null;s.phase='betting';s.result=null;}
 if(s.phase==='betting')for(const p of s.players)if(p.id!==s.turn&&p.bets.length){change(s,p,p.bets.reduce((a,b)=>a+b.amount,0),'Повернення: гра по черзі',now);p.bets=[];}
 if(s.phase==='spinning'&&now>s.spin.startedAt+100000){for(const p of s.players){change(s,p,p.bets.reduce((a,b)=>a+b.amount,0),'Крутку перервано: повернення',now);p.bets=[];}s.phase='result';s.result=null;s.last=[];s.advanceAt=now+5000;}
 if(s.phase==='result'&&s.advanceAt&&now>=s.advanceAt)advance(s,now);
 if(s.phase==='betting'&&s.turn&&now-s.turnStarted>120000&&s.players.length>1){const p=s.players.find(p=>p.id===s.turn);change(s,p,p.bets.reduce((a,b)=>a+b.amount,0),'Час ходу вичерпано: повернення',now);p.bets=[];advance(s,now);}
}
function validateProof(s,proof,now){
 if((proof?.deflectors!==false)!==(s.spin.deflectors!==false))throw Error('Режим колеса змінився. Оновіть сторінку.');
 if(![ENGINE_VERSION,'rapier-0.19.3-roulette-v1'].includes(proof?.engine)||!Number.isInteger(proof.step)||proof.step<120||proof.step>9000||(!Number.isInteger(proof.stable)||proof.stable<120))throw Error('Кулька ще не зупинилась.');
 if(now<s.spin.startedAt+proof.step*DT*1000-500)throw Error('Фізична крутка ще триває.');
 for(const k of ['ballSpeed','ballAngularSpeed','wheelSpeed'])if(!Number.isFinite(proof[k])||proof[k]<0)throw Error('Некоректна швидкість.');
 if(proof.ballSpeed>=.008||proof.ballAngularSpeed>=.15||proof.wheelSpeed>=.006)throw Error('Дочекайтеся повної зупинки.');
 for(const k of ['x','y','z'])if(!Number.isFinite(proof.position?.[k])||!Number.isFinite(proof.rotation?.[k]))throw Error('Некоректна позиція.');
 if(!Number.isFinite(proof.rotation.w)||Math.abs(proof.rotation.x)>.001||Math.abs(proof.rotation.z)>.001||Math.abs(proof.rotation.y**2+proof.rotation.w**2-1)>.002)throw Error('Некоректне положення колеса.');
 const result=pocketAt(proof.position,proof.rotation);if(result===null)throw Error('Кулька ще не в кишені.');return result;
}
export function act(s,token,body,now=Date.now()){
 tick(s,now);if(body.id&&s.requests.includes(body.id))return s;
 let p=s.players.find(p=>p.token===token);
 if(body.action==='join'){
  if(!p){if(s.players.length>=8)throw Error('У кімнаті вже 8 гравців.');const name=String(body.name||'').trim().slice(0,24);if(!name)throw Error('Введіть ім’я.');p={id:crypto.randomUUID(),token,name,away:false,balance:0,bets:[]};s.players.push(p);s.host??=p.id;if(!s.turn&&s.phase==='betting'){s.turn=p.id;s.turnStarted=now;}change(s,p,10000,'Стартові фішки',now);}
 }else{
 if(!p)throw Error('Спершу увійдіть до кімнати.');
 if(['bet','undo','clear','spin','pass','deflectors'].includes(body.action)&&p.id!==s.turn)throw Error('Зараз хід іншого гравця. Ви можете спостерігати.');
 if(['bet','undo','clear','spin','pass','deflectors'].includes(body.action)&&s.phase!=='betting')throw Error('Дочекайтеся завершення крутки.');
 if(body.action==='away'){
 if(typeof body.enabled!=='boolean')throw Error('Некоректний статус.');
 p.away=body.enabled;
 if(p.away&&p.id===s.turn&&s.phase==='betting'){
 change(s,p,p.bets.reduce((sum,b)=>sum+b.amount,0),'Відійшов: повернення ставок',now);p.bets=[];advance(s,now);
 }else if(!p.away&&!s.turn&&s.phase==='betting'){s.turn=p.id;s.turnStarted=now;}
 }else if(body.action==='deflectors'){
 if(typeof body.enabled!=='boolean')throw Error('Некоректний режим.');
 if(s.players.some(player=>player.bets.length))throw Error('Змініть режим до першої ставки.');
 s.deflectors=body.enabled;
 }else if(body.action==='bet'){
 if(!validKey(body.key)||![10,50,100,500,1000].includes(body.amount))throw Error('Некоректна ставка.');if(p.balance<body.amount)throw Error('Недостатньо фішок.');if(p.bets.length>=100)throw Error('Ліміт — 100 ставок.');change(s,p,-body.amount,'Ставка '+body.key,now);p.bets.push({key:body.key,amount:body.amount});
 }else if(body.action==='undo'||body.action==='clear'){const removed=body.action==='undo'?p.bets.splice(-1):p.bets.splice(0);change(s,p,removed.reduce((a,b)=>a+b.amount,0),'Скасування ставки',now);
 }else if(body.action==='spin'){
 if(!p.bets.length)throw Error('Спершу зробіть ставку.');const random=new Uint32Array(3);crypto.getRandomValues(random);
 s.spin={deflectors:s.deflectors!==false,wheelRotation:s.spin?.final?.rotation??{x:0,y:0,z:0,w:1},id:crypto.randomUUID(),engine:ENGINE_VERSION,startedAt:now+500,ballSpeed:Math.fround(6.8+(random[0]%1001)/1000),wheelSpeed:Math.fround(.95+(random[1]%601)/1000),radialSpeed:Math.fround((random[2]%21-10)/1000)};
 s.phase='spinning';s.result=null;s.last=[];
 }else if(body.action==='finish'){
 if(body.spinId!==s.spin?.id)throw Error('Це інша крутка.');
 if(s.phase==='result')return s;if(s.phase!=='spinning')throw Error('Крутка не активна.');
 const result=validateProof(s,body.proof,now);s.result=result;s.spin.final=body.proof;s.phase='result';s.advanceAt=now+6000;
 s.last=s.players.map(player=>{const bets=player.bets.slice(),stake=bets.reduce((a,b)=>a+b.amount,0),won=bets.reduce((a,b)=>a+b.amount*payout(b.key,result),0);change(s,player,won,'Виплата · '+result,now);player.bets=[];return {id:player.id,name:player.name,stake,won,net:won-stake,bets};});s.history.unshift(result);s.history=s.history.slice(0,24);
 }else if(body.action==='void'){
 if(s.phase!=='spinning'||body.spinId!==s.spin?.id||now<s.spin.startedAt+75000)throw Error('Фізична крутка ще триває.');
 for(const player of s.players){change(s,player,player.bets.reduce((a,b)=>a+b.amount,0),'Немає зупинки в кишені: повернення',now);player.bets=[];}s.phase='result';s.result=null;s.last=[];s.advanceAt=now+6000;
 }else if(body.action==='next'||body.action==='pass'){
 if(p.id!==s.turn)throw Error('Зараз не ваш хід.');if(body.action==='next'&&s.phase!=='result')throw Error('Крутка ще триває.');if(p.bets.length)throw Error('Спершу зніміть ставки.');advance(s,now);
 }else if(body.action==='refill'){if(p.balance||p.bets.length||s.phase==='spinning')throw Error('Поповнення доступне після закінчення фішок.');change(s,p,10000,'Нові віртуальні фішки',now);
 }else throw Error('Невідома дія.');
 }
 if(body.id){s.requests.push(body.id);s.requests=s.requests.slice(-512);}return s;
}
export function publicState(s,token){const me=s.players.find(p=>p.token===token);if(!me)throw Error('Увійдіть до кімнати.');return {...s,requests:undefined,me:me.id,serverTime:Date.now(),players:s.players.map(({token,...p})=>p)};}
