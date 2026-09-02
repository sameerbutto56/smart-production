const { getDispatchProfileOrders } = require('../src/controllers/dispatch-profile.controller');

async function testDirect() {
  const req = { query: { employeeName: 'Noman' } };
  const res = {
    json: (data) => {
      console.log("RESPONSE JSON:", {
        counts: data.counts,
        unseenCount: data.unseen?.length,
        seenCount: data.seen?.length,
        activeCount: data.active?.length,
        alreadyStartedCount: data.alreadyStarted?.length,
        first5Unseen: data.unseen?.slice(0, 5).map(o => o.orderNumber)
      });
    },
    status: (code) => {
      console.log("RESPONSE STATUS:", code);
      return res;
    }
  };

  await getDispatchProfileOrders(req, res);
}

testDirect().catch(console.error);
