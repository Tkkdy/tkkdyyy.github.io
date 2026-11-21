import {cameraAt,project,smooth} from './camera';
import {distantBodies,celestialNodes} from './entities';
import {passageSky} from './passage-sky';
import backgrounds from './backgrounds.json';
// Use the original paintings at native asset resolution while the GPU is starting.
// Text, buttons, chapter lengths and camera progress are owned by the live journey.
export function paintedEntry(root:HTMLElement){
  const q=(s:string)=>root.querySelector<HTMLElement>(s)!;
  const art=q('.universe-art'),hero=q('.universe-art picture'),deep=q('[data-entry-deep]') as HTMLImageElement;
  const inner=q('[data-entry-inner]') as HTMLImageElement,orbit=q('[data-entry-orbit]'),moon=q('.universe-static-moon');
  const nodes=celestialNodes.map(n=>q('[data-node="'+n.id+'"]'));
  const place=(el:HTMLElement,x:number,y:number,w:number,h:number)=>{
    // Keep decoded surfaces at a stable size; move and zoom compositor layers.
    el.style.transform='translate3d('+(x-w/2)+'px,'+(y-h/2)+'px,0) scale('+w/baseW+','+h/baseH+')';
  };
  let baseW=1,baseH=1,lastViewportW=0,lastViewportH=0;
  function update(p:number,depth:number,departure:number){
    if(innerWidth!==lastViewportW||innerHeight!==lastViewportH){
      baseW=art.clientWidth;baseH=art.clientHeight;if(!baseW||!baseH)return;
      art.dataset.posed='';lastViewportW=innerWidth;lastViewportH=innerHeight;
      const w=baseW,h=baseH;
      for(const el of [hero,deep,orbit,moon]){el.style.width=w+'px';el.style.height=h+'px';el.style.transformOrigin='0 0'}
    }
    const w=baseW,h=baseH;
    const dive=smooth(depth),advance=smooth(departure),camera=cameraAt(p,1.04*(1+dive*2.8));
    const pos=project({x:0,y:0,z:6000},camera,w,h),ratio=backgrounds.output.width/backgrounds.output.height;
    const sw=Math.max(w,h*ratio)*1.06*pos.scale*6,sh=sw/ratio;
    hero.style.visibility=depth>.64?'hidden':'';deep.style.visibility=hero.style.visibility;
    if(depth<=.64)place(hero,pos.x,pos.y,sw,sh);
    const t=backgrounds.deep.transform;
    if(p>.20&&!deep.hasAttribute('src'))deep.src=(w<650?root.dataset.skyDetailPreview:root.dataset.skyDetailSrc)!;
    place(deep,pos.x+(t.a/2+t.c/2+t.tx-.5)*sw,pos.y+(t.b/2+t.d/2+t.ty-.5)*sh,sw*t.a,sh*t.d);
    deep.style.opacity=String(smooth((p-backgrounds.transition.start)/(backgrounds.transition.end-backgrounds.transition.start)));
    if(depth>0&&!inner.hasAttribute('src'))inner.src=(w<650?root.dataset.innerSkySmall:root.dataset.innerSky)!;
    inner.style.opacity=String(smooth((depth-.14)/.49));
    const path=passageSky(w,h,departure);
    inner.style.transform='translate('+path.oldX*w+'px,'+path.oldY*h+'px) rotate('+path.turn+'rad) scale('+((1.08+dive*.14)*path.departureZoom)+')';
    const orig=project(distantBodies[1].position,cameraAt(p,1.04),w,h);
    const farRadius=distantBodies[1].radius*2*orig.scale*(w<600?3.2:4.8),distance=1-2.4*advance,scale=1/Math.max(.055,distance);
    const x=w*.54+(orig.x+(w*(w<600?.19:.23)-orig.x)*dive-w*.54-w*(w<600?1.55:.50)*advance)*scale;
    const y=h*.42+(orig.y+(h*(w<600?.73:.63)-orig.y)*dive-h*.42)*scale;
    const diameter=(farRadius+(Math.min(w*(w<600?.94:.45),h*.72)-farRadius)*dive)*scale;
    orbit.hidden=depth<=0||distance<=0||x+.86*diameter<0;
    if(!orbit.hidden){place(orbit,x,y,diameter,diameter);orbit.style.opacity=String(smooth(depth/.2))}
    const m=project({x:w<600?.66:.62,y:w<600?-.68:-.49,z:2250},camera,w,h);
    const moonSize=Math.min(w<600?76:110,h*.13)*m.scale*2.25;place(moon,m.x,m.y,moonSize,moonSize);moon.style.opacity=String(1-smooth((p-.30)/.28));
    nodes.forEach((button,i)=>{const n=project(celestialNodes[i].position,camera,w,h);button.style.left=n.x+'px';button.style.top=n.y+'px';button.hidden=depth>.16});
  }
  function dispose(){
    delete art.dataset.posed;
    for(const layer of [hero,deep,inner,orbit,moon])for(const property of ['width','height','transform','transform-origin','opacity','visibility'])layer.style.removeProperty(property);
    orbit.hidden=true;
  }
  return {update,dispose};
}
