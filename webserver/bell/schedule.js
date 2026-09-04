/* Woodcreek High School bell schedules — single shared source.
   Used by /bell/ and the rjuhsd.school homepage. */
(function (g) {
  'use strict';

  // Woodcreek High School Bell Schedule definitions
  const SCHEDULES = {
    // Monday
    1: {
      1: [
        { name: 'Period 1', start: '08:30', end: '09:52', duration: 82 },
        { name: 'Period 2', start: '10:00', end: '11:22', duration: 82 },
        { name: 'Lunch 1', start: '11:22', end: '11:52', duration: 30 },
        { name: 'Period 3', start: '12:00', end: '13:22', duration: 82 },
        { name: 'Period 4', start: '13:30', end: '14:52', duration: 82 },
        { name: 'Pack', start: '14:52', end: '15:20', duration: 28 }
      ],
      2: [
        { name: 'Period 1', start: '08:30', end: '09:52', duration: 82 },
        { name: 'Period 2', start: '10:00', end: '11:22', duration: 82 },
        { name: 'Period 3', start: '11:30', end: '12:52', duration: 82 },
        { name: 'Lunch 2', start: '12:52', end: '13:22', duration: 30 },
        { name: 'Period 4', start: '13:30', end: '14:52', duration: 82 },
        { name: 'Pack', start: '14:52', end: '15:20', duration: 28 }
      ]
    },
    // Tuesday
    2: {
      1: [
        { name: 'Period 1', start: '08:30', end: '09:52', duration: 82 },
        { name: 'Period 2', start: '10:00', end: '11:22', duration: 82 },
        { name: 'Lunch 1', start: '11:22', end: '11:52', duration: 30 },
        { name: 'Period 3', start: '12:00', end: '13:22', duration: 82 },
        { name: 'Pack', start: '13:22', end: '13:50', duration: 28 },
        { name: 'Period 4', start: '13:58', end: '15:20', duration: 82 }
      ],
      2: [
        { name: 'Period 1', start: '08:30', end: '09:52', duration: 82 },
        { name: 'Period 2', start: '10:00', end: '11:22', duration: 82 },
        { name: 'Period 3', start: '11:30', end: '12:52', duration: 82 },
        { name: 'Pack', start: '12:52', end: '13:20', duration: 28 },
        { name: 'Lunch 2', start: '13:20', end: '13:50', duration: 30 },
        { name: 'Period 4', start: '13:58', end: '15:20', duration: 82 }
      ]
    },
    // Wednesday (Collaboration Late Start)
    3: {
      1: [
        { name: 'Period 1', start: '09:30', end: '10:44', duration: 74 },
        { name: 'Period 2', start: '10:52', end: '12:06', duration: 74 },
        { name: 'Period 3', start: '12:14', end: '13:28', duration: 74 },
        { name: 'Lunch', start: '13:28', end: '13:58', duration: 30 },
        { name: 'Period 4', start: '14:06', end: '15:20', duration: 74 }
      ],
      2: [
        { name: 'Period 1', start: '09:30', end: '10:44', duration: 74 },
        { name: 'Period 2', start: '10:52', end: '12:06', duration: 74 },
        { name: 'Period 3', start: '12:14', end: '13:28', duration: 74 },
        { name: 'Lunch', start: '13:28', end: '13:58', duration: 30 },
        { name: 'Period 4', start: '14:06', end: '15:20', duration: 74 }
      ]
    },
    // Thursday
    4: {
      1: [
        { name: 'Period 1', start: '08:30', end: '09:52', duration: 82 },
        { name: 'Period 2', start: '10:00', end: '11:22', duration: 82 },
        { name: 'Pack', start: '11:22', end: '11:50', duration: 28 },
        { name: 'Lunch 1', start: '11:50', end: '12:20', duration: 30 },
        { name: 'Period 3', start: '12:28', end: '13:50', duration: 82 },
        { name: 'Period 4', start: '13:58', end: '15:20', duration: 82 }
      ],
      2: [
        { name: 'Period 1', start: '08:30', end: '09:52', duration: 82 },
        { name: 'Period 2', start: '10:00', end: '11:22', duration: 82 },
        { name: 'Pack', start: '11:22', end: '11:50', duration: 28 },
        { name: 'Period 3', start: '11:58', end: '13:20', duration: 82 },
        { name: 'Lunch 2', start: '13:20', end: '13:50', duration: 30 },
        { name: 'Period 4', start: '13:58', end: '15:20', duration: 82 }
      ]
    },
    // Friday
    5: {
      1: [
        { name: 'Period 1', start: '08:30', end: '09:52', duration: 82 },
        { name: 'Pack', start: '09:52', end: '10:20', duration: 28 },
        { name: 'Period 2', start: '10:28', end: '11:50', duration: 82 },
        { name: 'Lunch 1', start: '11:50', end: '12:20', duration: 30 },
        { name: 'Period 3', start: '12:28', end: '13:50', duration: 82 },
        { name: 'Period 4', start: '13:58', end: '15:20', duration: 82 }
      ],
      2: [
        { name: 'Period 1', start: '08:30', end: '09:52', duration: 82 },
        { name: 'Pack', start: '09:52', end: '10:20', duration: 28 },
        { name: 'Period 2', start: '10:28', end: '11:50', duration: 82 },
        { name: 'Period 3', start: '11:58', end: '13:20', duration: 82 },
        { name: 'Lunch 2', start: '13:20', end: '13:50', duration: 30 },
        { name: 'Period 4', start: '13:58', end: '15:20', duration: 82 }
      ]
    }
  };

  g.WHS_BELL = {
    schedules: SCHEDULES,
    // '08:30' -> minutes since midnight
    parseTime: function (str) {
      const parts = String(str || '').split(':');
      return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
    },
    // '13:30' -> '1:30 PM'
    formatTime: function (timeStr) {
      const parts = String(timeStr || '').split(':');
      const h = parseInt(parts[0], 10);
      const m = parts[1] || '00';
      const ampm = h >= 12 ? 'PM' : 'AM';
      return `${h % 12 || 12}:${m} ${ampm}`;
    }
  };

  /* Bell schedules for every RJUHSD school on the rjuhsd.school picker.
     Same shape as WHS_BELL.schedules: schedules[day 1-5][lunch 1|2] = blocks.
     Sources: <school>.rjuhsd.us/about/bell-schedules (2026-27). Block names
     must be unique within a day (row ids are derived from them), so repeated
     advisory blocks get numbered suffixes. */
  const mt = g.WHS_BELL.parseTime;
  const p = (name, start, end) => ({ name, start, end, duration: mt(end) - mt(start) });
  // A day with a single lunch for everyone: same array under both lunch keys.
  const one = (blocks) => ({ 1: blocks, 2: blocks });

  const RJUHSD_BELLS = {
    woodcreek: SCHEDULES,

    roseville: {
      // Mon / Tue / Thu / Fri — Roar + two lunches
      1: {
        1: [p('Period 1', '08:30', '09:51'), p('Roar', '09:57', '10:27'), p('Period 2', '10:33', '11:56'), p('Lunch 1', '11:56', '12:26'), p('Period 3', '12:32', '13:53'), p('Period 4', '13:59', '15:20')],
        2: [p('Period 1', '08:30', '09:51'), p('Roar', '09:57', '10:27'), p('Period 2', '10:33', '11:56'), p('Period 3', '12:02', '13:23'), p('Lunch 2', '13:23', '13:53'), p('Period 4', '13:59', '15:20')]
      },
      2: null, 4: null, 5: null, // filled below (same as Monday)
      // Wednesday — late start 9:25, one lunch
      3: one([
        p('Period 1', '09:25', '10:41'),
        p('Period 2', '10:47', '12:06'),
        p('Lunch', '12:06', '12:36'),
        p('Period 3', '12:42', '13:58'),
        p('Period 4', '14:04', '15:20')
      ])
    },

    westpark: {
      // Monday / Friday — two lunches
      1: {
        1: [p('Period 0', '07:30', '08:25'), p('Period 1', '08:30', '09:59'), p('Period 2', '10:07', '11:36'), p('Lunch 1', '11:36', '12:06'), p('Period 3', '12:14', '13:43'), p('Period 4', '13:51', '15:20')],
        2: [p('Period 0', '07:30', '08:25'), p('Period 1', '08:30', '09:59'), p('Period 2', '10:07', '11:36'), p('Period 3', '11:44', '13:13'), p('Lunch 2', '13:13', '13:43'), p('Period 4', '13:51', '15:20')]
      },
      // Tuesday / Thursday — School Business + two lunches
      2: {
        1: [p('Period 0', '07:30', '08:25'), p('Period 1', '08:30', '09:55'), p('Period 2', '10:03', '11:28'), p('School Business', '11:28', '11:44'), p('Lunch 1', '11:44', '12:14'), p('Period 3', '12:22', '13:47'), p('Period 4', '13:55', '15:20')],
        2: [p('Period 0', '07:30', '08:25'), p('Period 1', '08:30', '09:55'), p('Period 2', '10:03', '11:28'), p('School Business', '11:28', '11:44'), p('Period 3', '11:52', '13:17'), p('Lunch 2', '13:17', '13:47'), p('Period 4', '13:55', '15:20')]
      },
      // Wednesday — Panther Period all day, single lunch
      3: one([
        p('Period 1', '09:30', '10:14'),
        p('Panther Period 1', '10:14', '10:44'),
        p('Period 2', '10:52', '11:36'),
        p('Panther Period 2', '11:36', '12:06'),
        p('Lunch', '12:06', '12:36'),
        p('Period 3', '12:44', '13:28'),
        p('Panther Period 3', '13:28', '13:58'),
        p('Period 4', '14:06', '14:50'),
        p('Panther Period 4', '14:50', '15:20')
      ]),
      4: null, 5: null // filled below
    },

    granitebay: {
      // Mon / Tue / Thu / Fri — two lunches
      1: {
        1: [p('Period 0', '07:30', '08:20'), p('Period 1', '08:30', '09:59'), p('Period 2', '10:07', '11:36'), p('Lunch 1', '11:36', '12:06'), p('Period 3', '12:14', '13:43'), p('Period 4', '13:51', '15:20')],
        2: [p('Period 0', '07:30', '08:20'), p('Period 1', '08:30', '09:59'), p('Period 2', '10:07', '11:36'), p('Period 3', '11:44', '13:13'), p('Lunch 2', '13:13', '13:43'), p('Period 4', '13:51', '15:20')]
      },
      2: null, 4: null, 5: null, // filled below (same as Monday)
      // Wednesday — Intervention blocks, one lunch
      3: one([
        p('Period 1', '09:30', '10:14'),
        p('Intervention 1', '10:14', '10:42'),
        p('Period 2', '10:50', '11:42'),
        p('Intervention 2', '11:42', '12:10'),
        p('Period 3', '12:18', '13:02'),
        p('Intervention 3', '13:02', '13:30'),
        p('Lunch', '13:30', '14:00'),
        p('Period 4', '14:08', '14:52'),
        p('Intervention 4', '14:52', '15:20')
      ])
    },

    antelope: {
      // Mon / Tue / Thu / Fri — two lunches
      1: {
        1: [p('Period 1', '08:30', '10:00'), p('Period 2', '10:06', '11:36'), p('Lunch 1', '11:36', '12:06'), p('Period 3', '12:12', '13:43'), p('Period 4', '13:49', '15:20')],
        2: [p('Period 1', '08:30', '10:00'), p('Period 2', '10:06', '11:36'), p('Period 3', '11:42', '13:13'), p('Lunch 2', '13:13', '13:43'), p('Period 4', '13:49', '15:20')]
      },
      2: null, 4: null, 5: null, // filled below (same as Monday)
      // Wednesday — Titan Time, single lunch
      3: one([
        p('Period 1', '09:30', '10:15'),
        p('Titan Time 1', '10:15', '10:45'),
        p('Period 2', '10:51', '11:36'),
        p('Titan Time 2', '11:36', '12:06'),
        p('Lunch', '12:06', '12:36'),
        p('Period 3', '12:42', '13:28'),
        p('Titan Time 3', '13:28', '13:58'),
        p('Period 4', '14:04', '14:50'),
        p('Titan Time 4', '14:50', '15:20')
      ])
    },

    oakmont: {
      // Mon / Tue / Thu / Fri — no advisory, two lunches
      1: {
        1: [p('Period 1', '08:30', '10:00'), p('Period 2', '10:06', '11:38'), p('Lunch 1', '11:38', '12:08'), p('Period 3', '12:14', '13:44'), p('Period 4', '13:50', '15:20')],
        2: [p('Period 1', '08:30', '10:00'), p('Period 2', '10:06', '11:38'), p('Period 3', '11:44', '13:14'), p('Lunch 2', '13:14', '13:44'), p('Period 4', '13:50', '15:20')]
      },
      2: null, 4: null, 5: null, // filled below (same as Monday)
      // Wednesday — Collaboration late start, Intervention blocks, one lunch
      3: one([
        p('Period 1', '09:30', '10:16'),
        p('Intervention 1', '10:16', '10:46'),
        p('Period 2', '10:52', '11:38'),
        p('Intervention 2', '11:38', '12:08'),
        p('Lunch', '12:08', '12:38'),
        p('Period 3', '12:44', '13:29'),
        p('Intervention 3', '13:29', '13:59'),
        p('Period 4', '14:05', '14:50'),
        p('Intervention 4', '14:50', '15:20')
      ])
    }
  };

  // Days that share Monday's regular schedule (school-dependent).
  RJUHSD_BELLS.roseville[2] = RJUHSD_BELLS.roseville[1];
  RJUHSD_BELLS.roseville[4] = RJUHSD_BELLS.roseville[1];
  RJUHSD_BELLS.roseville[5] = RJUHSD_BELLS.roseville[1];
  RJUHSD_BELLS.westpark[4] = RJUHSD_BELLS.westpark[2];
  RJUHSD_BELLS.westpark[5] = RJUHSD_BELLS.westpark[1];
  RJUHSD_BELLS.granitebay[2] = RJUHSD_BELLS.granitebay[1];
  RJUHSD_BELLS.granitebay[4] = RJUHSD_BELLS.granitebay[1];
  RJUHSD_BELLS.granitebay[5] = RJUHSD_BELLS.granitebay[1];
  RJUHSD_BELLS.antelope[2] = RJUHSD_BELLS.antelope[1];
  RJUHSD_BELLS.antelope[4] = RJUHSD_BELLS.antelope[1];
  RJUHSD_BELLS.antelope[5] = RJUHSD_BELLS.antelope[1];
  RJUHSD_BELLS.oakmont[2] = RJUHSD_BELLS.oakmont[1];
  RJUHSD_BELLS.oakmont[4] = RJUHSD_BELLS.oakmont[1];
  RJUHSD_BELLS.oakmont[5] = RJUHSD_BELLS.oakmont[1];

  g.RJUHSD_BELLS = RJUHSD_BELLS;
})(window);