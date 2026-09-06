import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync('server.js','utf8');
const context={decodeHtmlEntities:s=>s};vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function parseSchoolCalendar('),source.indexOf('const schoolInfoCache =')),context);
const paths={woodcreek:'calendar',roseville:'school-calendar',granitebay:'calendar',antelope:'antelope-hs-calendar',westpark:'panther-calendar',oakmont:'calendar'};
await Promise.all(Object.entries(paths).map(async([school,path])=>{
 const response=await fetch(`https://${school}.rjuhsd.us/${path}`);
 assert(response.ok,school);
 const events=context.parseSchoolCalendar(await response.text());
 assert(events.length>0,school+' calendar empty');
 assert(events.every(e=>/^\d{4}-\d{2}-\d{2}$/.test(e.date)));
 console.log(school+': '+events.length+' official calendar events');
}));
