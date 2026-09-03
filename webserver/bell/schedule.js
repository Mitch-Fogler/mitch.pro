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
})(window);