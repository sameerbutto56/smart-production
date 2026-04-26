const { addHours, addDays, isWeekend, setHours, setMinutes, setSeconds, isBefore, isAfter, addMinutes } = require('date-fns');

const WORKING_HOURS_START = 8;
const WORKING_HOURS_END = 20;

/**
 * Calculates a deadline by adding duration while skipping non-working hours and weekends.
 * @param {Date} startDate 
 * @param {number} durationHours 
 * @returns {Date}
 */
const calculateDeadline = (startDate, durationHours) => {
  let currentDate = new Date(startDate);
  let remainingHours = durationHours;

  while (remainingHours > 0) {
    // 1. If it's a weekend, skip to Monday 8 AM
    if (isWeekend(currentDate)) {
      currentDate = addDays(currentDate, 1);
      currentDate = setHours(currentDate, WORKING_HOURS_START);
      currentDate = setMinutes(currentDate, 0);
      currentDate = setSeconds(currentDate, 0);
      continue;
    }

    // 2. If it's before working hours, skip to 8 AM today
    const startOfWork = setHours(new Date(currentDate), WORKING_HOURS_START);
    if (isBefore(currentDate, startOfWork)) {
      currentDate = startOfWork;
      currentDate = setMinutes(currentDate, 0);
      continue;
    }

    // 3. If it's after working hours, skip to 8 AM tomorrow
    const endOfWork = setHours(new Date(currentDate), WORKING_HOURS_END);
    if (isAfter(currentDate, endOfWork)) {
      currentDate = addDays(currentDate, 1);
      currentDate = setHours(currentDate, WORKING_HOURS_START);
      currentDate = setMinutes(currentDate, 0);
      continue;
    }

    // 4. Calculate how many hours are left in the current workday
    const hoursLeftInDay = WORKING_HOURS_END - currentDate.getHours() - (currentDate.getMinutes() / 60);
    
    if (remainingHours <= hoursLeftInDay) {
      // Deadline falls within today
      currentDate = addMinutes(currentDate, remainingHours * 60);
      remainingHours = 0;
    } else {
      // Move to next day
      remainingHours -= hoursLeftInDay;
      currentDate = addDays(currentDate, 1);
      currentDate = setHours(currentDate, WORKING_HOURS_START);
      currentDate = setMinutes(currentDate, 0);
    }
  }

  return currentDate;
};

module.exports = { calculateDeadline };
