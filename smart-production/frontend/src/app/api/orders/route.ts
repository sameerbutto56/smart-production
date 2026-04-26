import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DeadlineService } from '@/services/deadlineService';

export async function GET() {
  try {
    const orders = await prisma.order.findMany({
      include: { stages: true, auditLogs: true },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(orders);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { customerName, type, urgent, customization, shopifyId } = await request.json();
    
    const order = await prisma.order.create({
      data: {
        customerName,
        shopifyId,
        type: type || 'SIMPLE',
        urgent: urgent || false,
        customization,
        currentStage: 'STORE',
        status: 'IN_PROGRESS'
      }
    });

    const duration = DeadlineService.getStageDuration('STORE', order.urgent);
    const deadlineAt = DeadlineService.calculateDeadline(new Date(), duration);

    await prisma.orderStage.create({
      data: {
        orderId: order.id,
        stageName: 'STORE',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        deadlineAt
      }
    });

    return NextResponse.json(order);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Order creation failed' }, { status: 500 });
  }
}
