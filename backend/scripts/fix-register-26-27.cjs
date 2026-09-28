// Fix Register 26 and 27 Sep Data Inconsistency & Cleanup Ghost Open Sessions
// Root Cause:
// On the morning of 26 Sep, rapid duplicate clicks created two concurrent OPEN sessions at the exact same second:
// - One session was closed on the evening of 26 Sep (covering 26 Sep sales).
// - The second session remained OPEN throughout the night and all day 27 Sep.
// - On the evening of 27 Sep, the cashier closed the register, which closed the second session.
// - Because its openedAt was 26 Sep, the UI grouped it under 26 Sep, showing 2 registers of 26 and 0 registers of 27,
//   and its summary aggregated both days.
//
// Fix Actions:
// 1. Correct openedAt of the 27 Sep session to 2026-09-27T05:00:00.000Z for Jail Road & Johar Town.
// 2. Recompute the 27 Sep summary for both outlets so sales are accurately partitioned between 26 and 27 Sep.
// 3. Remove duplicate ghost OPEN sessions from 28 Sep (today) at Jail Road.

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { computeBookSummary } = require('../src/controllers/pos.book.controller.js');

async function fixRegisters() {
  console.log('=== STARTING REGISTER 26 & 27 FIX ===\n');

  // 1. JAIL ROAD FIX
  console.log('[1/3] Fixing Jail Road 27 Sep Register...');
  const jrSessionId = '074a9b8f-a598-436b-a0e8-8949616b79bf';
  const jrSession = await prisma.posBookSession.findUnique({ where: { id: jrSessionId } });
  if (jrSession) {
    const jrNewOpenedAt = new Date('2026-09-27T05:00:00.000Z');
    const updatedJrSessionObj = {
      ...jrSession,
      openedAt: jrNewOpenedAt,
    };
    const jrSummary = await computeBookSummary(updatedJrSessionObj);

    await prisma.posBookSession.update({
      where: { id: jrSessionId },
      data: {
        openedAt: jrNewOpenedAt,
        summary: JSON.stringify(jrSummary),
      },
    });
    console.log('✓ Jail Road 27 Sep register updated:');
    console.log(`  Opened: ${jrNewOpenedAt.toISOString()}, Closed: ${jrSession.closedAt.toISOString()}`);
    console.log(`  Gross Sales: Rs. ${jrSummary.grossSales}, Net: Rs. ${jrSummary.netRevenue}, Available Cash: Rs. ${jrSummary.availableCash}, Sales Count: ${jrSummary.sales?.length}`);
  } else {
    console.warn('Jail Road session not found:', jrSessionId);
  }

  // 2. JOHAR TOWN FIX
  console.log('\n[2/3] Fixing Johar Town 27 Sep Register...');
  const jtSessionId = '4c14e6c6-fb1c-4dee-9d0d-8bfaf4ddd522';
  const jtSession = await prisma.posBookSession.findUnique({ where: { id: jtSessionId } });
  if (jtSession) {
    const jtNewOpenedAt = new Date('2026-09-27T05:00:00.000Z');
    const updatedJtSessionObj = {
      ...jtSession,
      openedAt: jtNewOpenedAt,
    };
    const jtSummary = await computeBookSummary(updatedJtSessionObj);

    await prisma.posBookSession.update({
      where: { id: jtSessionId },
      data: {
        openedAt: jtNewOpenedAt,
        summary: JSON.stringify(jtSummary),
      },
    });
    console.log('✓ Johar Town 27 Sep register updated:');
    console.log(`  Opened: ${jtNewOpenedAt.toISOString()}, Closed: ${jtSession.closedAt.toISOString()}`);
    console.log(`  Gross Sales: Rs. ${jtSummary.grossSales}, Net: Rs. ${jtSummary.netRevenue}, Available Cash: Rs. ${jtSummary.availableCash}, Sales Count: ${jtSummary.sales?.length}`);
  } else {
    console.warn('Johar Town session not found:', jtSessionId);
  }

  // 3. CLEANUP 28 SEP GHOST OPEN SESSIONS AT JAIL ROAD
  console.log('\n[3/3] Cleaning up duplicate ghost OPEN sessions from today (28 Sep) at Jail Road...');
  const ghostIds = [
    'cfd82cbe-5fe7-4b4b-900e-3b68c5e7bced',
    'c24d64d9-3f38-45b4-acf4-4dd047e8f49d',
  ];
  const deleteResult = await prisma.posBookSession.deleteMany({
    where: {
      id: { in: ghostIds },
      status: 'OPEN',
    },
  });
  console.log(`✓ Deleted ${deleteResult.count} duplicate ghost OPEN sessions at Jail Road.`);

  // 4. VERIFICATION OF FINAL SESSIONS
  console.log('\n=== VERIFICATION OF REGISTERS ===');
  for (const outlet of ['Jail Road', 'Johar Town']) {
    console.log(`\n--- ${outlet} Registers ---`);
    const sessions = await prisma.posBookSession.findMany({
      where: { outletName: outlet },
      orderBy: { openedAt: 'desc' },
      take: 6,
    });
    for (const s of sessions) {
      const parsed = JSON.parse(s.summary || '{}');
      console.log(`  ID: ${s.id.slice(0, 8)} | Status: ${s.status.padEnd(6)} | Open: ${s.openedAt.toISOString().slice(0, 16)} | Close: ${s.closedAt ? s.closedAt.toISOString().slice(0, 16) : 'IN PROGRESS'} | Gross: Rs. ${parsed.grossSales || parsed.paymentSummary?.grandTotal || 0} | Cash: Rs. ${parsed.availableCash || 0}`);
    }
  }

  console.log('\n=== REGISTER FIX COMPLETED SUCCESSFULLY ===');
}

fixRegisters()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
