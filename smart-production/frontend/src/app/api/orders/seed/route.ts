import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const roles = [
      'ADMIN', 'MAIN_EMPLOYEE', 'STORE_EMPLOYEE', 'CUTTING_EMPLOYEE', 
      'STITCHING_EMPLOYEE', 'QUALITY_CHECK_EMPLOYEE', 'PRESSING_EMPLOYEE', 'PACKAGING_EMPLOYEE'
    ];

    const password = await bcrypt.hash('pass123', 10);

    for (const role of roles) {
      const email = `${role.toLowerCase()}@enamels.com`;
      await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
          email,
          password,
          name: `${role.replace('_', ' ')}`,
          role: role as any,
          employeeId: `EMP-${role.substring(0, 3)}-${Math.floor(Math.random() * 1000)}`
        }
      });
    }

    return NextResponse.json({ message: 'Users seeded successfully' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Seeding failed' }, { status: 500 });
  }
}
