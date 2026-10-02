const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getDelayInfo, STAGE_DEPARTMENTS } = require('../frontend/src/utils/delayUtils.js'); // Wait, delayUtils is ES module or CommonJS? Let's check or recreate logic.
