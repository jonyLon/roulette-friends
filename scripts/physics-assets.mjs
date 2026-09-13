import {writeFileSync,mkdirSync,readFileSync} from 'node:fs';
const f=n=>Math.fround(n), v=(x,y,z)=>[f(x),f(y),f(z)];
const ring=[]; const N=192;
// Solid closed race: shallow inward slope, outer retaining wall.
const profile=[[.765,.07],[1.04,.265],[1.04,.48],[1.085,.48],[1.085,-.08],[.765,-.08]];
for(let i=0;i<N;i++)for(let j=0;j<profile.length;j++){
 const a=i*2*Math.PI/N,b=(i+1)*2*Math.PI/N,k=(j+1)%profile.length;
 const p=([r,y],t)=>v(r*Math.sin(t),y,-r*Math.cos(t));
 ring.push(...p(profile[j],a),...p(profile[j],b),...p(profile[k],b),...p(profile[j],a),...p(profile[k],b),...p(profile[k],a));
}
const bars=Array.from({length:38},(_,i)=>{const a=(i+.5)*2*Math.PI/38;return {position:v(.655*Math.sin(a),.034,-.655*Math.cos(a)),rotation:[0,f(Math.sin(-a/2)),0,f(Math.cos(a/2))]};});
const deflectors=Array.from({length:12},(_,i)=>{const a=(i+.25)*2*Math.PI/12;return {position:v(.875*Math.sin(a),.07+(.875-.765)*(.195/.275)+.027,-.875*Math.cos(a)),rotation:[0,f(Math.sin((-a+Math.PI/4)/2)),0,f(Math.cos((-a+Math.PI/4)/2))]};});
writeFileSync('public/geometry.js','// Precomputed Float32 geometry: identical collider input on every platform.\nexport const GEOMETRY='+JSON.stringify({race:ring,bars,deflectors})+';\n');
mkdirSync('public/vendor',{recursive:true});writeFileSync('public/vendor/rapier.mjs',readFileSync('node_modules/@dimforge/rapier3d-compat/rapier.mjs'));
writeFileSync('public/vendor/NOTICE.txt','Rapier 3D 0.19.3 — Dimforge — Apache-2.0\nhttps://github.com/dimforge/rapier.js\n');
