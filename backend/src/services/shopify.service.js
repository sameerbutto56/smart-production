/**
 * Mock Shopify Sync Service
 * In a real production app, this would use the @shopify/shopify-api package
 * to fetch orders from the Shopify Admin API.
 */

const syncShopifyOrders = async (prisma, io) => {
  console.log('Starting Shopify sync...');
  
  // Mock data representing orders from Shopify
  const mockShopifyOrders = [
    {
      id: 'gid://shopify/Order/123456789',
      customer_name: 'Alice Smith',
      line_items: [{ title: 'Custom Dress', quantity: 1 }],
      note_attributes: [{ name: 'Customization', value: 'Engraved buttons' }],
      priority: false
    },
    {
      id: 'gid://shopify/Order/987654321',
      customer_name: 'Bob Jones',
      line_items: [{ title: 'Standard Suit', quantity: 1 }],
      priority: true
    }
  ];

  for (const sOrder of mockShopifyOrders) {
    try {
      // Check if order already exists
      const existing = await prisma.order.findUnique({
        where: { shopifyOrderId: sOrder.id }
      });

      if (!existing) {
        const order = await prisma.order.create({
          data: {
            shopifyOrderId: sOrder.id,
            customerName: sOrder.customer_name,
            type: sOrder.note_attributes ? 'custom' : 'simple',
            urgent: sOrder.priority || false,
            customization: sOrder.note_attributes ? JSON.stringify({ details: sOrder.note_attributes[0].value }) : null,
            currentStage: 'STORE',
            status: 'PENDING'
          }
        });

        // Initialize first stage
        await prisma.orderStage.create({
          data: {
            orderId: order.id,
            stageName: 'STORE',
            status: 'PENDING',
            deadlineAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
          }
        });

        io.emit('new-order', order);
        console.log(`Synced new Shopify order: ${sOrder.id}`);
      }
    } catch (error) {
      console.error(`Error syncing Shopify order ${sOrder.id}:`, error);
    }
  }
};

module.exports = { syncShopifyOrders };
