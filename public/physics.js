import RAPIER from './vendor/rapier.mjs';
import {GEOMETRY} from './geometry.js';
import {DT,ENGINE_VERSION,pocketAt} from './physics-shared.js';
let ready;
export function initPhysics(){return ready??=RAPIER.init();}
const vec=a=>({x:a[0],y:a[1],z:a[2]});
const quat=a=>({x:a[0],y:a[1],z:a[2],w:a[3]});
const length=v=>Math.hypot(v.x,v.y,v.z);
export class RoulettePhysics{
 constructor(launch){
  this.deflectors=launch.deflectors!==false;
  this.world=new RAPIER.World({x:0,y:-9.81,z:0});
  this.world.timestep=DT;this.world.integrationParameters.maxCcdSubsteps=4;
  this.world.integrationParameters.numSolverIterations=8;
  this.stepCount=0;this.stable=0;this.result=null;this.failed=false;this.contacts=0;this.laps=0;this.lastAngle=0;
  this.events=new RAPIER.EventQueue(true);this.deflectorHandles=new Set();
  const vertices=new Float32Array(GEOMETRY.race),indices=Uint32Array.from({length:vertices.length/3},(_,i)=>i);
  this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices,RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(.006).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min).setRestitution(0).setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min));
  for(const d of this.deflectors?GEOMETRY.deflectors:[]){const c=this.world.createCollider(RAPIER.ColliderDesc.cuboid(.036,.022,.024).setTranslation(...d.position).setRotation(quat(d.rotation)).setFriction(.18).setRestitution(.48).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS));this.deflectorHandles.add(c.handle);}
  this.wheel=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().lockTranslations().enabledRotations(false,true,false).setRotation(launch.wheelRotation??{x:0,y:0,z:0,w:1}).setAngvel({x:0,y:launch.wheelSpeed,z:0}).setAngularDamping(.32).setCanSleep(true));
  this.world.createCollider(RAPIER.ColliderDesc.cylinder(.015,.757).setFriction(.55).setRestitution(.14).setDensity(45),this.wheel);
  this.world.createCollider(RAPIER.ColliderDesc.cone(.125,.565).setTranslation(0,.13,0).setFriction(.15).setRestitution(.22),this.wheel);
  for(const d of GEOMETRY.bars)this.world.createCollider(RAPIER.ColliderDesc.cuboid(.0045,.031,.101).setTranslation(...d.position).setRotation(quat(d.rotation)).setFriction(.4).setRestitution(.3),this.wheel);
  this.ball=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,.261,-.987).setLinvel(launch.ballSpeed,0,launch.radialSpeed).setAngularDamping(.35).setLinearDamping(.16).setCcdEnabled(true).setCanSleep(true));
  this.ballCollider=this.world.createCollider(RAPIER.ColliderDesc.ball(.023).setMass(.018).setFriction(.18).setRestitution(.36).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),this.ball);
 }
 step(){
  if(this.result!==null||this.failed)return;
  this.world.step(this.events);this.stepCount++;
  this.events.drainCollisionEvents((a,b,started)=>{if(started&&(a===this.ballCollider.handle||b===this.ballCollider.handle)&& (this.deflectorHandles.has(a)||this.deflectorHandles.has(b)))this.contacts++;});
  const p=this.ball.translation(),a=Math.atan2(p.x,-p.z);
  this.laps+=Math.atan2(Math.sin(a-this.lastAngle),Math.cos(a-this.lastAngle))/(2*Math.PI);this.lastAngle=a;
  const pocket=pocketAt(p,this.wheel.rotation());
  const quiet=this.ball.isSleeping()&&this.wheel.isSleeping()&&length(this.ball.linvel())<.008&&length(this.ball.angvel())<.15&&length(this.wheel.angvel())<.006;
  this.stable=pocket!==null&&quiet?this.stable+1:0;
  if(this.stable>=120){this.result=pocket;}
  if(this.stepCount>=120*75||p.y<-.3||Math.hypot(p.x,p.z)>1.2)this.failed=true;
 }
 frame(){return {position:this.ball.translation(),rotation:this.wheel.rotation(),ballRotation:this.ball.rotation(),result:this.result,step:this.stepCount,contacts:this.contacts,laps:this.laps,failed:this.failed};}
 proof(){return {...this.frame(),ballSpeed:length(this.ball.linvel()),ballAngularSpeed:length(this.ball.angvel()),wheelSpeed:length(this.wheel.angvel()),stable:this.stable,engine:ENGINE_VERSION,deflectors:this.deflectors};}
 free(){this.events.free();this.world.free();}
}



