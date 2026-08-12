const prisma = require('../backend/src/prisma');

async function main() {
  const sales = await prisma.posSale.findMany({
    where: { outletName: { contains: 'Jail', mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  console.log('--- RECENT JAIL ROAD POS SALES ---');
  console.log(sales.map(s => ({
    receipt: s.receiptNumber,
    method: s.paymentMethod,
    cashAmount: s.cashAmount,
    onlineAmount: s.onlineAmount,
    grandTotal: s.grandTotal,
    advanceAmount: s.advanceAmount,
    createdAt: s.createdAt
  })));

  const cashOnlineSales = await prisma.posSale.findMany({
    where: {
      outletName: { contains: 'Jail', mode: 'insensitive' },
      paymentMethod: 'CASH_ONLINE'
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  console.log('\n--- ALL CASH_ONLINE SALES FOR JAIL ROAD ---');
  console.log(cashOnlineSales.map(s => ({
    receipt: s.receiptNumber,
    method: s.paymentMethod,
    cashAmount: s.cashAmount,
    onlineAmount: s.onlineAmount,
    grandTotal: s.grandTotal,
    advanceAmount: s.advanceAmount,
    createdAt: s.createdAt
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
