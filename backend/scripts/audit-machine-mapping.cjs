const prisma = require('../src/prisma');

async function audit() {
  const employees = await prisma.employeeRecord.findMany({
    select: { id: true, employeeId: true, name: true, machineUserId: true, department: true }
  });

  const punches = await prisma.machineAttendance.findMany({
    distinct: ['machineUserId'],
    select: { machineUserId: true, employeeName: true, rawPayload: true }
  });

  const machineMap = {};
  for (const p of punches) {
    let devName = '';
    try {
      const parsed = typeof p.rawPayload === 'string' ? JSON.parse(p.rawPayload) : p.rawPayload;
      const acEvent = typeof parsed?.AccessControllerEvent === 'string' ? JSON.parse(parsed.AccessControllerEvent) : parsed?.AccessControllerEvent;
      devName = acEvent?.AccessControllerEvent?.name || acEvent?.name || p.employeeName || '';
    } catch {
      devName = p.employeeName || '';
    }
    machineMap[p.machineUserId] = devName;
  }

  console.log('--- Biometric Machine Enrolled Users (from Machine Attendance events) ---');
  for (const [mId, mName] of Object.entries(machineMap).sort((a,b) => parseInt(a[0]) - parseInt(b[0]))) {
    const matchedByMachineUserId = employees.filter(e => e.machineUserId === mId);
    const matchedByEmpId = employees.filter(e => e.employeeId === mId);
    console.log(`Machine ID ${mId.padEnd(4)}: "${mName}"`);
    console.log(`   -> by machineUserId: ${matchedByMachineUserId.map(e => `${e.employeeId} (${e.name})`).join(', ') || 'NONE'}`);
    console.log(`   -> by employeeId:    ${matchedByEmpId.map(e => `${e.employeeId} (${e.name}, machineUserId: ${e.machineUserId})`).join(', ') || 'NONE'}`);
  }

  process.exit(0);
}

audit().catch(console.error);
