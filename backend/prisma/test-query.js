const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findUnique({ where: { email: 'ceo@enamels.com' } })
  .then(user => {
    console.log('Direct query CEO:', user ? user.name + ' ' + user.role : 'NOT FOUND');
    return p.$disconnect();
  })
  .catch(e => { console.error('ERROR:', e.message); return p.$disconnect(); });
