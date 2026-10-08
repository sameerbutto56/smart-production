const { calculateAttendanceMetrics } = require('../src/utils/attendanceUtils');
const assert = require('assert');

console.log('--- Running Attendance & Overtime Verification Test ---');

// Test Case 1: Early check-in within tolerance (10 mins)
// Scheduled: 10:00, Check-in: 09:50 -> earlyArrival: 10m, earlyCheckInOt: 0m
const tc1 = calculateAttendanceMetrics('10:00', '18:00', '09:50', '18:00', 'PRESENT');
console.log('TC1 (09:50 in, 18:00 out):', tc1);
assert.strictEqual(tc1.earlyArrivalMinutes, 10, 'TC1 earlyArrivalMinutes must be 10');
assert.strictEqual(tc1.earlyCheckInOt, 0, 'TC1 earlyCheckInOt must be 0');
assert.strictEqual(tc1.lateMinutes, 0, 'TC1 lateMinutes must be 0');
assert.strictEqual(tc1.checkoutOtMinutes, 0, 'TC1 checkoutOtMinutes must be 0');
assert.strictEqual(tc1.overtimeMinutes, 0, 'TC1 overtimeMinutes must be 0');

// Test Case 2: Early check-in 20 mins before (overtime = 20 - 10 = 10m)
// Scheduled: 10:00, Check-in: 09:40
const tc2 = calculateAttendanceMetrics('10:00', '18:00', '09:40', '18:00', 'PRESENT');
console.log('TC2 (09:40 in, 18:00 out):', tc2);
assert.strictEqual(tc2.earlyArrivalMinutes, 20, 'TC2 earlyArrivalMinutes must be 20');
assert.strictEqual(tc2.earlyCheckInOt, 10, 'TC2 earlyCheckInOt must be 10');
assert.strictEqual(tc2.overtimeMinutes, 10, 'TC2 overtimeMinutes must be 10');

// Test Case 3: Early check-in 60 mins before (overtime = 60 - 10 = 50m)
// Scheduled: 10:00, Check-in: 09:00
const tc3 = calculateAttendanceMetrics('10:00', '18:00', '09:00', '18:00', 'PRESENT');
console.log('TC3 (09:00 in, 18:00 out):', tc3);
assert.strictEqual(tc3.earlyArrivalMinutes, 60, 'TC3 earlyArrivalMinutes must be 60');
assert.strictEqual(tc3.earlyCheckInOt, 50, 'TC3 earlyCheckInOt must be 50');
assert.strictEqual(tc3.overtimeMinutes, 50, 'TC3 overtimeMinutes must be 50');

// Test Case 4: Late check-in within grace (15 mins)
// Scheduled: 10:00, Check-in: 10:12 -> late: 0, early OT: 0
const tc4 = calculateAttendanceMetrics('10:00', '18:00', '10:12', '18:00', 'PRESENT');
console.log('TC4 (10:12 in, 18:00 out):', tc4);
assert.strictEqual(tc4.lateMinutes, 0, 'TC4 lateMinutes must be 0');
assert.strictEqual(tc4.earlyCheckInOt, 0, 'TC4 earlyCheckInOt must be 0');

// Test Case 5: Late check-in beyond grace
// Scheduled: 10:00, Check-in: 10:20 -> late: 20 - 15 = 5m
const tc5 = calculateAttendanceMetrics('10:00', '18:00', '10:20', '18:00', 'PRESENT');
console.log('TC5 (10:20 in, 18:00 out):', tc5);
assert.strictEqual(tc5.lateMinutes, 5, 'TC5 lateMinutes must be 5');
assert.strictEqual(tc5.earlyCheckInOt, 0, 'TC5 earlyCheckInOt must be 0');

// Test Case 6: Checkout overtime within 15m tolerance
// Scheduled: 18:00, Checkout: 18:15 -> checkoutOt: 0
const tc6 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '18:15', 'PRESENT');
console.log('TC6 (10:00 in, 18:15 out):', tc6);
assert.strictEqual(tc6.checkoutOtMinutes, 0, 'TC6 checkoutOtMinutes must be 0');

// Test Case 7: Checkout overtime beyond 15m tolerance
// Scheduled: 18:00, Checkout: 18:30 -> checkoutOt: 30 - 15 = 15m
const tc7 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '18:30', 'PRESENT');
console.log('TC7 (10:00 in, 18:30 out):', tc7);
assert.strictEqual(tc7.checkoutOtMinutes, 15, 'TC7 checkoutOtMinutes must be 15');
assert.strictEqual(tc7.overtimeMinutes, 15, 'TC7 overtimeMinutes must be 15');

// Test Case 8: Both Early Check-in OT (09:30 -> 20m OT) and Checkout OT (19:00 -> 45m OT)
// Total Daily OT = 20 + 45 = 65m
const tc8 = calculateAttendanceMetrics('10:00', '18:00', '09:30', '19:00', 'PRESENT');
console.log('TC8 (09:30 in, 19:00 out):', tc8);
assert.strictEqual(tc8.earlyArrivalMinutes, 30, 'TC8 earlyArrivalMinutes must be 30');
assert.strictEqual(tc8.earlyCheckInOt, 20, 'TC8 earlyCheckInOt must be 20');
assert.strictEqual(tc8.checkoutOtMinutes, 45, 'TC8 checkoutOtMinutes must be 45');
assert.strictEqual(tc8.overtimeMinutes, 65, 'TC8 overtimeMinutes must be 65');

// Test Case 9: Early Checkout within tolerance (10m)
// Scheduled: 18:00, Checkout: 17:55 -> earlyCheckout: 0
const tc9 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '17:55', 'PRESENT');
console.log('TC9 (10:00 in, 17:55 out):', tc9);
assert.strictEqual(tc9.earlyMinutes, 0, 'TC9 earlyMinutes must be 0');

// Test Case 10: Early Checkout beyond tolerance
// Scheduled: 18:00, Checkout: 17:30 -> earlyCheckout: 30m
const tc10 = calculateAttendanceMetrics('10:00', '18:00', '10:00', '17:30', 'PRESENT');
console.log('TC10 (10:00 in, 17:30 out):', tc10);
assert.strictEqual(tc10.earlyMinutes, 30, 'TC10 earlyMinutes must be 30');

console.log(' All 10 Attendance & Overtime test cases passed successfully!');
process.exit(0);
