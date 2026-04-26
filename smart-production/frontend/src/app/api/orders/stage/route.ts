import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DeadlineService } from '@/services/deadlineService';

export async function PATCH(request: Request) {
  try {
    const { id, action, note, employeeId, stockAvailable, advancePaid } = await request.json();

    const order = await prisma.order.findUnique({
      where: { id },
      include: { stages: true }
    });

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const currentStage = order.stages.find((s: any) => s.stageName === order.currentStage);
    if (!currentStage) return NextResponse.json({ error: 'Stage error' }, { status: 400 });

    await prisma.orderStage.update({
      where: { id: currentStage.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });

    let nextStageName: any = null;
    const stages = ['STORE', 'CUTTING', 'STITCHING', 'QUALITY_CHECK', 'PRESSING', 'PACKAGING', 'DISPATCH', 'DELIVERED'];
    const currentIndex = stages.indexOf(order.currentStage);

    if (order.currentStage === 'STORE') {
      nextStageName = stockAvailable ? 'PACKAGING' : 'CUTTING';
    } else if (order.currentStage === 'PACKAGING') {
      nextStageName = 'DISPATCH';
    } else if (currentIndex < stages.length - 1) {
      nextStageName = stages[currentIndex + 1];
    }

    if (nextStageName) {
      const duration = DeadlineService.getStageDuration(nextStageName, order.urgent);
      const deadlineAt = DeadlineService.calculateDeadline(new Date(), duration);

      await prisma.orderStage.create({
        data: {
          orderId: order.id,
          stageName: nextStageName,
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          deadlineAt,
          assignedEmployeeId: employeeId
        }
      });

      await prisma.order.update({
        where: { id },
        data: { 
          currentStage: nextStageName,
          advancePaid: advancePaid !== undefined ? advancePaid : order.advancePaid
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        orderId: order.id,
        action: `Moved from ${order.currentStage} to ${nextStageName || 'FINAL'}`,
        performedBy: employeeId || 'System'
      }
    });

    return NextResponse.json({ message: 'Stage updated' });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Failed to update stage' }, { status: 500 });
  }
}
