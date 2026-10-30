/** Private SQLite state, outside both the repository and static artifact. No GitHub I/O. */
import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,lstat,realpath,readdir,rename,unlink,chmod} from 'node:fs/promises';
import {resolve,relative,join,isAbsolute,dirname} from 'node:path';
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
export function draftKey(key){if(typeof key!=='string'||key.length>250||!(/^(?:draft-[a-zA-Z0-9-]{8,}|(?:article|essay|fragment)-[\p{L}\p{N}_-]+)$|^src\/content\/(articles|essays|fragments|projects|images)\/[\p{L}\p{N}][\p{L}\p{N}_.-]{0,180}\.md$/u.test(key)))fail(400,'草稿标识无效。');return key;}
async function regular(path){try{const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink())throw Error('Unsafe private file');}catch(e){if(e.code!=='ENOENT')throw e;}}
export async function openDraftStore({directory,forbiddenRoots=[],maxBytes=64*1024*1024,maxDraftBytes=12*1024*1024,maxDrafts=200}={}){
 if(!isAbsolute(directory||'')||!Number.isSafeInteger(maxBytes)||maxBytes<1024)throw Error('Invalid private storage');
 const root=resolve(directory);
 for(const other of forbiddenRoots){const rel=relative(resolve(other),root);if(!rel||!rel.startsWith('..')&&!isAbsolute(rel))throw Error('Private drafts must stay outside repository and static root');}
 // Inspect existing parents too, so an ancestor symlink cannot redirect the private directory.
 let parent=root;while(true){try{if((await lstat(parent)).isSymbolicLink())throw Error('Private path contains symlink');}catch(e){if(e.code!=='ENOENT')throw e;}const next=dirname(parent);if(next===parent)break;parent=next;}
 await mkdir(root,{recursive:true,mode:0o700});await chmod(root,0o700);
 if(await realpath(root)!==root)throw Error('Private storage resolution changed');
 const path=join(root,'drafts.sqlite');for(const suffix of ['','-wal','-shm'])await regular(path+suffix);
 const db=new DatabaseSync(path);await chmod(path,0o600);
 db.exec(`PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; PRAGMA secure_delete=ON; PRAGMA max_page_count=65536;
 CREATE TABLE IF NOT EXISTS drafts(key TEXT PRIMARY KEY,revision INTEGER NOT NULL,payload TEXT NOT NULL,bytes INTEGER NOT NULL,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS history(key TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,bytes INTEGER NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(key,revision));`);
 let tail=Promise.resolve(),closed=false;
 function serial(fn){const result=tail.then(()=>{if(closed)throw Error('Store closed');return fn();});tail=result.catch(()=>{});return result;}
 const read=key=>{draftKey(key);const r=db.prepare('SELECT * FROM drafts WHERE key=?').get(key);return r?{key:r.key,revision:r.revision,updatedAt:r.updated,state:JSON.parse(r.payload)}:null;};
 function save(key,state,expectedRevision){
  draftKey(key);if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)fail(400,'缺少草稿版本。');
  if(!state||typeof state!=='object'||Array.isArray(state))fail(400,'草稿内容无效。');
  // No credentials, receipts or arbitrary metadata may be persisted in a draft envelope.
  const fields=new Set(['id','title','deck','body','bodyBlocks','editorVersion','type','status','slug','categories','tags','publishedAt','updatedAt','showOnHomepage','featured','cover','coverAlt','publishNumber','sourcePath','sourceBlobSha','rawContent','publication']);
  if(Object.keys(state).some(k=>!fields.has(k)))fail(400,'草稿包含不允许的字段。');
  const payload=JSON.stringify(state),bytes=Buffer.byteLength(payload);if(bytes>maxDraftBytes)fail(413,'单篇草稿含图片超过12 MiB，请缩小图片。');
  db.exec('BEGIN IMMEDIATE');try{
   const old=db.prepare('SELECT * FROM drafts WHERE key=?').get(key);if((old?.revision??0)!==expectedRevision)fail(409,'另一台设备已保存新版本，请先处理冲突。');
   const count=db.prepare('SELECT COUNT(*) AS n FROM drafts').get().n;if(!old&&count>=maxDrafts)fail(507,'私有草稿数量已满。');
   const revision=(old?.revision??0)+1,updated=new Date().toISOString();
   if(old)db.prepare('INSERT INTO history VALUES(?,?,?,?,?)').run(key,old.revision,old.payload,old.bytes,old.updated);
   db.prepare('DELETE FROM history WHERE key=? AND revision < ?').run(key,revision-3);
   db.prepare('INSERT OR REPLACE INTO drafts VALUES(?,?,?,?,?)').run(key,revision,payload,bytes,updated);
   const used=db.prepare('SELECT (SELECT COALESCE(SUM(bytes),0) FROM drafts)+(SELECT COALESCE(SUM(bytes),0) FROM history) AS n').get().n;
   if(used>maxBytes)fail(507,'私有草稿空间已满；请导出并清理不需要的草稿。');
   db.exec('COMMIT');return read(key);
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 return {
  read:key=>serial(()=>read(key)),
  list:()=>serial(()=>db.prepare('SELECT key,revision,payload,updated FROM drafts ORDER BY updated DESC').all().map(r=>{const s=JSON.parse(r.payload);return{key:r.key,revision:r.revision,updatedAt:r.updated,title:s.title||'未命名草稿',type:s.type||'',sourcePath:s.sourcePath||'',id:s.id};})),
  save:(...args)=>serial(()=>save(...args)),
  history:key=>serial(()=>{draftKey(key);return db.prepare('SELECT revision,updated,bytes FROM history WHERE key=? ORDER BY revision DESC').all(key);}),
  restore:(key,revision,expected)=>serial(()=>{draftKey(key);const h=db.prepare('SELECT payload FROM history WHERE key=? AND revision=?').get(key,revision);if(!h)fail(404,'没有此恢复版本。');return save(key,JSON.parse(h.payload),expected);}),
  remove:(key,expected)=>serial(()=>{const old=read(key);if(!old||old.revision!==expected)fail(409,'草稿版本变化。');db.exec('BEGIN IMMEDIATE');try{db.prepare('DELETE FROM history WHERE key=?').run(key);db.prepare('DELETE FROM drafts WHERE key=?').run(key);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}}),
  backup:()=>serial(async()=>{const dir=join(root,'backups');await mkdir(dir,{recursive:true,mode:0o700});if((await lstat(dir)).isSymbolicLink())throw Error('Unsafe backup directory');const temp=join(dir,'snapshot.tmp');await regular(temp);await backup(db,temp);await chmod(temp,0o600);const name=new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite';await rename(temp,join(dir,name));const names=(await readdir(dir)).filter(n=>/^[-0-9TZ]+\.sqlite$/.test(n)).sort();for(const old of names.slice(0,-3))await unlink(join(dir,old));return {name};}),
  async close(){await tail;closed=true;db.close();}
 };
}
