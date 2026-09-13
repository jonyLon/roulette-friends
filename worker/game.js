export const RED = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
export function payout(key, result) {
  const n=Number(result), zero=result==='0'||result==='00';
  if(key.startsWith('n:')) return key.slice(2)===result ? 36 : 0;
  if(zero) return 0;
  if(key==='red') return RED.includes(n)?2:0;
  if(key==='black') return !RED.includes(n)?2:0;
  if(key==='even') return n%2===0?2:0;
  if(key==='odd') return n%2===1?2:0;
  if(key==='low') return n<=18?2:0;
  if(key==='high') return n>=19?2:0;
  if(key.startsWith('dozen:')) return Math.ceil(n/12)===Number(key.slice(6))?3:0;
  if(key.startsWith('col:')) return (n-1)%3+1===Number(key.slice(4))?3:0;
  return 0;
}
export const validKey=k=>/^(n:(00|[0-9]|[12][0-9]|3[0-6])|red|black|even|odd|low|high|dozen:[123]|col:[123])$/.test(k);
export function freshRoom(code){return {code,players:[],host:null,round:1,phase:'betting',ends:0,result:null,history:[],last:[],requests:[]};}
export function settle(s,now){
 if(s.phase==='spinning'&&now>=s.ends){s.phase='result';s.last=s.players.map(p=>{const stake=p.bets.reduce((a,b)=>a+b.amount,0);const won=p.bets.reduce((a,b)=>a+b.amount*payout(b.key,s.result),0);p.balance+=won;p.bets=[];return {id:p.id,stake,won};});s.history.unshift(s.result);s.history=s.history.slice(0,16);}
}
export function act(s,token,body,now=Date.now(),random=()=>{const a=new Uint32Array(1);do{crypto.getRandomValues(a)}while(a[0]>=4294967296-4294967296%38);return a[0]%38;}){
 settle(s,now);
 if(body.id&&s.requests.includes(body.id))return s;
 let p=s.players.find(p=>p.token===token);
 if(body.action==='join'){
   if(!p){if(s.players.length>=8)throw Error('У кімнаті вже 8 гравців.');const name=String(body.name||'').trim().slice(0,24);if(!name)throw Error('Введіть своє ім’я.');p={id:crypto.randomUUID(),token,name,balance:10000,bets:[]};s.players.push(p);s.host??=p.id;}
 }else{
 if(!p)throw Error('Спершу увійдіть до кімнати.');
 if(body.action==='bet'){
 if(s.phase!=='betting')throw Error('Ставки на цей раунд закрито.');
 if(!validKey(body.key)||![10,50,100,500,1000].includes(body.amount))throw Error('Некоректна ставка.');
 if(p.balance<body.amount)throw Error('Недостатньо фішок.');if(p.bets.length>=100)throw Error('Ліміт — 100 ставок за раунд.');
 p.balance-=body.amount;p.bets.push({key:body.key,amount:body.amount});
 }else if(body.action==='undo'||body.action==='clear'){
 if(s.phase!=='betting')throw Error('Ставки на цей раунд закрито.');const removed=body.action==='undo'?p.bets.splice(-1):p.bets.splice(0);p.balance+=removed.reduce((a,b)=>a+b.amount,0);
 }else if(body.action==='spin'){
 if(p.id!==s.host)throw Error('Колесо запускає господар кімнати.');if(s.phase!=='betting')throw Error('Раунд уже розпочато.');if(!s.players.some(p=>p.bets.length))throw Error('Зробіть хоча б одну ставку.');const n=random();s.result=n===37?'00':String(n);s.phase='spinning';s.ends=now+8000;
 }else if(body.action==='next'){
 if(p.id!==s.host)throw Error('Новий раунд починає господар.');if(s.phase!=='result')throw Error('Дочекайтеся результату.');s.phase='betting';s.result=null;s.round++;
 }else if(body.action==='refill'){
 if(p.balance!==0||p.bets.length||s.phase==='spinning')throw Error('Поповнення доступне, коли фішки закінчилися.');p.balance=10000;
 }else throw Error('Невідома дія.');
 }
 if(body.id){s.requests.push(body.id);s.requests=s.requests.slice(-256);}return s;
}
export function publicState(s,token){const me=s.players.find(p=>p.token===token);if(!me)throw Error('Ця кімната потребує входу.');return {...s,requests:undefined,me:me.id,serverTime:Date.now(),result:s.phase==='spinning'?null:s.result,players:s.players.map(({token,...p})=>p)};}
