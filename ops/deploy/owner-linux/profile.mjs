import {requireCheck as check} from '../public-baseline/diagnostics.mjs';
export const IMAGE='mcr.microsoft.com/playwright@sha256:d65108d1a8095d8b0c4a5e32bf1807a40a5ce90ff0c78473e1116b1c243235e8';
export const CANDIDATE='d3b094b33d246ebebce03a897ded8b5970545e3a0413f862cd796165a54d823d';
export function profile(config,owner){
 if(!owner)return {scope:'READ_ONLY_LIVE_PREVIEW_BASELINE',count:115,manifestHash:config.baselineManifestSha256,canonical:'https://preview.boenbot.top/',htmlNoindex:true,httpNoindex:()=>true,smoke:true};
 check(config.enabled===true&&config.scope==='OWNER_LINUX_OBSERVATION'&&config.attemptId==='2026102900000006','Disabled or invalid owner request','IDENTITY_FAILURE');
 check(['guarded','indexable'].includes(config.phase)&&/^[a-f0-9]{64}$/.test(config.challengeSha256||'')&&/^owner-0006-(guarded|indexable)-[a-f0-9]{24}$/.test(config.requestId||'')&&config.requestId.includes('-'+config.phase+'-'),'Invalid challenge/phase','IDENTITY_FAILURE');
 check(config.candidateManifestSha256===CANDIDATE&&/^[a-f0-9]{40}$/.test(config.observerCodeCommit||''),'Invalid candidate/code identity','IDENTITY_FAILURE');
 check(config.expectedNode==='24.19.0'&&config.expectedPlaywright==='1.64.1'&&config.expectedChrome==='156.0.8078.4','Runtime expectation drift','IDENTITY_FAILURE');
 check(Number.isInteger(config.expiresEpoch)&&Date.now()/1000<config.expiresEpoch&&config.expiresEpoch<=Date.now()/1000+3600,'Expired owner observation','IDENTITY_FAILURE');
 check(config.phase==='guarded'?config.previousEvidence===null:!!config.previousEvidence&&/^[a-f0-9]{64}$/.test(config.previousEvidence.reportSha256||'')&&Number.isSafeInteger(config.previousEvidence.runId),'Missing or unexpected phase chain','IDENTITY_FAILURE');
 return {scope:config.phase==='guarded'?'OWNER_GUARDED_PUBLIC_ACCEPTANCE':'OWNER_INDEXABLE_PUBLIC_ACCEPTANCE',count:116,manifestHash:CANDIDATE,canonical:'https://tkkdy.me/',htmlNoindex:false,httpNoindex:base=>base==='https://preview.boenbot.top/'||config.phase==='guarded',smoke:config.phase==='indexable'};
}
export function ownerSuccess(config){return {phase:config.phase,attemptId:config.attemptId,challengeSha256:config.challengeSha256,observerCodeCommit:config.observerCodeCommit,previousEvidence:config.previousEvidence,canonical:true,searchAndClick:true,desktop:true,mobile:true,oldDomainNoindex:true,newDomainNoindex:config.phase==='guarded',pagesIndependent:true,editorEntry:true,friends:true,fullManifest:true,indexable:config.phase==='indexable',searchAnd404Noindex:true};}
