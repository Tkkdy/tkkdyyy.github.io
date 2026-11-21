/** Screen-space routes: varied origins, slopes and lengths; never depend on pointer input. */
export function nextMeteor(random:()=>number,index:number) {
  const right=index%2===0,up=index%5===4;
  return {
    x:right?0.08+random()*0.42:0.49+random()*0.42,
    y:up?0.52+random()*0.20:0.09+random()*0.43,
    dx:(right?1:-1)*(0.16+random()*0.23),
    dy:(up?-1:1)*(0.055+random()*(index%3===0?0.08:0.21)),
    tail:65+random()*100,duration:1100+random()*1000,
    opacity:0.38+random()*0.23,tint:random()>0.5?0xf1dfcb:0xd9dffa,
  };
}
