/** One grouping/label contract for Content Collections, the editor and local draft preview. */
export const FRAME_DISPLAYS=['information','date','description'];
export function validateAlbumFields(data){
 if(data.series!==undefined&&(typeof data.series!=='string'||!data.series.trim()||data.series.length>120))throw Error('相簿名称须为 1–120 个字符。');
 if(data.albumCover!==undefined&&typeof data.albumCover!=='boolean')throw Error('相簿主图标记无效。');
 if(data.albumCover&&!data.series?.trim())throw Error('请先填写相簿名称，再设为相簿主图。');
 if(data.frameDisplay!==undefined&&!FRAME_DISPLAYS.includes(data.frameDisplay))throw Error('相纸信息类型无效。');
 if(data.frameDescription!==undefined&&(typeof data.frameDescription!=='string'||data.frameDescription.length>240))throw Error('物品描述最多 240 个字符。');
 if(data.status==='published'&&data.frameDisplay==='date'&&!data.capturedAt)throw Error('选择日期展示时，请填写真实拍摄日期。');
 if(data.status==='published'&&data.frameDisplay==='description'&&!data.frameDescription?.trim())throw Error('选择物品描述时，请填写描述。');
 return data;
}
export function frameText(photo){
 if(photo.frameDisplay==='date'){
  if(!photo.capturedAt)return '';
  const value=photo.capturedAt instanceof Date?photo.capturedAt.toISOString():String(photo.capturedAt);
  return /^\d{4}-\d{2}-\d{2}/.test(value)?value.slice(0,10).replaceAll('-','.'):'';
 }
 if(photo.frameDisplay==='description')return String(photo.frameDescription||'').trim();
 return String(photo.caption||photo.title||photo.alt||'').trim();
}
export function groupPhotoAlbums(photos){
 const groups=new Map();
 for(const photo of photos){const series=typeof photo.series==='string'?photo.series.trim():'';const key=series?'series:'+series:'photo:'+photo.id;let group=groups.get(key);if(!group){group={key,title:series||photo.title||'单张照片',photos:[]};groups.set(key,group);}group.photos.push(photo);}
 return [...groups.values()].map(group=>{const covers=group.photos.filter(p=>p.albumCover);if(covers.length>1)throw Error('相簿「'+group.title+'」有多张主图，请只保留一张。');if(covers.length){group.photos=[covers[0],...group.photos.filter(p=>p!==covers[0])];}return group;});
}
