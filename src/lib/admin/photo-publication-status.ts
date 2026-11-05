import {readAdminSession,createGitHubClient} from './github-content.mjs';
import {proposalStatusView,deploymentStatusView} from './publication-status.mjs';
const panels=new WeakMap<HTMLElement,Set<string>>();
/** Read the existing proposal/deployment APIs; never create or merge a proposal here. */
export function showPhotoPublication(root:HTMLElement,url:string){
 const match=url.match(/^https:\/\/github\.com\/Tkkdy\/tkkdyyy\.github\.io\/pull\/([1-9][0-9]*)$/);if(!match)return;
 const section=root.querySelector<HTMLElement>('[data-photo-publications]'),list=root.querySelector('[data-photo-publication-list]');if(!section||!list)return;
 let known=panels.get(root);if(!known){known=new Set();panels.set(root,known);}if(known.has(url))return;known.add(url);section.hidden=false;
 const panel=document.createElement('article');panel.className='photo-publication';
 const heading=document.createElement('div'),link=document.createElement('a'),refresh=document.createElement('button');link.href=url;link.textContent='发布记录 #'+match[1];refresh.type='button';refresh.textContent='刷新进度';heading.append(link,refresh);
 const summary=document.createElement('p'),detail=document.createElement('p'),targets=document.createElement('p');summary.setAttribute('role','status');detail.className='photo-publication-detail';targets.className='photo-publication-detail';panel.append(heading,summary,detail,targets);list.append(panel);
 async function check(){refresh.disabled=true;summary.textContent='正在核对发布进度……';
  try{const auth=await readAdminSession(),github=createGitHubClient({owner:'Tkkdy',repo:'tkkdyyy.github.io',branch:auth.branch,csrf:auth.csrf});const proposal=await github.proposalStatus(Number(match![1]));
   const view=proposal.state==='MERGED_ON_MAIN'?deploymentStatusView(await github.deploymentStatus(proposal.mergedSha)):proposalStatusView(proposal);
   panel.dataset.state=view.state;summary.textContent=view.summary.replaceAll('稿件','照片');detail.textContent=view.detail.replaceAll('稿件','照片');
   targets.textContent=(view.targets||[]).map((target:{target:string;text:string})=>(target.target==='vps'?'主站':'GitHub Pages')+'：'+target.text).join(' · ');
  }catch{panel.dataset.state='attention';summary.textContent='暂时无法核对上线进度';detail.textContent='照片的发布记录仍保留，请刷新进度或打开发布记录。';targets.textContent='';}
  finally{refresh.disabled=false;}
 }
 refresh.addEventListener('click',()=>void check());void check();
}
