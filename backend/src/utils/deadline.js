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

  const WORK_START = 8;
  const WORK_END = 20;

  while (remainingHours > 0) {
    // If it's outside working hours or weekend, move to next working start
    if (currentDate.getHours() >= WORK_END || currentDate.getHours() < WORK_START || isWeekend(currentDate)) {
      currentDate = addDays(currentDate, 1);
      currentDate = setHours(currentDate, WORK_START);
      currentDate = setMinutes(currentDate, 0);
      currentDate = setSeconds(currentDate, 0);
      if (isWeekend(currentDate)) continue;
    }

    // How many hours left today?
    const hoursLeftToday = WORK_END - currentDate.getHours();
    
    if (remainingHours <= hoursLeftToday) {
      currentDate = addHours(currentDate, remainingHours);
      remainingHours = 0;
    } else {
      remainingHours -= hoursLeftToday;
      currentDate = addDays(currentDate, 1);
      currentDate = setHours(currentDate, WORK_START);
      currentDate = setMinutes(currentDate, 0);
      currentDate = setSeconds(currentDate, 0);
    }
  }

  return currentDate;
};

module.exports = { calculateDeadline };
