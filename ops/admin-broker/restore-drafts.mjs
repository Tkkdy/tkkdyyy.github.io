/** Offline recovery into a NEW directory only. Never overwrites a live database. */
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {mkdir,copyFile,lstat,chmod} from 'node:fs/promises';import {join,resolve,isAbsolute} from 'node:path';import {constants} from 'node:fs';
export async function restoreDraftBackup(source,destination){
 if(!isAbsolute(source)||!isAbsolute(destination))throw Error('Use absolute paths');
 const stat=await lstat(source);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>268435456)throw Error('Unsafe backup');
 const original=new DatabaseSync(source,{readOnly:true});try{if(original.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Backup check failed');for(const table of ['drafts','history'])original.prepare('SELECT key,revision,payload,bytes,updated FROM '+table+' LIMIT 1').all();}finally{original.close();}
 await mkdir(destination,{mode:0o700});const target=join(destination,'drafts.sqlite');await copyFile(source,target,constants.COPYFILE_EXCL);await chmod(target,0o600);return target;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw Error();await restoreDraftBackup(process.argv[2],process.argv[3]);console.log('Backup checked and copied into a new directory. Runtime config was not changed.');}catch{console.error('Restore refused or failed. No existing database was overwritten.');process.exitCode=1;}
}
