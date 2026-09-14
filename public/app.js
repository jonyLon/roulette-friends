import {POCKETS,DT} from './physics-shared.js';
import {GEOMETRY} from './geometry.js';
import {initPhysics,RoulettePhysics} from './physics.js';
const $=id=>document.getElementById(id),reds=new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const fmt=n=>new Intl.NumberFormat('uk-UA').format(n),signed=n=>(n>0?'+':'')+fmt(n);
let token=localStorage.getItem('roulette-token');if(!token){token=crypto.randomUUID();localStorage.setItem('roulette-token',token);}
let state=null,denom=100,busy=false,pollBusy=false,ready=false,sim=null,simId=null,clockOffset=0,frameId=0,submitting=false,pending=null,lastToast='',toastTimer;
let code=new URL(location.href).searchParams.get('room')||'';
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4500);}
function cell(key,label,classes=''){const b=document.createElement('button');b.className='cell '+classes;b.dataset.key=key;b.setAttribute('aria-label','Ставка: '+label);if(key.startsWith('n:')){const n=document.createElement('span');n.className='number';n.textContent=label;b.append(n);}else if(key==='red'||key==='black'){const d=document.createElement('span');d.className='diamond '+(key==='black'?'black':'');b.append(d);}else b.textContent=label;b.onclick=()=>action('bet',{key,amount:denom});return b;}
$('board').append(cell('n:00','00','zero'),cell('n:0','0','zero'));
for(let row=0;row<3;row++){for(let col=0;col<12;col++){const n=3-row+col*3,b=cell('n:'+n,String(n),reds.has(n)?'red':'black');b.style.gridRow=(row*2+1)+' / span 2';b.style.gridColumn=col+2;$('board').append(b);}const b=cell('col:'+(3-row),'2 to 1','column');b.style.gridRow=(row*2+1)+' / span 2';b.style.gridColumn=14;$('board').append(b);}
for(let i=1;i<=3;i++)$('dozens').append(cell('dozen:'+i,i===1?'1st 12':i===2?'2nd 12':'3rd 12'));
for(const [k,l] of [['low','1 to 18'],['even','EVEN'],['red','Червоне'],['black','Чорне'],['odd','ODD'],['high','19 to 36']])$('outside').append(cell(k,l));
for(const n of [10,50,100,500,1000]){const b=document.createElement('button');b.className='chip'+(n===denom?' selected':'');b.textContent=n===1000?'1K':n;b.setAttribute('aria-label',n+' фішок');b.setAttribute('aria-pressed',String(n===denom));b.onclick=()=>{denom=n;for(const c of $('chips').children){c.classList.toggle('selected',c===b);c.setAttribute('aria-pressed',String(c===b));}};$('chips').append(b);}
async function api(path,body){const sent=performance.now(),r=await fetch(path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});let d;try{d=await r.json();}catch{throw Error('Сервер тимчасово недоступний.');}if(!r.ok)throw Error(d.error||'Помилка з’єднання');return {...d,receivedAt:performance.now(),clockEstimate:d.serverTime+Math.min(250,(performance.now()-sent)/2)};}
function accept(s){if(state&&s.serverTime<state.serverTime)return;if(sim&&state?.phase==='spinning'&&s.phase==='result'&&!sim.result&&!sim.failed){pending=s;return;}state=s;code=s.code;ensurePhysics();render();}
async function action(a,extra={}){if(!state){$('lobby').showModal();return;}if(busy)return;busy=true;render();try{accept(await api('/api/rooms/'+code,{action:a,...extra,id:crypto.randomUUID()}));}catch(e){toast(e.message);}finally{busy=false;render();}}
$('lobbyForm').onsubmit=async e=>{e.preventDefault();$('enter').disabled=true;$('lobbyError').textContent='';try{const join=$('code').value.trim().toUpperCase();accept(await api(join?'/api/rooms/'+join:'/api/rooms',{action:'join',name:$('name').value.trim(),id:crypto.randomUUID()}));const url=new URL(location.href);url.searchParams.set('room',code);history.replaceState(null,'',url);$('lobby').close();toast('Ви за столом. Граємо по черзі.');}catch(e){$('lobbyError').textContent=e.message;}finally{$('enter').disabled=false;}};
$('code').value=code;$('code').oninput=()=>$('enter').firstChild.textContent=$('code').value.trim()?'Приєднатися ':'Створити кімнату ';$('code').oninput();
$('spin').onclick=()=>action(state?.phase==='result'?'next':'spin');$('undo').onclick=()=>action('undo');$('clear').onclick=()=>action('clear');$('refill').onclick=()=>action('refill');$('pass').onclick=()=>action('pass');
$('invite').onclick=async()=>{if(!state){$('lobby').showModal();return;}const url=new URL(location.href);url.searchParams.set('room',code);try{await navigator.clipboard.writeText(url.href);toast('Посилання скопійовано. Код: '+code);}catch{toast('Код кімнати: '+code+' · скопіюйте адресу з браузера');}};
$('rulesBtn').onclick=()=>$('rules').showModal();$('closeRules').onclick=()=>$('rules').close();$('lobby').addEventListener('cancel',e=>{if(!state)e.preventDefault();});
function deltaTag(entry){const el=document.createElement('span');el.className='balance-delta '+(entry.amount>=0?'positive':'negative');el.textContent=signed(entry.amount);el.title=entry.reason;return el;}
let shownLedger=40;$('moreLedger').onclick=()=>{shownLedger+=40;render();};
function render(){
 const me=state?.players.find(p=>p.id===state.me),actor=state?.players.find(p=>p.id===state.turn),mine=!!me&&me.id===actor?.id,open=state?.phase==='betting',last=state?.last.find(p=>p.id===actor?.id);
 const bets=state?.phase==='result'?(last?.bets??[]):(actor?.bets??[]);
 $('bankLabel').textContent=actor?'ФІШКИ · '+actor.name:'БАЛАНС';$('balance').textContent=fmt(actor?.balance??10000)+' фішок';$('balanceChange').replaceChildren();if(actor?.delta)$('balanceChange').append(deltaTag(actor.delta));
 $('betTotal').textContent=fmt(bets.reduce((a,b)=>a+b.amount,0));
 for(const b of document.querySelectorAll('.cell')){b.disabled=!mine||!open||busy;b.querySelector('.placed-chip')?.remove();b.classList.toggle('winner',state?.phase==='result'&&b.dataset.key==='n:'+state.result);const amount=bets.filter(x=>x.key===b.dataset.key).reduce((a,x)=>a+x.amount,0);if(amount){const c=document.createElement('span');c.className='placed-chip';c.textContent=amount>=1000?(amount/1000)+'k':amount;b.append(c);}}
 $('undo').disabled=$('clear').disabled=!mine||!open||busy||!bets.length;
 $('spin').disabled=busy||!mine||!ready||state?.phase==='spinning'||(open&&!bets.length);
 $('spin').textContent=!ready?'Завантаження фізики…':!state?'Крутити колесо ↗':!mine?'Спостерігаємо':state.phase==='result'?'Передати хід ↗':state.phase==='spinning'?'Кулька в грі…':'Крутити колесо ↗';
 $('pass').hidden=!mine||!open;$('pass').disabled=busy||bets.length>0;
 $('refill').hidden=!(me&&me.balance===0&&!me.bets.length&&state.phase!=='spinning');
 if(!state)return;
 $('roomLabel').textContent='Кімната '+code;$('round').textContent='Хід '+String(state.round).padStart(2,'0');$('phase').textContent=open?(mine?'ВАШ ХІД':'ХІД · '+actor.name):state.phase==='spinning'?'КРУТИТЬ · '+actor.name:'РЕЗУЛЬТАТ · '+actor.name;
 $('tableNote').textContent=mine&&open?'Оберіть фішку та поле ставки':`На столі ставки гравця ${actor.name}`;
 $('playerCount').textContent=state.players.length+' / 8';$('players').replaceChildren();
 for(const p of state.players){const el=document.createElement('div');el.className='player'+(p.id===state.turn?' current-player':'');const av=document.createElement('span');av.className='avatar';av.textContent=p.name.slice(0,1).toUpperCase();const info=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('small');name.textContent=p.name+(p.id===state.me?' · ви':'')+(p.id===state.turn?' · хід':'');detail.textContent=fmt(p.balance)+' фішок ';if(p.delta)detail.append(deltaTag(p.delta));info.append(name,detail);el.append(av,info);$('players').append(el);}
 $('history').replaceChildren();if(!state.history.length){const e=document.createElement('span');e.className='muted';e.textContent='Результат з’явиться після зупинки кульки';$('history').append(e);}for(const n of state.history){const e=document.createElement('span');e.className='history-number '+(n==='0'||n==='00'?'green':reds.has(+n)?'red':'');e.textContent=n;$('history').append(e);}
 $('ledger').replaceChildren();for(const e of [...state.ledger].reverse().slice(0,shownLedger)){const row=document.createElement('div');row.className='ledger-row';const desc=document.createElement('span');desc.textContent=e.name+' · '+e.reason;const bal=document.createElement('span');bal.textContent=fmt(e.balance);row.append(desc,deltaTag(e),bal);$('ledger').append(row);}$('moreLedger').hidden=state.ledger.length<=shownLedger;
 if(state.phase==='result'){
 $('wheelStatus').textContent=state.result===null?'Крутку скасовано, ставки повернуто.':`${actor.name}: випало ${state.result} · за хід ${signed(last?.net??0)} фішок`;
 const key=state.round+':'+state.result;if(lastToast!==key){lastToast=key;toast($('wheelStatus').textContent);}
 $('turnHint').textContent='Хід автоматично перейде наступному гравцю.';
 }else if(open){$('wheelStatus').textContent=mine?'Ваш хід. Зробіть ставку й запустіть колесо.':`${actor.name} робить ставки. Ви спостерігаєте.`;$('turnHint').textContent='Ходи по черзі · до 2 хвилин на ставки';}
 else $('turnHint').textContent='Результат визначиться після фізичної зупинки кульки';
}
const canvas=$('wheel'),ctx=canvas.getContext('2d'),tau=Math.PI*2,SCALE=380;
let lastDrawnFrame=null;
const walnut=new Image(),woodLayer=document.createElement('canvas');
woodLayer.width=900;woodLayer.height=900;let woodReady=false;
walnut.onload=()=>{
 const c=woodLayer.getContext('2d');c.translate(450,450);c.save();
 c.beginPath();c.arc(0,0,408,0,tau);c.arc(0,0,291,0,tau,true);c.clip('evenodd');
 c.drawImage(walnut,-408,-408,816,816);
 let sheen=c.createLinearGradient(-360,-360,350,370);
 sheen.addColorStop(0,'#fff5db00');sheen.addColorStop(.22,'#fff1d22e');sheen.addColorStop(.38,'#fff9df07');sheen.addColorStop(.65,'#09040116');sheen.addColorStop(1,'#09040166');
 c.fillStyle=sheen;c.fillRect(-408,-408,816,816);
 const depth=c.createRadialGradient(0,0,290,0,0,408);depth.addColorStop(0,'#160a06a6');depth.addColorStop(.18,'#160a0619');depth.addColorStop(.65,'#160a0600');depth.addColorStop(1,'#160a0655');c.fillStyle=depth;c.fillRect(-408,-408,816,816);
 c.restore();woodReady=true;draw(lastDrawnFrame);
};
walnut.src='/walnut-wood.png';
function circle(r,fill,stroke,width=1){ctx.beginPath();ctx.arc(0,0,r,0,tau);ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
function draw(frame){
 lastDrawnFrame=frame;
 ctx.clearRect(0,0,900,900);ctx.save();ctx.translate(450,450);
 let g=ctx.createRadialGradient(-110,-130,130,0,0,430);g.addColorStop(0,'#7f6240');g.addColorStop(.8,'#5b4026');g.addColorStop(.94,'#252c24');g.addColorStop(1,'#121b16');circle(429,g,'#93977b',3);
 g=ctx.createRadialGradient(0,0,287,0,0,407);g.addColorStop(0,'#6b4a2b');g.addColorStop(.4,'#b89253');g.addColorStop(.88,'#8f6837');g.addColorStop(1,'#49351f');circle(408,g,'#b7a67b',3);if(woodReady)ctx.drawImage(woodLayer,-450,-450);
 for(const r of [395,386,294]){ctx.beginPath();ctx.arc(0,0,r,0,tau);ctx.strokeStyle='#d2b57e66';ctx.lineWidth=3;ctx.stroke();}
 // These are the same fixed deflectors used by the physics world.
 for(const d of GEOMETRY.deflectors){ctx.save();ctx.translate(d.position[0]*SCALE,d.position[2]*SCALE);const q=d.rotation;ctx.rotate(-2*Math.atan2(q[1],q[3]));const w=.072*SCALE,h=.048*SCALE;ctx.fillStyle='#b8b9a1';ctx.shadowColor='#241d12';ctx.shadowBlur=4;ctx.fillRect(-w/2,-h/2,w,h);ctx.strokeStyle='#eee6c9';ctx.strokeRect(-w/2,-h/2,w,h);ctx.restore();}
 const q=frame?.rotation??{y:0,w:1},angle=-2*Math.atan2(q.y,q.w);ctx.save();ctx.rotate(angle);const step=tau/38;
 for(let i=0;i<38;i++){const a=i*step-Math.PI/2-step/2;ctx.beginPath();ctx.arc(0,0,.757*SCALE,a,a+step);ctx.arc(0,0,.565*SCALE,a+step,a,true);ctx.closePath();ctx.fillStyle=POCKETS[i]==='0'||POCKETS[i]==='00'?'#25705a':reds.has(+POCKETS[i])?'#a9403e':'#17221c';ctx.fill();ctx.strokeStyle='#c5b68d';ctx.lineWidth=2.5;ctx.stroke();if(frame?.result===POCKETS[i]){ctx.fillStyle='#ffe39966';ctx.fill();ctx.strokeStyle='#ffeca9';ctx.lineWidth=4;ctx.stroke();}ctx.save();ctx.rotate(i*step);ctx.font='700 28px Arial';ctx.fillStyle='#fff4d7';ctx.textAlign='center';ctx.shadowColor='#090b08';ctx.shadowBlur=2;ctx.fillText(POCKETS[i],0,-249);ctx.restore();}
 g=ctx.createRadialGradient(-65,-75,5,0,0,213);g.addColorStop(0,'#d2af6a');g.addColorStop(.5,'#b88a4b');g.addColorStop(1,'#8b6031');circle(214,g,'#e0c58a',3);
 for(let i=0;i<4;i++){ctx.save();ctx.rotate(i*Math.PI/2+.6);g=ctx.createLinearGradient(-10,0,10,0);g.addColorStop(0,'#646a5b');g.addColorStop(.5,'#efebd0');g.addColorStop(1,'#858b74');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(-8,-142,16,147,8);ctx.fill();ctx.restore();}circle(33,'#7e8570','#e2dfc2',3);circle(20,'#b7bba0','#efedcf',2);ctx.restore();
 if(frame){const p=frame.position,x=p.x*SCALE,z=p.z*SCALE,size=.023*SCALE;ctx.save();ctx.translate(x,z);ctx.shadowColor='#100c07';ctx.shadowBlur=5+Math.max(0,p.y)*16;ctx.shadowOffsetY=3;g=ctx.createRadialGradient(-3,-4,1,0,0,size);g.addColorStop(0,'#fff');g.addColorStop(.65,'#f0efd9');g.addColorStop(1,'#999b81');circle(size,g);ctx.restore();}
 ctx.restore();
}
function ensurePhysics(){if(!ready||!state?.spin?.id)return;if(simId===state.spin.id)return;sim?.free();sim=new RoulettePhysics(state.spin);simId=state.spin.id;clockOffset=state.clockEstimate-state.receivedAt;pending=null;submitting=false;if(!frameId)frameId=requestAnimationFrame(animate);}
let nextReport=0;
async function report(){if(submitting||performance.now()<nextReport||state?.phase!=='spinning'||!sim)return;submitting=true;const id=simId,proof=sim.proof();try{const s=await api('/api/rooms/'+code,{action:sim.failed?'void':'finish',spinId:id,proof,id:crypto.randomUUID()});if(simId===id)accept(s);}catch(e){nextReport=performance.now()+1500;$('connection').textContent='Очікуємо підтвердження результату…';}finally{submitting=false;}}
function animate(){
 frameId=0;if(!sim||!state?.spin)return;
 // Fixed steps only. Rendering cadence never changes the physics timestep.
 const wanted=Math.max(0,Math.floor((performance.now()+clockOffset-state.spin.startedAt)/(DT*1000)));
 for(let steps=0;sim.stepCount<wanted&&steps<180&&!sim.result&&!sim.failed;steps++)sim.step();
 const f=sim.frame();draw(f);
 if(state.phase==='spinning'){
 const r=Math.hypot(f.position.x,f.position.z);$('wheelStatus').textContent=f.failed?'Кулька не зупинилась у кишені. Повертаємо ставки…':f.result?`Кулька зупинилась: ${f.result}. Підтверджуємо…`:r>.9?'Кулька обертається зовнішньою доріжкою…':r>.76?'Кулька сходить з доріжки та відбивається…':'Кулька в кишенях. Чекаємо повної зупинки…';
 }
 canvas.setAttribute('aria-label',f.result?'Кулька фізично зупинилась на '+f.result:'Фізична крутка американської рулетки');
 if((f.result||f.failed)&&pending){const s=pending;pending=null;accept(s);}
 if(f.result||f.failed){if(state.phase==='spinning')report();}
 if(!f.result&&!f.failed||state.phase==='spinning')frameId=requestAnimationFrame(animate);
}
initPhysics().then(()=>{ready=true;ensurePhysics();render();}).catch(()=>{toast('Не вдалося завантажити фізичний рушій. Оновіть сторінку.');$('spin').textContent='Фізика недоступна';});
async function poll(){if(!state||busy||pollBusy)return;pollBusy=true;try{accept(await api('/api/rooms/'+code));$('connection').textContent='З’ЄДНАНО · ГРА ПО ЧЕРЗІ';}catch{$('connection').textContent='З’ЄДНАННЯ ПЕРЕРВАНО · ПОВТОРЮЄМО';}finally{pollBusy=false;}}
setInterval(poll,1000);draw(null);render();if(code){try{accept(await api('/api/rooms/'+code));}catch{$('lobby').showModal();}}else $('lobby').showModal();
