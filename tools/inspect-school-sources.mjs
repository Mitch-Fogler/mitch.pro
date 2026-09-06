const schools=['woodcreek','roseville','granitebay','antelope','westpark','oakmont'];
const clean=s=>s.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const result=await Promise.all(schools.map(async school=>{
 const url=`https://${school}.rjuhsd.us/about/${school==='antelope'?'bell-schedule':'bell-schedules'}`;
 const html=await(await fetch(url)).text();
 const tables=[...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(m=>({context:clean(html.slice(Math.max(0,m.index-1000),m.index)).slice(-400),rows:[...m[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map(r=>[...r[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(x=>clean(x[1])))}));
 const links=[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(x=>x[1]);
 return {school,url,tables,logos:links.filter(x=>/logo|crest|mascot/i.test(x)),css:links.filter(x=>/\.css/.test(x))};
}));
console.log(JSON.stringify(result));
