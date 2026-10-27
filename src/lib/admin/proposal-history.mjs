const prefix='editorial-studio:proposal-v1:';
export function proposalRecords(storage){
 const keys=Object.keys(storage).filter(k=>k.startsWith(prefix));if(keys.length>50)throw Error('提案记录过多，请保留导出文件并人工核对。');
 return keys.map(key=>{const raw=storage.getItem(key);if(!raw||raw.length>33000)throw Error('本地提案记录损坏，未覆盖原记录。');const r=JSON.parse(raw);if(!Number.isSafeInteger(r.number)||r.number<1||typeof r.receipt!=='string'||r.receipt.length>32000)throw Error('本地提案记录无效。');return r;});
}
export function rememberProposal(proposal,storage){
 const r={number:proposal.pullRequestNumber,receipt:proposal.recoveryReceipt};
 if(!Number.isSafeInteger(r.number)||r.number<1||typeof r.receipt!=='string'||r.receipt.length>32000)throw Error('缺少有效提案恢复记录。');
 const key=prefix+r.number,old=storage.getItem(key),value=JSON.stringify(r);
 if(old&&old!==value)throw Error('未覆盖同一提案的不同本地记录，请保留当前导出。');
 if(!old&&Object.keys(storage).filter(k=>k.startsWith(prefix)).length>=50)throw Error('提案本地记录已满，请保留当前导出。');
 storage.setItem(key,value);return r;
}
