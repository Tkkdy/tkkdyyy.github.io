import DOMPurify from 'dompurify';
import { rewriteContentUrl } from '../content-url.mjs';
/** Only for browser-side editor/preview input. Public rendering has a separate policy. */
export function sanitizeAdminHtml(html) {
 return DOMPurify.sanitize(html,{USE_PROFILES:{html:true},ALLOW_DATA_ATTR:false,ADD_ATTR:['data-callout'],FORBID_TAGS:['style','form','input','button','textarea','select','iframe','object','embed','link','meta','base'],FORBID_ATTR:['style','id','name']});
}
export function inertPreviewDocument(html,styles,variant,base,basePath='/'){
 const sanitized=sanitizeAdminHtml(html),document=new DOMParser().parseFromString(sanitized,'text/html');
 for(const element of document.querySelectorAll('[href],[src],[poster]'))for(const attribute of ['href','src','poster']){
  const value=element.getAttribute(attribute);if(value&&!/^(?:data:|blob:|#)/i.test(value))element.setAttribute(attribute,new URL(rewriteContentUrl(value,{base:basePath}),base).href);
 }
 const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const links=styles.map(href=>'<link rel="stylesheet" href="'+escape(href)+'">').join('');
 const csp="default-src 'none'; img-src https: http: data: blob:; media-src https: http:; style-src 'unsafe-inline' https: http:; font-src https: http:; connect-src 'none'; form-action 'none'; base-uri 'none'";
 return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="'+escape(csp)+'">'+links+'</head><body><div class="story-body '+escape(variant)+'">'+document.body.innerHTML+'</div></body></html>';
}
