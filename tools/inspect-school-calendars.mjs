for(const [school,path] of Object.entries({woodcreek:'calendar',roseville:'school-calendar',granitebay:'calendar',antelope:'antelope-hs-calendar',westpark:'panther-calendar',oakmont:'calendar'})){
 const h=await(await fetch(`https://${school}.rjuhsd.us/${path}`)).text();
 console.log(JSON.stringify({school,dates:h.match(/<[^>]*class="fsCalendarDate"[^>]*>/g)?.slice(0,2),events:h.match(/<[^>]*class="fsCalendarEventTitle[^>]*>/g)?.slice(0,2),feeds:h.match(/.{0,40}(?:\.ics|iCal|calendarids).{0,100}/g)?.slice(-3)}));
}
