export const POCKETS=['0','28','9','26','30','11','7','20','32','17','5','22','34','15','3','24','36','13','1','00','27','10','25','29','12','8','19','31','18','6','21','33','16','4','23','35','14','2'];
export const DT=1/120;
export const ENGINE_VERSION='rapier-0.19.3-roulette-v1';
export function pocketAt(p,q){
 // Inverse Y rotation of the actual body position; never moves the ball.
 const c=1-2*q.y*q.y,s=2*q.y*q.w;
 const x=c*p.x-s*p.z,z=s*p.x+c*p.z;
 const r=Math.hypot(x,z);
 if(r<.57||r>.747||p.y>.074||p.y<.005)return null;
 const angle=(Math.atan2(x,-z)+Math.PI*2)%(Math.PI*2);
 const index=Math.round(angle/(Math.PI*2/38))%38;
 const distance=Math.abs(Math.atan2(Math.sin(angle-index*Math.PI*2/38),Math.cos(angle-index*Math.PI*2/38)));
 if(distance>Math.PI/38-.014)return null;
 return POCKETS[index];
}
