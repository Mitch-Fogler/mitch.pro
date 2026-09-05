(function () {
  'use strict';

  var TZ = 'America/Los_Angeles';
  var schoolEvents = [];
  var calendarCursor = null;
  var selectedOffset = 0;
  var lunchChoice = localStorage.getItem('mitch.homeLunch') === 'first' ? 'first' : 'second';

  function el(id) { return document.getElementById(id); }
  function pad(value) { return String(value).padStart(2, '0'); }
  function localParts(date) {
    var parts = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(date || new Date());
    var values = {};
    parts.forEach(function (part) { if (part.type !== 'literal') values[part.type] = part.value; });
    var year = +values.year, month = +values.month, day = +values.day, hour = (+values.hour) % 24;
    return { year: year, month: month, day: day, hour: hour, minute: +values.minute, second: +values.second, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(), key: values.year + '-' + values.month + '-' + values.day };
  }
  function dateForOffset(offset) {
    var now = localParts();
    var date = new Date(Date.UTC(now.year, now.month - 1, now.day + offset));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), weekday: date.getUTCDay(), key: date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) };
  }
  function minutes(value) {
    var match = String(value).match(/^(\d+):(\d+)\s(AM|PM)$/);
    if (!match) return 0;
    var hour = (+match[1]) % 12;
    if (match[3] === 'PM') hour += 12;
    return hour * 60 + (+match[2]);
  }
  function weatherText(code) {
    if (code === 0) return 'Clear sky';
    if ([1, 2].includes(code)) return 'Mostly clear';
    if (code === 3) return 'Overcast';
    if ([45, 48].includes(code)) return 'Foggy';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain showers';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
    if ([95, 96, 99].includes(code)) return 'Thunderstorms';
    return 'Changing conditions';
  }
  function weatherIcon(code) {
    if (code <= 1) return '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="12"/><path d="M32 5v10m0 34v10M5 32h10m34 0h10M13 13l7 7m24 24 7 7m0-38-7 7M20 44l-7 7"/></svg>';
    if ([2, 3, 45, 48].includes(code)) return '<svg viewBox="0 0 64 64"><path d="M18 46h30c8 0 11-12 4-16-2-9-14-12-20-5-8-5-18 1-17 10-7 3-5 11 3 11Z"/><path d="M20 18a14 14 0 0 1 23 5"/></svg>';
    if ([95, 96, 99].includes(code)) return '<svg viewBox="0 0 64 64"><path d="M17 39h32c8 0 10-12 3-16-4-11-20-11-24-1-10-3-17 8-11 17Z"/><path d="m31 40-5 11h7l-2 9 10-14h-7l3-6"/></svg>';
    return '<svg viewBox="0 0 64 64"><path d="M17 36h32c8 0 10-12 3-16-4-11-20-11-24-1-10-3-17 8-11 17Z"/><path d="M20 44l-3 7m15-7-3 7m15-7-3 7"/></svg>';
  }
  function hourLabel(value, index) {
    if (index === 0) return 'NOW';
    var hour = +(String(value).split('T')[1] || '0:00').split(':')[0];
    return (hour % 12 || 12) + (hour >= 12 ? 'P' : 'A');
  }
  async function loadWeather() {
    try {
      var response = await fetch('/api/weather', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error('weather unavailable');
      var data = await response.json(), current = data.current || {}, daily = data.daily || {}, code = +current.weather_code;
      if (![current.temperature_2m, current.apparent_temperature, current.wind_speed_10m, daily.temperature_2m_max?.[0], daily.temperature_2m_min?.[0]].every(function (value) { return value != null && Number.isFinite(Number(value)); })) throw new Error('incomplete forecast');
      el('home-weather-condition').textContent = weatherText(code);
      el('home-weather-icon').innerHTML = weatherIcon(code);
      el('home-weather-temp').textContent = Math.round(+current.temperature_2m) + '°';
      el('home-weather-feels').textContent = Math.round(+current.apparent_temperature) + '°';
      el('home-weather-range').textContent = Math.round(+daily.temperature_2m_max[0]) + '° / ' + Math.round(+daily.temperature_2m_min[0]) + '°';
      el('home-weather-wind').textContent = Math.round(+current.wind_speed_10m) + ' mph';
      el('home-weather-updated').textContent = (data.stale ? 'Cached forecast' : 'Updated live') + ' · Open-Meteo';
      el('home-weather-card').dataset.theme = code <= 1 ? 'clear' : ([51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code) ? 'rain' : 'cloud');
      var times = data.hourly?.time || [], temps = data.hourly?.temperature_2m || [], codes = data.hourly?.weather_code || [];
      var now = localParts();
      var target = now.key + 'T' + pad(now.hour) + ':00';
      var start = Math.max(0, times.indexOf(target));
      var rows = [0, 2, 4, 6].filter(function (step) { return times[start + step] && temps[start + step] != null && Number.isFinite(Number(temps[start + step])); }).map(function (step, index) {
        var at = Math.min(start + step, times.length - 1);
        var item = document.createElement('span');
        item.innerHTML = '<small>' + hourLabel(times[at], index) + '</small><i>' + weatherIcon(+codes[at]) + '</i><b>' + Math.round(+temps[at]) + '°</b>';
        return item;
      });
      el('home-hourly-weather').replaceChildren.apply(el('home-hourly-weather'), rows);
      el('home-weather-state').classList.remove('offline');
      el('home-weather-state').innerHTML = '<i></i> LIVE';
    } catch (_) {
      el('home-weather-temp').textContent = '—';
      el('home-weather-feels').textContent = '—';
      el('home-weather-range').textContent = '—';
      el('home-weather-wind').textContent = '—';
      el('home-hourly-weather').replaceChildren();
      el('home-weather-condition').textContent = 'Forecast unavailable';
      el('home-weather-updated').textContent = 'Weather service will retry';
      el('home-weather-state').classList.add('offline');
      el('home-weather-state').innerHTML = '<i></i> OFFLINE';
    }
  }

  function renderCalendar() {
    var today = localParts();
    if (!calendarCursor) calendarCursor = { year: today.year, month: today.month };
    var year = calendarCursor.year, month = calendarCursor.month;
    var first = new Date(Date.UTC(year, month - 1, 1));
    var start = first.getUTCDay(), days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    el('home-calendar-title').textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(first);
    var eventDates = new Set(schoolEvents.map(function (event) { return event.date; }));
    var cells = [];
    for (var index = 0; index < 42; index++) {
      var day = index - start + 1, cell = document.createElement('span');
      if (day < 1 || day > days) cell.className = 'outside';
      else {
        var key = year + '-' + pad(month) + '-' + pad(day);
        cell.textContent = day;
        if (key === today.key) cell.classList.add('today');
        if (eventDates.has(key)) cell.classList.add('event');
      }
      cells.push(cell);
    }
    el('home-calendar-days').replaceChildren.apply(el('home-calendar-days'), cells);
    var upcoming = schoolEvents.filter(function (event) { return event.date >= today.key; }).slice(0, 4);
    var rows = upcoming.map(function (event) {
      var item = document.createElement('li'), time = document.createElement('time'), copy = document.createElement('span'), title = document.createElement('strong'), detail = document.createElement('small');
      time.textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: '2-digit' }).format(new Date(event.date + 'T12:00:00Z'));
      title.textContent = event.title;
      detail.textContent = event.detail || 'All day';
      copy.append(title, detail); item.append(time, copy); return item;
    });
    if (!rows.length) { var empty = document.createElement('li'); empty.textContent = 'No upcoming school events'; rows = [empty]; }
    el('home-school-events').replaceChildren.apply(el('home-school-events'), rows);
  }
  async function loadCalendar() {
    try {
      var response = await fetch('/api/school-calendar', { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error('calendar unavailable');
      var data = await response.json();
      schoolEvents = Array.isArray(data.events) ? data.events.filter(function (event) { return /^\d{4}-\d{2}-\d{2}$/.test(event.date) && event.title; }) : [];
      renderCalendar(); renderBells();
    } catch (_) { renderCalendar(); }
  }
  function moveMonth(delta) {
    var date = new Date(Date.UTC(calendarCursor.year, calendarCursor.month - 1 + delta, 1));
    calendarCursor = { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
    renderCalendar();
  }

  function regularSchedule(weekday, lunch) {
    var base = {
      1: lunch === 'first' ? [['Period 1','8:30 AM','9:52 AM'],['Period 2','10:00 AM','11:22 AM'],['Lunch','11:22 AM','11:52 AM'],['Period 3','12:00 PM','1:22 PM'],['Period 4','1:30 PM','2:52 PM'],['PACK','2:52 PM','3:20 PM']] : [['Period 1','8:30 AM','9:52 AM'],['Period 2','10:00 AM','11:22 AM'],['Period 3','11:30 AM','12:52 PM'],['Lunch','12:52 PM','1:22 PM'],['Period 4','1:30 PM','2:52 PM'],['PACK','2:52 PM','3:20 PM']],
      2: lunch === 'first' ? [['Period 1','8:30 AM','9:52 AM'],['Period 2','10:00 AM','11:22 AM'],['Lunch','11:22 AM','11:52 AM'],['Period 3','12:00 PM','1:22 PM'],['PACK','1:22 PM','1:50 PM'],['Period 4','1:58 PM','3:20 PM']] : [['Period 1','8:30 AM','9:52 AM'],['Period 2','10:00 AM','11:22 AM'],['Period 3','11:30 AM','12:52 PM'],['PACK','12:52 PM','1:20 PM'],['Lunch','1:20 PM','1:50 PM'],['Period 4','1:58 PM','3:20 PM']],
      3: [['Period 1','9:30 AM','10:44 AM'],['Period 2','10:52 AM','12:06 PM'],['Period 3','12:14 PM','1:28 PM'],['Lunch','1:28 PM','1:58 PM'],['Period 4','2:06 PM','3:20 PM']],
      4: lunch === 'first' ? [['Period 1','8:30 AM','9:52 AM'],['Period 2','10:00 AM','11:22 AM'],['PACK','11:22 AM','11:50 AM'],['Lunch','11:50 AM','12:20 PM'],['Period 3','12:28 PM','1:50 PM'],['Period 4','1:58 PM','3:20 PM']] : [['Period 1','8:30 AM','9:52 AM'],['Period 2','10:00 AM','11:22 AM'],['PACK','11:22 AM','11:50 AM'],['Period 3','11:58 AM','1:20 PM'],['Lunch','1:20 PM','1:50 PM'],['Period 4','1:58 PM','3:20 PM']],
      5: lunch === 'first' ? [['Period 1','8:30 AM','9:52 AM'],['PACK','9:52 AM','10:20 AM'],['Period 2','10:28 AM','11:50 AM'],['Lunch','11:50 AM','12:20 PM'],['Period 3','12:28 PM','1:50 PM'],['Period 4','1:58 PM','3:20 PM']] : [['Period 1','8:30 AM','9:52 AM'],['PACK','9:52 AM','10:20 AM'],['Period 2','10:28 AM','11:50 AM'],['Period 3','11:58 AM','1:20 PM'],['Lunch','1:20 PM','1:50 PM'],['Period 4','1:58 PM','3:20 PM']]
    };
    return base[weekday] || [];
  }
  function scheduleFor(date) {
    var events = schoolEvents.filter(function (event) { return event.date === date.key; });
    var names = events.map(function (event) { return event.title.toLowerCase(); }).join(' ');
    if (date.weekday === 0 || date.weekday === 6 || /no school|holiday|break/.test(names)) return { label: 'No school', note: events[0]?.title || 'Weekend schedule', periods: [] };
    if (/minimum day|early release/.test(names)) return { label: 'Minimum Day', note: events[0]?.title || '12:50 PM dismissal', periods: [['Period 1','8:30 AM','9:26 AM'],['Period 2','9:34 AM','10:30 AM'],['Period 3','10:38 AM','11:34 AM'],['Lunch','11:34 AM','11:46 AM'],['Period 4','11:54 AM','12:50 PM']] };
    if (/final|midterm/.test(names)) return { label: 'Exam schedule', note: events[0]?.title || 'Modified bell schedule', periods: [['Period 1 / 3','8:30 AM','10:30 AM'],['Lunch','10:30 AM','10:42 AM'],['Period 2 / 4','10:50 AM','12:50 PM']] };
    var periods = regularSchedule(date.weekday, lunchChoice);
    return { label: date.weekday === 3 ? 'Wednesday collaboration' : ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.weekday] + ' schedule', note: /late start/.test(names) ? events[0].title : (date.weekday === 3 ? '9:30 AM start' : (lunchChoice === 'first' ? '1st lunch' : '2nd lunch')), periods: periods };
  }
  function renderBells() {
    var date = dateForOffset(selectedOffset), schedule = scheduleFor(date), now = localParts(), currentMinutes = now.hour * 60 + now.minute;
    var isToday = selectedOffset === 0, active = -1, next = -1;
    if (isToday) schedule.periods.forEach(function (period, index) { if (currentMinutes >= minutes(period[1]) && currentMinutes < minutes(period[2])) active = index; if (next < 0 && currentMinutes < minutes(period[1])) next = index; });
    var rows = schedule.periods.map(function (period, index) {
      var item = document.createElement('li'); if (index === active) item.className = 'active'; else if (index === next) item.className = 'next';
      var dot = document.createElement('i'), copy = document.createElement('span'), label = document.createElement('small'), title = document.createElement('strong'), time = document.createElement('time');
      label.textContent = period[0].toUpperCase().includes('PERIOD') ? period[0] : 'BELL SCHEDULE'; title.textContent = period[0]; time.textContent = period[1] + ' – ' + period[2]; copy.append(label, title); item.append(dot, copy, time); return item;
    });
    if (!rows.length) { var empty = document.createElement('li'); empty.className = 'empty-period'; empty.textContent = 'No periods scheduled'; rows = [empty]; }
    el('home-periods').replaceChildren.apply(el('home-periods'), rows);
    var state = el('home-bell-state'); state.classList.remove('offline');
    if (!schedule.periods.length) { state.classList.add('offline'); state.innerHTML = '<i></i> OFF CAMPUS'; el('home-bell-current').textContent = 'No class currently in session.'; el('home-bell-countdown').textContent = schedule.note; }
    else if (!isToday) { state.innerHTML = '<i></i> SCHEDULE VIEW'; el('home-bell-current').textContent = schedule.label; el('home-bell-countdown').textContent = schedule.note; }
    else if (active >= 0) { state.innerHTML = '<i></i> IN SESSION'; el('home-bell-current').textContent = schedule.periods[active][0] + ' is in session.'; el('home-bell-countdown').textContent = (minutes(schedule.periods[active][2]) - currentMinutes) + ' minutes until the bell.'; }
    else if (next >= 0) { state.innerHTML = '<i></i> NEXT BELL'; el('home-bell-current').textContent = schedule.periods[next][0] + ' begins next.'; el('home-bell-countdown').textContent = (minutes(schedule.periods[next][1]) - currentMinutes) + ' minutes to start.'; }
    else { state.innerHTML = '<i></i> DAY COMPLETE'; el('home-bell-current').textContent = 'No class currently in session.'; el('home-bell-countdown').textContent = 'No more bells today.'; }
    el('home-schedule-label').textContent = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(date.key + 'T12:00:00Z'));
    el('home-bell-note').textContent = schedule.label + ' · ' + schedule.note;
    el('home-bell-footer').textContent = schedule.note;
    el('home-first-lunch').classList.toggle('active', lunchChoice === 'first');
    el('home-second-lunch').classList.toggle('active', lunchChoice === 'second');
  }
  function setLunch(choice) { lunchChoice = choice; localStorage.setItem('mitch.homeLunch', choice); renderBells(); }
  function init() {
    if (!el('home-dayboard-title')) return;
    renderCalendar(); renderBells(); loadWeather(); loadCalendar();
    el('home-cal-prev').onclick = function () { moveMonth(-1); };
    el('home-cal-next').onclick = function () { moveMonth(1); };
    el('home-cal-today').onclick = function () { var now = localParts(); calendarCursor = { year: now.year, month: now.month }; renderCalendar(); };
    el('home-first-lunch').onclick = function () { setLunch('first'); };
    el('home-second-lunch').onclick = function () { setLunch('second'); };
    el('home-day-prev').onclick = function () { selectedOffset -= 1; renderBells(); };
    el('home-day-next').onclick = function () { selectedOffset += 1; renderBells(); };
    setInterval(renderBells, 30000); setInterval(loadWeather, 600000); setInterval(loadCalendar, 1800000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
