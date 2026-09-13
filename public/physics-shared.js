export const POCKETS=['0','28','9','26','30','11','7','20','32','17','5','22','34','15','3','24','36','13','1','00','27','10','25','29','12','8','19','31','18','6','21','33','16','4','23','35','14','2'];
export const DT=1/120;
export const ENGINE_VERSION='rapier-0.19.3-roulette-v2';
export function pocketAt(p,q){
 // Inverse Y rotation of the actual body position; never moves the ball.
 const c=1-2*q.y*q.y,s=2*q.y*q.w;
 const x=c*p.x-s*p.z,z=s*p.x+c*p.z;
 const r=Math.hypot(x,z);
 // The floor extends underneath the sloped hub. A resting sphere's centre
 // can legitimately be below r=.57 (e.g. r=.56786), so a guessed inner
 // annulus rejects real pockets. Check floor support and cone clearance.
 const floorTop=.015, ballRadius=.023, floorRadius=.757;
 const coneSlope=.25/.565, coneApex=.255;
 const tolerance=.004; // Rapier contact penetration, not an angular snap.
 if(r>floorRadius||Math.abs(p.y-(floorTop+ballRadius))>tolerance)return null;
 const coneClearance=(p.y+coneSlope*r-coneApex)/Math.hypot(1,coneSlope);
 if(coneClearance<ballRadius-tolerance)return null;
 const angle=(Math.atan2(x,-z)+Math.PI*2)%(Math.PI*2);
 const index=Math.round(angle/(Math.PI*2/38))%38;
 const distance=Math.abs(Math.atan2(Math.sin(angle-index*Math.PI*2/38),Math.cos(angle-index*Math.PI*2/38)));
 if(distance>Math.PI/38-.014)return null;
 return POCKETS[index];
}
