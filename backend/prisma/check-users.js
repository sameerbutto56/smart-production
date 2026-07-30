const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ select: { name: true, email: true, role: true } })
  .then(users => {
    console.log(`Users in DB (${users.length}):`);
    users.forEach(u => console.log(' -', u.name, u.email, u.role));
    return p.$disconnect();
  })
  .catch(e => { console.error(e); return p.$disconnect(); });
