for(const school of ['woodcreek','roseville','granitebay','antelope','westpark','oakmont']){
 const origin=`https://${school}.rjuhsd.us`,html=await(await fetch(origin)).text();
 console.log(JSON.stringify({school,colors:html.match(/--(?:primary|secondary)-color: #[a-fA-F0-9]+/g),image:[...html.matchAll(/<img\b[^>]+>/g)][0]?.[0]}));
}
const h=await(await fetch('https://www.rjuhsd.us/resources/school-calendars')).text();
console.log(h.match(/.{0,300}2026.{0,300}/g));
