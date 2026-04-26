import { addHours, addDays, isWeekend, setHours, setMinutes, setSeconds, startOfDay } from 'date-fns';

const WORKING_HOURS_START = 8;
const WORKING_HOURS_END = 20;

export class DeadlineService {
  static calculateDeadline(startDate: Date, durationHours: number): Date {
    let current = new Date(startDate);
    let remainingHours = durationHours;

    while (remainingHours > 0) {
      const hour = current.getHours();
      
      if (hour < WORKING_HOURS_START) {
        current = setHours(setMinutes(setSeconds(current, 0), 0), WORKING_HOURS_START);
      }
      
      if (hour >= WORKING_HOURS_END) {
        current = addDays(startOfDay(current), 1);
        current = setHours(current, WORKING_HOURS_START);
      }

      if (isWeekend(current)) {
        current = addDays(current, 1);
        continue;
      }

      const endOfToday = setHours(setMinutes(setSeconds(current, 0), 0), WORKING_HOURS_END);
      const diffMs = endOfToday.getTime() - current.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours >= remainingHours) {
        current = addHours(current, remainingHours);
        remainingHours = 0;
      } else {
        remainingHours -= diffHours;
        current = addDays(startOfDay(current), 1);
        current = setHours(current, WORKING_HOURS_START);
      }
    }

    return current;
  }

  static getStageDuration(stage: string, isUrgent: boolean): number {
    const durations: Record<string, number> = {
      'STORE': 2,
      'CUTTING': 24,
      'STITCHING': 48,
      'QUALITY_CHECK': 24,
      'PRESSING': 6,
      'PACKAGING': 6,
    };

    let base = durations[stage] || 4;
    return isUrgent ? base / 2 : base;
  }
}
