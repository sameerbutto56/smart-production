const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== STARTING REPAIR OF HISTORICAL POS BOOK SESSIONS ===\n');
  const sessions = await prisma.posBookSession.findMany({
    where: { status: 'CLOSED' },
    orderBy: { openedAt: 'asc' },
  });

  let repairedCount = 0;

  for (const s of sessions) {
    const summary = typeof s.summary === 'string' ? JSON.parse(s.summary) : (s.summary || {});
    const rawCash = Number(summary.paymentSummary?.cashCollected ?? summary.paymentSummary?.cash ?? 0);
    const totalJournalEntries = Number(summary.totalJournalEntries || 0);
    const cashReturns = Number(summary.returnSummary?.cash || 0);
    const totalFaisalTake = Number(summary.totalFaisalTake || 0);
    const correctAvailableCash = Math.max(0, Math.round((rawCash - totalJournalEntries - cashReturns - totalFaisalTake) * 100) / 100);

    const oldAvailableCash = summary.availableCash;
    const cashRow = summary.paymentBreakdown?.find(p => p.method === 'CASH');
    const oldCashNet = cashRow?.net;

    if (oldAvailableCash !== correctAvailableCash || oldCashNet !== correctAvailableCash) {
      summary.availableCash = correctAvailableCash;
      if (cashRow) {
        cashRow.net = correctAvailableCash;
      }
      summary.remainingLockerCash = Math.max(0, Math.round((correctAvailableCash - (summary.transferToSystem || 0)) * 100) / 100);

      await prisma.posBookSession.update({
        where: { id: s.id },
        data: {
          summary: JSON.stringify(summary),
        },
      });

      console.log(`[REPAIRED] ${s.outletName} (${s.openedAt.toISOString().slice(0, 10)})`);
      console.log(`  Cash: ${rawCash} | GenEntry: -${totalJournalEntries} | Returns: -${cashReturns}`);
      console.log(`  Available Cash: ${oldAvailableCash} -> ${correctAvailableCash}`);
      repairedCount++;
    }
  }

  console.log(`\nSuccessfully repaired ${repairedCount} sessions.`);
}

main()
  .catch(err => {
    console.error('Repair error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
