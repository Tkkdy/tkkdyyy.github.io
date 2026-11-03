/** One route mapping for repository items and private-draft recovery. */
export function editorLink(item,base='/') {
 const type=item.type,key=item.key||item.sourcePath||'';
 if(type==='SiteSettings')return base+'admin/recent/';
 const route=type==='Image'?'admin/photos/edit/':type==='Project'?'admin/content/':'admin/stories/new/';
 return base+route+'?'+(key.startsWith('src/content/')?'source':'draft')+'='+encodeURIComponent(key);
}
