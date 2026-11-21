import {attachJourney as original} from '../visual-r1/a-composition/journey.js';
export function attachJourney(ctx){
 if(!ctx.compositionLayer)return original(ctx);
 const {compositionLayer,debug,invalidate,signal}=ctx;
 const update=()=>{const p=Math.max(0,Math.min(1,scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)));compositionLayer.applyJourney(p,innerWidth,innerHeight);debug.journey={progress:p,position:ctx.camera.position.toArray(),worldScale:ctx.world.scale.toArray()};const caption=document.querySelector('#journey-caption');if(caption)caption.textContent=p<.28?'银河深处，一盏暖灯':p<.72?'沿着海岸，慢慢靠近':'小屋、花树，与风中的草甸';invalidate();};
 addEventListener('scroll',update,{passive:true,signal});addEventListener('resize',update,{signal});
 for(const b of document.querySelectorAll('[data-progress]'))b.addEventListener('click',()=>scrollTo({top:Number(b.dataset.progress)*(document.documentElement.scrollHeight-innerHeight),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}),{signal});
 debug.syncJourney=update;update();return()=>{if(debug.syncJourney===update)delete debug.syncJourney;};
}
