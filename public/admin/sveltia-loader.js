// Static hosting cannot hold the authenticated broker. Load CMS only on a logged-in editor origin.
const message=document.querySelector('[data-cms-message]');
try{
 const response=await fetch('/api/session',{credentials:'same-origin',cache:'no-store'});
 const session=response.ok?await response.json():null;
 if(!session?.authenticated)throw Error('Login required');
 const script=document.createElement('script');script.src='./vendor/sveltia-cms-0.164.2.js';script.integrity="sha384-8jh4ZuqWt5C7gHKiGgd+Ywoy7eALhOiKhUKx/m6KhUXgomY4Jx6Wf+j++aBPeOhf";script.onerror=()=>{message.textContent='编辑器加载失败，草稿仍保留在浏览器中。';};document.body.append(script);message.hidden=true;
}catch{message.textContent='请在受保护的编辑站登录后使用 CMS。VPS 不可用时，可使用独立本地编辑服务；历史草稿可通过“草稿迁移”导出、导入。';}
