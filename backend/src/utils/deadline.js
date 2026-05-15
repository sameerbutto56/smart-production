const { addHours, isWithinInterval, setHours, setMinutes, setSeconds, isWeekend, addDays, startOfDay } = require('date-fns');

/**
 * Calculates a deadline based on working hours (8 AM - 8 PM)
 * @param {Date} startDate 
 * @param {number} durationHours 
 * @returns {Date}
 */
const calculateDeadline = (startDate, durationHours) => {
  let currentDate = new Date(startDate);
  let remainingHours = durationHours;

  const WORK_START = 9;
  const WORK_END = 20;

  // Initial adjustment: Move to working hours if currently outside
  while (currentDate.getHours() >= WORK_END || currentDate.getHours() < WORK_START || currentDate.getDay() === 0) {
    currentDate = addDays(currentDate, 1);
    currentDate = setHours(currentDate, WORK_START);
    currentDate = setMinutes(currentDate, 0);
    currentDate = setSeconds(currentDate, 0);
    if (currentDate.getDay() !== 0) break;
  }

  while (remainingHours > 0) {
    // Current window end time
    const currentWindowEnd = setHours(new Date(currentDate), WORK_END);
    const msLeftToday = currentWindowEnd.getTime() - currentDate.getTime();
    const hoursLeftToday = msLeftToday / (1000 * 60 * 60);
    
    if (remainingHours <= hoursLeftToday) {
      currentDate = addHours(currentDate, remainingHours);
      remainingHours = 0;
    } else {
      remainingHours -= hoursLeftToday;
      // Move to next day
      currentDate = addDays(currentDate, 1);
      currentDate = setHours(currentDate, WORK_START);
      currentDate = setMinutes(currentDate, 0);
      currentDate = setSeconds(currentDate, 0);
      
      // Skip Sundays
      while (currentDate.getDay() === 0) {
        currentDate = addDays(currentDate, 1);
      }
    }
  }

  return currentDate;
};

module.exports = { calculateDeadline };
