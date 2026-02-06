export type ScheduleWindow = {
  startTime: string;
  endTime: string;
  enabled: boolean;
};

export function timeToMinutes(time: string): number {
  const parts = time.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

export function isScheduleActive(
  currentMinutes: number,
  schedule: ScheduleWindow,
): boolean {
  if (!schedule.enabled) {
    return false;
  }
  const start = timeToMinutes(schedule.startTime);
  const end = timeToMinutes(schedule.endTime);
  if (start <= end) {
    return currentMinutes >= start && currentMinutes < end;
  }
  return currentMinutes >= start || currentMinutes < end;
}
