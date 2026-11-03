import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const source=Buffer.from(await readFile('src/lib/flavor-selection.mjs')).toString('base64');
const report={scope:'Real browser device-local dates in two timezones; northern meteorological season display convention',checks:[]};
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
try{
 for(const timezoneId of ['Asia/Shanghai','America/Los_Angeles']){
  const context=await browser.newContext({timezoneId}),page=await context.newPage();
  const result=await page.evaluate(async source=>{
   const {localContext,choosePhoto}=await import('data:text/javascript;base64,'+source);
   const pool=[{id:'summer',seasons:['summer']},{id:'autumn',seasons:['autumn']}];
   return [new Date(2026,7,31,23,59),new Date(2026,8,1,0,0)].map(date=>{const c=localContext(date);return{...c,selected:choosePhoto(pool,c,'',()=>.5).id};});
  },source);
  assert.deepEqual(result,[{time:'night',season:'summer',selected:'summer'},{time:'late-night',season:'autumn',selected:'autumn'}]);
  report.checks.push({timezoneId,august31toSeptember1:result});await context.close();
 }
 report.state='PASS';
}finally{await browser.close();await writeFile('docs/flavor-review/season-browser-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
