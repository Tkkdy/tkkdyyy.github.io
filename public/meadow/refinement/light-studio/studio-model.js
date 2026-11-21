import {parse as parseLight,labels as oldLabels,presets as oldPresets} from './model.js';

const format='about-universe-light/2';
export const labels={approved:'已确认光照',...oldLabels};
const response=await fetch(new URL('./selected/meadow.json',import.meta.url));
if(!response.ok)throw Error('无法读取已确认的光照');
const approved=parseStudio(await response.json());
export const presets={approved:approved.light,...oldPresets};
export function firstLook(){
 return {...approved,light:{...approved.light}};
}
export function parseStudio(input){
 const v=typeof input==='string'?JSON.parse(input):input;
 if(v?.format==='about-universe-light/1'){
  return {...parseLight(v),format,scene:'classic',air:100};
 }
 if(v?.format!==format||!Object.hasOwn(labels,v.preset)||!['classic','meadow'].includes(v.scene)||
    !Number.isFinite(v.air)||v.air<0||v.air>200)throw Error('无效的场景或空气感参数');
 const light=parseLight({...v,format:'about-universe-light/1',preset:v.preset==='approved'?'base':v.preset});
 return {...light,format,preset:v.preset,scene:v.scene,air:v.air};
}
export function sceneRecipe(){
 return location.hash.length>1?parseStudio(decodeURIComponent(location.hash.slice(1))):firstLook();
}
