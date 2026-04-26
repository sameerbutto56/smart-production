import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

const SECRET = process.env.JWT_SECRET || 'smart_production_secret';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const user = await prisma.user.findUnique({ where: { email } });
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET);
    return NextResponse.json({ 
      token, 
      user: { id: user.id, name: user.name, role: user.role } 
    });
  } catch (err) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
