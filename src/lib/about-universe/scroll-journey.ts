import { smooth, clamp } from './camera';
import type { UniverseScene } from './scene';

export function createJourney(root: HTMLElement, scene: Pick<UniverseScene,'setProgress'|'suspend'>) {
  const stage = root.querySelector<HTMLElement>('.universe-stage')!;
  const website = root.querySelector<HTMLElement>('[data-word="website"]')!;
  const me = root.querySelector<HTMLElement>('[data-word="me"]')!;
  const and = root.querySelector<HTMLElement>('[data-word="and"]')!;
  const prefixes = [...root.querySelectorAll<HTMLElement>('[data-prefix]')];
  const captions = [...root.querySelectorAll<HTMLElement>('[data-caption]')];
  const title = root.querySelector<HTMLElement>('.universe-title')!;
  const cue = root.querySelector<HTMLElement>('[data-scroll-cue]')!;
  const inner=root.querySelector<HTMLElement>('[data-inner-chapter]')!;
  const deeper=root.querySelector<HTMLAnchorElement>('[data-deeper-cue]')!;
  const back=root.querySelector<HTMLAnchorElement>('[data-return-chapters]')!;
  let progress=0,origin=0,range=1,frame=0,disposed=false;
  let measurements: { element: HTMLElement; x: number; y: number; startX: number; startY: number; prefixWidth: number }[] = [];
  const measure = () => {
    me.style.textTransform = website.style.textTransform = 'none';
    me.style.transform=website.style.transform='none';
    origin=root.getBoundingClientRect().top+scrollY;range=Math.max(1,root.offsetHeight-stage.offsetHeight);
    const box = stage.getBoundingClientRect();
    const font = getComputedStyle(me).font;
    for (const prefix of prefixes) {prefix.style.font = font;prefix.style.transform = 'none';}
    measurements = [me, website].map((element, index) => {
      const initial = element.getBoundingClientRect(), prefix = prefixes[index];
      const prefixWidth = prefix.getBoundingClientRect().width;
      const finalScale = innerWidth < 600 ? 1.15 : 1.25;
      const totalWidth = prefixWidth * finalScale + 12 + initial.width * finalScale;
      const center = box.width * (innerWidth < 600 ? 0.43 : 0.45);
      const top = box.height * (index === 0 ? 0.34 : 0.65);

      return { element, x: center - totalWidth / 2 + prefixWidth * finalScale + 12 - (initial.left - box.left), y: top - (initial.top - box.top),
        startX: initial.left - box.left, startY: initial.top - box.top, prefixWidth };
    });
  };
  let covered=false,previousTotal=-1;
  const render = () => {
    const total=clamp(progress*7.9/5),p=clamp(total/0.48),depth=clamp((total-0.55)/0.40);
    const fullyCovered=progress>7.05/7.9;
    if(fullyCovered!==covered){covered=fullyCovered;scene.suspend(covered);}
    const exit=clamp((progress*7.9-4.9)/2.55);
    if(total===previousTotal){if(!covered)scene.setProgress(p,depth,exit);return;}
    previousTotal=total;
    const departure=1-smooth(depth/0.38);
    const innerOpacity=smooth((depth-0.54)/0.29);
    inner.style.opacity=String(innerOpacity);inner.inert=innerOpacity<0.45;inner.setAttribute('aria-hidden',String(innerOpacity<0.45));
    deeper.style.opacity=String(smooth((total-0.39)/0.08)*(1-smooth(depth/0.16)));
    deeper.inert=total<0.43||depth>0.12;
    root.dataset.innerProgress=depth.toFixed(4);root.dataset.chapterProgress=p.toFixed(4);
    root.dataset.innerActive=String(depth>0.18);
    root.querySelector<HTMLElement>('.universe-copy')!.style.opacity=String(departure);
    const split = smooth((p - 0.13) / 0.65);
    const scale = 1 + split * (innerWidth < 600 ? 0.15 : 0.25);
    for(const item of measurements){
      item.element.style.transformOrigin='left top';
      item.element.style.transform=`translate3d(${item.x*split}px,${item.y*split}px,0) scale(${scale})`;
    }
    and.style.opacity=String(1-smooth((p-.16)/.26));and.style.transform=`translateY(${24*split}px)`;
    title.style.setProperty('--journey-opacity',String(1-smooth(p/.25)));
    title.style.transform=`translate(-50%,${-65*p}px) scale(${1-p*.08})`;
    cue.style.setProperty('--journey-opacity',String(1-smooth(p/.22)));
    measurements.forEach((item,index)=>{
      const el=prefixes[index];el.style.left='0';el.style.top='0';el.style.transformOrigin='left top';
      el.style.transform=`translate3d(${item.startX+item.x*split-item.prefixWidth*scale-12}px,${item.startY+item.y*split}px,0) scale(${scale})`;
      el.style.opacity=String(smooth((p-.41)/.32));
    });
    for(const el of captions){el.style.opacity=String(smooth((p-.63)/.25));el.style.transform=`translateY(${12*(1-split)}px)`;}
    me.style.textTransform = website.style.textTransform = p > 0.55 ? 'capitalize' : 'none';
    root.dataset.progress = total.toFixed(4);
    if(!covered)scene.setProgress(p,depth,exit);
  };
  function draw(){frame=0;progress=clamp((scrollY-origin)/range);render()}
  function queue(){if(!frame)frame=requestAnimationFrame(draw)}
  function resize(){if(disposed)return;measure();previousTotal=-1;queue()}
  measure();draw();
  addEventListener('scroll',queue,{passive:true});addEventListener('resize',resize);
  const cueClick = (event: Event) => {
    event.preventDefault();
    go(0.48);
  };
  function go(progress:number){window.scrollTo({top:root.offsetTop+(root.offsetHeight-innerHeight)*progress*5/7.9,behavior:'smooth'});}
  const goDeeper=(event:Event)=>{event.preventDefault();go(0.95);};
  const goBack=(event:Event)=>{event.preventDefault();go(0.49);};
  cue.addEventListener('click', cueClick);deeper.addEventListener('click',goDeeper);back.addEventListener('click',goBack);
  void document.fonts.ready.then(resize);
  return () => { deeper.removeEventListener('click',goDeeper);back.removeEventListener('click',goBack);inner.style.opacity='';inner.inert=false;inner.removeAttribute('aria-hidden');deeper.style.opacity='';deeper.inert=false;root.querySelector<HTMLElement>('.universe-copy')!.style.opacity='';delete root.dataset.innerActive;delete root.dataset.innerProgress;cue.removeEventListener('click', cueClick); disposed=true;removeEventListener('scroll',queue);removeEventListener('resize',resize);cancelAnimationFrame(frame);
    for(const el of [website,me,and,title,cue,...prefixes,...captions]){el.style.transform='';el.style.opacity='';el.style.removeProperty('--journey-opacity')}
    for(const prefix of prefixes){prefix.style.left='';prefix.style.top='';prefix.style.font='';}
    me.style.textTransform = website.style.textTransform = ''; };
}
