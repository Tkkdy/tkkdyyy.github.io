// @ts-check
import {defineConfig} from 'astro/config';
const raw=process.env.ADMIN_SITE_URL;
let site;
try{site=new URL(raw||'');if(site.origin!==raw||site.username||site.password||!(['https:'].includes(site.protocol)||site.protocol==='http:'&&['127.0.0.1','localhost'].includes(site.hostname)))throw Error();}catch{throw Error('[build:admin] ADMIN_SITE_URL must be a pure HTTPS origin or HTTP loopback origin.');}
// Private artifact: serve ONLY behind ops/admin-broker/server.mjs, never upload as public website.
export default defineConfig({site:site.origin,base:'/',outDir:'./dist-admin',output:'static',trailingSlash:'always',vite:{define:{'import.meta.env.VPS_PREVIEW':'true'}}});
