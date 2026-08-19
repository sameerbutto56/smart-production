const { addHours, isWithinInterval, setHours, setMinutes, setSeconds, isWeekend, addDays, startOfDay } = require('date-fns');

/**
 * Calculates a deadline based on working hours (8 AM - 8 PM)
 * @param {Date} startDate 
 * @param {number} durationHours 
 * @returns {Date}
 */
const calculateDeadline = (startDate, durationHours) => {
  // Convert startDate to a UTC+5 (Pakistan) Date object for calculation
  const pkOffset = 5 * 60 * 60 * 1000;
  
  // Shift the timestamp to align UTC methods with Pakistan local time
  let currentDate = new Date(new Date(startDate).getTime() + pkOffset);
  let remainingHours = durationHours;

  const WORK_START = 9;  // 9:00 AM Pakistan Time
  const WORK_END = 19;   // 7:00 PM Pakistan Time

  const addDaysUTC = (date, days) => new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  const setHoursUTC = (date, hours) => {
    const d = new Date(date);
    d.setUTCHours(hours, 0, 0, 0);
    return d;
  };

  // Initial adjustment: Move to working hours if currently outside
  while (currentDate.getUTCHours() >= WORK_END || currentDate.getUTCHours() < WORK_START || currentDate.getUTCDay() === 0) {
    currentDate = addDaysUTC(currentDate, 1);
    currentDate = setHoursUTC(currentDate, WORK_START);
    if (currentDate.getUTCDay() !== 0) break;
  }

  while (remainingHours > 0) {
    const currentWindowEnd = setHoursUTC(new Date(currentDate), WORK_END);
    const msLeftToday = currentWindowEnd.getTime() - currentDate.getTime();
    const hoursLeftToday = msLeftToday / (1000 * 60 * 60);
    
    if (remainingHours <= hoursLeftToday) {
      currentDate = new Date(currentDate.getTime() + remainingHours * 60 * 60 * 1000);
      remainingHours = 0;
    } else {
      remainingHours -= hoursLeftToday;
      currentDate = addDaysUTC(currentDate, 1);
      currentDate = setHoursUTC(currentDate, WORK_START);
      
      // Skip Sundays
      while (currentDate.getUTCDay() === 0) {
        currentDate = addDaysUTC(currentDate, 1);
      }
    }
  }

  // Convert back from PK Time to original UTC
  return new Date(currentDate.getTime() - pkOffset);
};

module.exports = { calculateDeadline };
