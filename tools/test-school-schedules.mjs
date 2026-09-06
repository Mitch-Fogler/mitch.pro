import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{}};vm.createContext(context);
for(const file of ['webserver/bell/schedule.js','webserver/rjuhsd-assets/calendar.js'])vm.runInContext(readFileSync(file,'utf8'),context);
const {RJUHSD_CALENDAR:calendar,RJUHSD_SCHOOL_DATA:schools}=context.window;
for(const school of Object.keys(schools)){
 const normal=calendar.resolve(school,'2026-09-08');
 assert(normal.inSession,school);
 assert(!calendar.resolve(school,'2026-09-07').inSession);
 assert(!calendar.resolve(school,'2027-03-29').inSession);
 assert(!calendar.resolve(school,'2026-09-12').inSession);
 assert(calendar.resolve(school,'2026-09-09').type==='late');
 for(const type of Object.keys(schools[school].specials))assert(calendar.resolve(school,'2026-09-08',[],type).inSession,school+' '+type);
 assert(calendar.resolve(school,'2026-09-08',[{date:'2026-09-08',title:'Minimum Day'}]).type==='minimum');
 assert(calendar.resolve(school,'2026-09-08',[{date:'2026-09-08',title:'Modified bell schedule'}]).unavailable);
 assert(!normal.lunch1.some(p=>p.name==='Period 0'));
 for(const pair of [...Object.values(schools[school].days),...Object.values(schools[school].specials)])for(const blocks of Object.values(pair)){
  let end='00:00';for(const p of blocks){assert(p.start>=end,school+' '+p.name);assert(p.end>p.start);end=p.end;}
 }
 assert(readFileSync('webserver'+schools[school].logo).length>1000);
}
let count=0;
for(let date=new Date(calendar.district.start+'T12:00:00Z');date.toISOString().slice(0,10)<=calendar.district.end;date.setUTCDate(date.getUTCDate()+1))if(calendar.resolve('woodcreek',date.toISOString().slice(0,10)).inSession)count++;
assert.equal(count,180,'District instructional days');
console.log('PASS: six schools, all published schedule variants, district 180-day calendar, closures, optional period zero, and logos.');
