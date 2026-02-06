import { isScheduleActive, timeToMinutes } from './schedule.utils';

describe('schedule utils', () => {
  test('timeToMinutes converts HH:mm to minutes', () => {
    expect(timeToMinutes('08:30')).toBe(510);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  test('isScheduleActive returns false when disabled', () => {
    expect(
      isScheduleActive(600, {
        startTime: '08:00',
        endTime: '18:00',
        enabled: false,
      }),
    ).toBe(false);
  });

  test('isScheduleActive handles same-day windows', () => {
    expect(
      isScheduleActive(540, {
        startTime: '08:00',
        endTime: '12:00',
        enabled: true,
      }),
    ).toBe(true);
    expect(
      isScheduleActive(720, {
        startTime: '08:00',
        endTime: '12:00',
        enabled: true,
      }),
    ).toBe(false);
  });

  test('isScheduleActive handles overnight windows', () => {
    expect(
      isScheduleActive(1380, {
        startTime: '22:00',
        endTime: '06:00',
        enabled: true,
      }),
    ).toBe(true);
    expect(
      isScheduleActive(300, {
        startTime: '22:00',
        endTime: '06:00',
        enabled: true,
      }),
    ).toBe(true);
    expect(
      isScheduleActive(720, {
        startTime: '22:00',
        endTime: '06:00',
        enabled: true,
      }),
    ).toBe(false);
  });
});
