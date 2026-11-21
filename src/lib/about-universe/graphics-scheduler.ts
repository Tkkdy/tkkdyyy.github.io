// Let compositor scrolling take priority over starting a new graphics context.
// Already-running scenes keep their normal animation and resolution.
let busyUntil=0,previousY=scrollY,previousAt=performance.now();
const mark=()=>busyUntil=performance.now()+220;
addEventListener('wheel',e=>{if(Math.abs(e.deltaY)*(e.deltaMode===1?16:1)>=24)mark()},{passive:true});
addEventListener('scroll',()=>{
  const now=performance.now();
  if(Math.abs(scrollY-previousY)>Math.max(12,(now-previousAt)*.95))mark();
  previousY=scrollY;previousAt=now;
},{passive:true});
export function waitForGraphics(signal:AbortSignal,eligible=()=>true,initialDelay=0):Promise<void>{
  const earliest=performance.now()+initialDelay;
  return new Promise(resolve=>{
    let timer=0;
    const finish=()=>{
      clearTimeout(timer);
      removeEventListener('scroll',check);removeEventListener('resize',check);
      document.removeEventListener('visibilitychange',check);signal.removeEventListener('abort',finish);
      resolve();
    };
    function check(){
      clearTimeout(timer);
      if(signal.aborted)return finish();
      const remaining=Math.max(busyUntil,earliest)-performance.now();
      if(remaining>0)timer=window.setTimeout(check,remaining+1);else if(!document.hidden&&eligible())finish();
    }
    addEventListener('scroll',check,{passive:true});addEventListener('resize',check);
    document.addEventListener('visibilitychange',check);signal.addEventListener('abort',finish,{once:true});
    check();
  });
}
