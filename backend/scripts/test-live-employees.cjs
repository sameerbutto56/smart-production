const prisma = require('../src/prisma');

async function checkEmployees() {
  console.log("=== CHECKING OUTLET EMPLOYEES IN DB ===");
  
  const allEmployees = await prisma.outletEmployee.findMany({
    where: { isActive: true },
    select: { id: true, name: true, profiles: true, outletName: true }
  });

  console.log("All Active Outlet Employees in DB:");
  console.table(allEmployees.map(e => ({
    name: e.name,
    outlet: e.outletName,
    profiles: JSON.stringify(e.profiles)
  })));

  const dispatchers = allEmployees.filter(e => Array.isArray(e.profiles) && e.profiles.includes('DISPATCH'));
  console.log("Active DISPATCH profile employees:", dispatchers.map(d => d.name));
}

checkEmployees().catch(console.error).finally(() => prisma.$disconnect());
