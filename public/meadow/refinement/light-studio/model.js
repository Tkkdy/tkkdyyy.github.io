export const labels={base:'柔暮原版',A:'杏金夕照',B:'玫瑰薄暮',C:'窗前灯火'};
const base={key:3.18,sun:'#ffdab3',sky:'#a0a5d6',under:'#474664',fill:'#bdc6e8',skyPower:.93,fillPower:.38,angle:.31*180/Math.PI,elevation:Math.asin(.43)*180/Math.PI,shadow:.65,radius:6,tint:'#ffb887',bounce:0,distribution:'west',window:.24,haze:0,hazeTint:'#ff9272',galaxy:1,exposure:0,rolloff:0};
export const presets={base,
 A:{...base,key:2.66,sun:'#ffb876',sky:'#e5b7a9',under:'#554452',fill:'#ffd3a2',angle:.18*180/Math.PI,shadow:.52,radius:9,tint:'#ffb86f',bounce:.75,window:.29,haze:.115,hazeTint:'#ff9040',rolloff:.14},
 B:{...base,key:1.94,sun:'#ffbc9f',sky:'#f3c0cb',under:'#514253',fill:'#f7d1c7',angle:.30*180/Math.PI,shadow:.37,radius:9,tint:'#fdbab1',bounce:.73,distribution:'sky',window:.33,haze:.115,hazeTint:'#ff98b0',rolloff:.24},
 C:{...base,key:2.22,sun:'#ffd0aa',sky:'#bfabc2',under:'#4a414d',fill:'#f6c9a8',angle:.30*180/Math.PI,shadow:.55,radius:9,tint:'#ffaf61',bounce:1.6,distribution:'porch',window:1.14,rolloff:.14}
};
export const sections=[
 ['主光与阴影',[['key','主光强度',0,5,.01],['sun','主光颜色'],['angle','水平光向',-180,180,1,'°'],['elevation','光源仰角',3,80,1,'°'],['shadow','地面阴影浓度',0,1,.01],['radius','地面阴影柔度',1,15,.25],['exposure','整体曝光',-1.5,1.5,.05,' EV']]],
 ['反光与窗光',[['distribution','反光来源',{west:'夕阳侧光',sky:'整片天空',porch:'小屋门廊'}],['bounce','反光强度',0,2.5,.01],['tint','反光颜色'],['window','窗边反光',0,2.5,.01],['rolloff','高光柔化',0,.65,.01]]],
 ['天空与环境',[['skyPower','天光强度',0,2,.01],['sky','天光颜色'],['under','地面反射色'],['fillPower','补光强度',0,1.5,.01],['fill','补光颜色'],['haze','晚霞辉光',0,.55,.005],['hazeTint','晚霞颜色'],['galaxy','银河明度',.45,1.8,.01]]]
];
export const controls=sections.flatMap(([,items])=>items);
export function recipe(id='B'){return {format:'about-universe-light/1',preset:id,light:{...presets[id]},view:'default',yaw:0};}
export function parse(input){
 const value=typeof input==='string'?JSON.parse(input):input;
 if(!value||value.format!=='about-universe-light/1'||!Object.hasOwn(presets,value.preset)||!value.light)throw Error('不是此调光台的参数文件');
 const out=recipe(value.preset);
 for(const [id,label,range,max] of controls){
  const v=value.light[id];let valid;
  if(typeof range==='number')valid=Number.isFinite(v)&&v>=range&&v<=max;
  else if(range)valid=typeof v==='string'&&Object.hasOwn(range,v);
  else valid=typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
  if(!valid)throw Error('参数无效 · '+label);
  out.light[id]=v;
 }
 if(!['default','close','house'].includes(value.view)||!Number.isFinite(value.yaw))throw Error('机位参数无效');
 out.view=value.view;out.yaw=value.yaw;return out;
}
