"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeToMinutes = timeToMinutes;
exports.isScheduleActive = isScheduleActive;
function timeToMinutes(time) {
    const parts = time.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    return hours * 60 + minutes;
}
function isScheduleActive(currentMinutes, schedule) {
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
//# sourceMappingURL=schedule.utils.js.map