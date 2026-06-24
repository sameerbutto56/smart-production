const bcrypt = require('bcryptjs');
const p = require('./src/prisma');
(async () => {
  try {
    const existing = await p.user.findUnique({ where: { email: 'customerquery@enamels.com' } });
    if (existing) { console.log('User already exists, updating password...'); await p.user.update({ where: { email: 'customerquery@enamels.com' }, data: { password: await bcrypt.hash('enamels1212', 10) } }); }
    else { await p.user.create({ data: { name: 'Customer Query', email: 'customerquery@enamels.com', password: await bcrypt.hash('enamels1212', 10), role: 'INVENTORY_VIEW' } }); }
    console.log('User created/updated: customerquery@enamels.com / enamels1212');
  } catch(e) { console.error('Error:', e.message); }
  finally { await p.$disconnect(); }
})();
