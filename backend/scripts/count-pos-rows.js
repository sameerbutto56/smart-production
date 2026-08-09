require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const totals = await prisma.posSale.groupBy({ by: ['outletName'], _count: true, where: { outletName: { in: ['Johar Town', 'Jail Road', 'Abbottabad'] } } });
  totals.forEach(t => console.log(`${t.outletName}: ${t._count} total sales rows`));
  const sinceJul = await prisma.posSale.count({ where: { outletName: 'Johar Town', createdAt: { gte: new Date('2026-07-01T00:00:00Z') } } });
  console.log(`Johar Town sales since 2026-07-01: ${sinceJul}`);
  const bal = await prisma.posBalancePayment.count();
  console.log(`Total PosBalancePayment rows: ${bal}`);
  const all = await prisma.posSale.count({});
  console.log(`ALL branches total sales rows: ${all}`);
  const faisal = await prisma.posSale.count({ where: { faisalTake: true } });
  console.log(`Faisal-take rows: ${faisal}`);
  const faisalByOutlet = await prisma.posSale.groupBy({ by: ['outletName'], _count: true, where: { faisalTake: true } });
  faisalByOutlet.forEach(t => console.log(`  Faisal ${t.outletName}: ${t._count}`));
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
