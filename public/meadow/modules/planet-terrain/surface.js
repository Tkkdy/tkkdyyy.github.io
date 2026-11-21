import {CONFIG as C} from './config.js';
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const sub=(a,b)=>a.map((x,i)=>x-b[i]);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>{const d=Math.hypot(...a);return a.map(x=>x/d)};
export function directionFromUV(u,v){const d=Math.hypot(u,v),s=d?Math.sin(d/12)/d:1/12;return [u*s,Math.cos(d/12),v*s]}
export function uvFromDirection(n){const p=norm(n),d=Math.hypot(p[0],p[2]);if(d<1e-12&&p[1]<0)throw RangeError('South antipode has no v1 local chart');const a=12*Math.acos(clamp(p[1],-1,1));return d?[a*p[0]/d,a*p[2]/d]:[0,0]}
export function curve(points,count){return Array.from({length:count+1},(_,j)=>{const q=j/count*(points.length-1),i=Math.min(points.length-2,Math.floor(q)),t=q-i;return [0,1].map(k=>{const a=points[Math.max(0,i-1)][k],b=points[i][k],c=points[i+1][k],d=points[Math.min(points.length-1,i+2)][k];return .5*(2*b+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)})})}
export const riverLine=curve(C.river,128),pathLine=curve(C.path,80);
export function nearest(line,u,v){let best={distance:Infinity,t:0};for(let i=0;i<line.length-1;i++){const a=line[i],b=line[i+1],du=b[0]-a[0],dv=b[1]-a[1],f=clamp(((u-a[0])*du+(v-a[1])*dv)/(du*du+dv*dv)),x=a[0]+du*f,y=a[1]+dv*f,d=Math.hypot(u-x,v-y);if(d<best.distance)best={distance:d,t:(i+f)/(line.length-1),u:x,v:y}}return best}
export const waterStage=t=>1.18-1.70*smooth(0,.94,t)-.03*t;
export const channelWidth=t=>.29+.18*t;
function basin(u,v){
 const bayAngle=Math.atan2((v-5.1)/3.2,(u+3.8)/4.3);
 const seaAngle=Math.atan2((v-11)/8,(u+7)/8);
 const a=(Math.hypot((u+3.8)/4.3,(v-5.1)/3.2)-1)*3.2
   +.21*Math.sin(3*bayAngle+.4)+.095*Math.sin(7*bayAngle-1.1);
 const b=(Math.hypot((u+7)/8,(v-11)/8)-1)*8
   +.30*Math.sin(4*seaAngle-.5)+.14*Math.sin(7*seaAngle+.8);
 const h=clamp(.5+.5*(b-a)/1.5);
 return mix(b,a,h)-1.5*h*(1-h);
}
export function bedrock(u,v){
 let lift=0,exposure=0;
 for(const shelf of C.shelves){
  const du=u-shelf.u,dv=v-shelf.v,c=Math.cos(shelf.angle),s=Math.sin(shelf.angle);
  const x=(du*c+dv*s)/shelf.along,y=(-du*s+dv*c)/shelf.across;
  const envelope=Math.exp(-1.8*(x*x+y*y));
  // Rounded shoulders and broad broken strata, not detached sphere/rock props.
  const ribs=.77+.16*Math.cos(y*8+x*2)+.07*Math.sin(x*9-y*3);
  lift+=shelf.lift*envelope*ribs;
  exposure=Math.max(exposure,envelope);
 }
 return {lift,exposure};
}
const hill=(u,v,x,y,sx,sy)=>Math.exp(-(((u-x)/sx)**2+((v-y)/sy)**2));
export function designFeatures(u,v){return {river:nearest(riverLine,u,v),path:nearest(pathLine,u,v),coast:basin(u,v)}}
// Authoring field only. Public sampling never evaluates this instead of the mesh.
export function designHeight(u,v,n=directionFromUV(u,v),f=designFeatures(u,v)){
 let h=.08+.16*Math.sin(n[0]*5+n[2]*3)*Math.cos(n[1]*4)+.07*Math.sin(n[2]*9+n[0]*4);
 const local=1-smooth(23,30,Math.hypot(u,v));
 if(!local)return h;
 h+=local*(1.46*hill(u,v,4.5,-6.3,3.8,3.5)+.68*hill(u,v,-6,-5,4,3)+.48*hill(u,v,6.2,1.1,3.5,4.5));
 h=mix(h,-1.2+.04*Math.sin(u*.9+v*.5),1-smooth(-1.15,1.1,f.coast));
 const rock=bedrock(u,v);
 // Sculpt before the channel/rigid-site passes; those remain authoritative.
 h+=rock.lift*smooth(-.65,.20,f.coast)*smooth(.48,1.05,f.path.distance);
 const meadowRelief=.055*Math.sin(u*1.1+Math.sin(v*.7))*.5
   +.035*Math.sin(v*2.0+u*.6);
 h+=meadowRelief*smooth(.3,1.6,f.coast)*smooth(.5,1.1,f.path.distance);
 const r=f.river,w=channelWidth(r.t),depth=waterStage(r.t)-.27;
 h=mix(h,Math.max(h,waterStage(r.t)+.23), (1-smooth(w+.3,w+1.65,r.distance))*(1-smooth(.83,.99,r.t)));
 h=mix(h,mix(depth,Math.min(h,depth),smooth(.83,.99,r.t)),1-smooth(w*.58,w+.42,r.distance));
 // A subtle path depression is below the protected rigid tangent planes.
 h-=.035*(1-smooth(.23,.48,f.path.distance));
 const house=C.house,rect=(Math.abs((u-house.u)/house.halfWidth)**8+Math.abs((v-house.v)/house.halfDepth)**8)**.125;
 const hw=1-smooth(.94,1.38,rect),hd=dot(n,directionFromUV(house.u,house.v));
 if(hw>0&&hd>.5)h=mix(h,(12+house.height)/hd-12,hw);
 const tree=C.tree,td=Math.hypot(u-tree.u,v-tree.v),tw=1-smooth(tree.radius,tree.radius+.95,td),nd=dot(n,directionFromUV(tree.u,tree.v));
 if(tw>0&&nd>.5)h=mix(h,(12+tree.height)/nd-12,tw);
 // Preserve the complete rigid cottage footprint where its shoulder meets the root apron.
 const footprint=1-smooth(.90,.98,rect);
 if(footprint>0&&hd>.5)h=mix(h,(12+house.height)/hd-12,footprint);
 return h;
}
let cached;
export function meshData(){
 if(cached)return cached;
 const {sectors:S,fineRings:F,outerRings:O,fineRadius:D}=C.mesh,rings=[0];
 for(let i=1;i<=F;i++)rings.push(D*i/F);
 for(let i=1;i<O;i++)rings.push(D+(Math.PI*12-D)*i/O);
 rings.push(Math.PI*12);
 const positions=[],uv=[],heights=[],indices=[],cells=[];
 const add=(d,a)=>{const u=d*Math.cos(a),v=d*Math.sin(a),n=d===Math.PI*12?[0,-1,0]:directionFromUV(u,v),h=designHeight(u,v,n);positions.push(...n.map(x=>x*(12+h)));uv.push(u,v);heights.push(h)};
 add(0,0);for(let k=1;k<rings.length-1;k++)for(let j=0;j<S;j++)add(rings[k],j/S*2*Math.PI);add(Math.PI*12,0);
 const last=positions.length/3-1,id=(k,j)=>k===0?0:k===rings.length-1?last:1+(k-1)*S+(j+S)%S;
 const p=i=>positions.slice(i*3,i*3+3);
 const tri=(a,b,c)=>{if(dot(cross(sub(p(b),p(a)),sub(p(c),p(a))),p(a))<0)[b,c]=[c,b];const index=indices.length/3;indices.push(a,b,c);return index};
 for(let k=0;k<rings.length-1;k++){cells[k]=[];for(let j=0;j<S;j++){const a=id(k,j),b=id(k,j+1),c=id(k+1,j),d=id(k+1,j+1);cells[k][j]=k===0?[tri(a,c,d)]:k===rings.length-2?[tri(a,c,b)]:[tri(a,c,b),tri(b,c,d)]}}
 cached={positions:new Float32Array(positions),uv:new Float32Array(uv),heights:new Float32Array(heights),indices:new Uint32Array(indices),rings,cells,sectors:S};return cached;
}
function hitTriangle(data,ti,n){const ids=[0,1,2].map(k=>data.indices[ti*3+k]),p=ids.map(i=>Array.from(data.positions.subarray(i*3,i*3+3))),ab=sub(p[1],p[0]),ac=sub(p[2],p[0]),N=cross(ab,ac),den=dot(N,n);if(Math.abs(den)<1e-12)return null;const radius=dot(N,p[0])/den,q=n.map(x=>x*radius),v=sub(q,p[0]),aa=dot(ab,ab),bb=dot(ac,ac),cc=dot(ab,ac),det=aa*bb-cc*cc,b=(dot(v,ab)*bb-dot(v,ac)*cc)/det,c=(dot(v,ac)*aa-dot(v,ab)*cc)/det;if(b< -1e-7||c< -1e-7||b+c>1+1e-7)return null;return {height:radius-12,position:q,normal:norm(N),triangle:ti}}
export function meshHit(u,v){const d=Math.hypot(u,v);if(!Number.isFinite(d)||d>=Math.PI*12-.1)throw RangeError('Outside surface v1 north chart');const data=meshData(),n=directionFromUV(u,v),a=(Math.atan2(v,u)+Math.PI*2)%(Math.PI*2),j=Math.floor(a/(Math.PI*2)*data.sectors);let lo=0,hi=data.rings.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(data.rings[m]<=d)lo=m;else hi=m}
 // The chord between equal-latitude vertices bows slightly; include adjacent rings.
 for(const k of [lo,lo-1,lo+1])if(data.cells[k])for(const dj of [0,-1,1])for(const ti of data.cells[k][(j+dj+data.sectors)%data.sectors]){const hit=hitTriangle(data,ti,n);if(hit)return {...hit,direction:n}}
 throw Error(`No mesh intersection ${u},${v}`);
}
export function sample(u,v){const s=meshHit(u,v),f=designFeatures(u,v),r=f.river;const riverWet=r.distance<channelWidth(r.t)*1.6+1.2*smooth(.85,.98,r.t)&&s.height<waterStage(r.t);return {u,v,height:s.height,position:s.position,direction:s.direction,zones:{wet:s.height<C.seaLevel||riverWet,sea:s.height<C.seaLevel,river:riverWet,path:f.path.distance<.43,protectedHouse:Math.abs(u-C.house.u)<C.house.halfWidth&&Math.abs(v-C.house.v)<C.house.halfDepth,protectedTree:Math.hypot(u-C.tree.u,v-C.tree.v)<C.tree.radius,riverDistance:r.distance,pathDistance:f.path.distance}}}
export function frame(u,v){const h=meshHit(u,v),s=sample(u,v),e=.001,dx=sub(directionFromUV(u+e,v),directionFromUV(u-e,v)),east=norm(sub(dx,h.normal.map(x=>x*dot(dx,h.normal)))),south=norm(cross(east,h.normal));return {...s,normal:h.normal,east,south}}
export const surface=Object.freeze({version:1,revision:C.revision,radius:12,directionFromUV,uvFromDirection,sample,frame});
let shore;
// Intersect every mesh edge with the exact sea-radius sphere, then stitch the
// triangle segments. These are the actual rendered coast, not an ellipse proxy.
export function shorelineCurves(){if(shore)return shore;const data=meshData(),edgePoints=new Map(),adj=new Map(),R=12+C.seaLevel,p=i=>Array.from(data.positions.subarray(i*3,i*3+3));
 const edge=(a,b)=>{const key=a<b?`${a}:${b}`:`${b}:${a}`;if(!edgePoints.has(key)){let A=p(a),B=p(b),wet=Math.hypot(...A)<R;for(let n=0;n<42;n++){const m=A.map((x,k)=>(x+B[k])/2);if((Math.hypot(...m)<R)===wet)A=m;else B=m}const q=A.map((x,k)=>(x+B[k])/2),[u,v]=uvFromDirection(q);edgePoints.set(key,[u,v,meshHit(u,v).height])}return key};
 const link=(a,b)=>{if(!adj.has(a))adj.set(a,[]);adj.get(a).push(b)};
 for(let i=0;i<data.indices.length;i+=3){const ids=Array.from(data.indices.subarray(i,i+3)),keys=[];for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3];if((Math.hypot(...p(a))<R)!==(Math.hypot(...p(b))<R))keys.push(edge(a,b))}if(keys.length===2){link(keys[0],keys[1]);link(keys[1],keys[0])}}
 const visited=new Set(),loops=[];for(const start of adj.keys()){if(visited.has(start))continue;const loop=[];let prev=null,current=start;do{visited.add(current);loop.push(edgePoints.get(current));const next=adj.get(current)?.find(x=>x!==prev);prev=current;current=next;if(!current)throw Error('Open shoreline')}while(current!==start&&!visited.has(current));if(current!==start)throw Error('Nonmanifold shoreline');loop.push(loop[0]);loops.push(loop)}shore=loops.sort((a,b)=>b.length-a.length);return shore;
}
function shoreDistance(u,v){const distance=Math.min(...shorelineCurves().map(line=>nearest(line,u,v).distance));return meshHit(u,v).height<C.seaLevel?-distance:distance}
export function riverSamples(){return riverLine.map(([u,v],i)=>{const t=i/(riverLine.length-1);return Object.freeze({t,u,v,waterHeight:waterStage(t),bedHeight:meshHit(u,v).height,halfWidth:channelWidth(t)*.69})})}
export const hydrology=Object.freeze({version:1,surfaceRevision:C.revision,seaLevel:C.seaLevel,get river(){return riverSamples()},radialPoint:(u,v,h)=>directionFromUV(u,v).map(x=>x*(12+h)),shoreline:Object.freeze({status:'FINAL_SAMPLED',signedDistance:shoreDistance})});
