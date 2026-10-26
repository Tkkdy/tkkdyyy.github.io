/** Metadata-only receipts. Not an authentication token: fresh owner cookie/CSRF is mandatory. */
import {hkdfSync,createHmac,timingSafeEqual} from 'node:crypto';
import {permittedPath,requirePolicy} from './policy.mjs';
const REPO='Tkkdy/tkkdyyy.github.io',ID=1355866312,OWNER=144055705,SHA=/^[a-f0-9]{40}$/;
export function validateWorkspaceSnapshot(s){
 requirePolicy(s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).every(k=>['state','branch','baseSha','headSha','commits','paths','pullRequestNumber','url'].includes(k)),'恢复记录字段不允许。');
 requirePolicy(['EDITING','PULL_REQUEST_OPEN'].includes(s.state)&&/^codex\/cms-proposal-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(s.branch||''),'恢复分支或状态不允许。');
 requirePolicy(SHA.test(s.baseSha||'')&&SHA.test(s.headSha||'')&&Array.isArray(s.commits)&&s.commits.length<=30&&s.commits.every(c=>SHA.test(c)&&c!==s.baseSha)&&new Set(s.commits).size===s.commits.length,'恢复版本清单无效。');
 requirePolicy(s.headSha===(s.commits.at(-1)??s.baseSha),'恢复head与提交清单不符。');
 requirePolicy(Array.isArray(s.paths)&&s.paths.length<=64&&s.paths.every(permittedPath)&&new Set(s.paths).size===s.paths.length&&(s.commits.length===0?s.paths.length===0:s.paths.length>0),'恢复文件清单无效。');
 if(s.state==='PULL_REQUEST_OPEN')requirePolicy(s.commits.length>0&&Number.isSafeInteger(s.pullRequestNumber)&&s.pullRequestNumber>0&&s.url==='https://github.com/'+REPO+'/pull/'+s.pullRequestNumber,'恢复PR身份无效。');
 else requirePolicy(!Object.hasOwn(s,'pullRequestNumber')&&!Object.hasOwn(s,'url'),'编辑记录不能携带PR身份。');
 return structuredClone(s);
}
export function createWorkspaceRecovery(config){return createSignedRecovery({...config,domain:'cms-workspace-v1',salt:'editorial-cms-recovery-v1',field:'workspace',validate:validateWorkspaceSnapshot});}
export function createSignedRecovery({clientId,clientSecret,domain,salt,field,validate}){
 requirePolicy(typeof clientId==='string'&&clientId.length>0&&typeof clientSecret==='string'&&clientSecret.length>0,'缺少恢复签名配置。');
 // Dedicated derived key, domain separated from OAuth and bound to this App/repository/owner.
 // No new GitHub credentials are generated or stored. Same approved App can verify on backup origin.
 const key=Buffer.from(hkdfSync('sha256',clientSecret,salt,JSON.stringify([clientId,REPO,ID,OWNER]),32));
 const mac=encoded=>createHmac('sha256',key).update(domain+'.'+encoded).digest();
 return {
  seal(snapshot){if(snapshot===null)return null;const payload=Buffer.from(JSON.stringify({schema:1,clientId,repository:REPO,repositoryId:ID,ownerId:OWNER,[field]:validate(snapshot)})).toString('base64url');const receipt=payload+'.'+mac(payload).toString('base64url');requirePolicy(receipt.length<=32000,'恢复记录过大。');return receipt;},
  open(receipt){
   requirePolicy(typeof receipt==='string'&&receipt.length<=32000&&/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(receipt),'恢复记录格式错误。');
   const [encoded,signature]=receipt.split('.'),body=Buffer.from(encoded,'base64url'),sig=Buffer.from(signature,'base64url');
   requirePolicy(body.toString('base64url')===encoded&&sig.toString('base64url')===signature&&sig.length===32&&timingSafeEqual(sig,mac(encoded)),'恢复记录签名不符或签名配置已变化。');
   const p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));
   requirePolicy(p.schema===1&&p.clientId===clientId&&p.repository===REPO&&p.repositoryId===ID&&p.ownerId===OWNER&&Object.keys(p).length===6,'恢复记录身份不符。');return validate(p[field]);
  },
 };
}
