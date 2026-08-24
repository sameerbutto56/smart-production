/**
 * PostEx Courier Integration Service
 *
 * Integration Ready Mode: all architecture is in place.
 * Actual PostEx API calls only fire when mode === 'LIVE'.
 * Mode 'OFF' = no API calls, 'TEST' = sandbox credentials, 'LIVE' = production.
 */

const prisma = require('../prisma');

// ─── Feature Flag ──────────────────────────────────────────────────────────

let _integrationMode = 'OFF'; // OFF | TEST | LIVE
let _apiCredentials = null;   // { apiKey, senderName, senderPhone, endpoint }
let _modeLoadedAt = null;
const MODE_CACHE_TTL = 30_000; // 30s

async function getIntegrationMode() {
  if (_modeLoadedAt && Date.now() - _modeLoadedAt < MODE_CACHE_TTL) {
    return _integrationMode;
  }
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'POSTEX_CONFIG' } });
    if (setting) {
      const config = JSON.parse(setting.value);
      _integrationMode = config.mode || 'OFF';
      _apiCredentials = config.credentials || null;
    }
  } catch { /* default OFF */ }
  _modeLoadedAt = Date.now();
  return _integrationMode;
}

async function setIntegrationMode(mode, credentials) {
  if (!['OFF', 'TEST', 'LIVE'].includes(mode)) {
    throw new Error('Invalid mode. Must be OFF, TEST, or LIVE.');
  }
  const config = { mode, credentials: credentials || _apiCredentials, updatedAt: new Date().toISOString() };
  await prisma.systemSetting.upsert({
    where: { key: 'POSTEX_CONFIG' },
    update: { value: JSON.stringify(config) },
    create: { key: 'POSTEX_CONFIG', value: JSON.stringify(config) }
  });
  _integrationMode = mode;
  _apiCredentials = credentials || _apiCredentials;
  _modeLoadedAt = Date.now();
  return { mode, configured: Boolean(_apiCredentials) };
}

async function getConfig() {
  const mode = await getIntegrationMode();
  return {
    mode,
    isLive: mode === 'LIVE',
    isTest: mode === 'TEST',
    isOff: mode === 'OFF',
    hasCredentials: Boolean(_apiCredentials),
    configuredAt: _modeLoadedAt ? new Date(_modeLoadedAt).toISOString() : null
  };
}

function invalidateModeCache() {
  _modeLoadedAt = null;
}

// ─── Status Mapping ────────────────────────────────────────────────────────

const POSTEX_STATUS_MAP = {
  // PostEx status → Enamels system status
  'shipment_created': 'CREATED',
  'booked': 'BOOKED',
  'picked_up': 'PICKED_UP',
  'in_transit': 'IN_TRANSIT',
  'out_for_delivery': 'OUT_FOR_DELIVERY',
  'delivered': 'DELIVERED',
  'failed_delivery': 'FAILED_DELIVERY',
  'return': 'RETURNED',
  'return_in_transit': 'RETURN_IN_TRANSIT',
  'return_received': 'RETURN_RECEIVED',
  'cancelled': 'CANCELLED',
  // Aliases (PostEx may send these)
  'Shipment Created': 'CREATED',
  'Picked Up': 'PICKED_UP',
  'In Transit': 'IN_TRANSIT',
  'Out for Delivery': 'OUT_FOR_DELIVERY',
  'Delivered': 'DELIVERED',
  'Failed Delivery': 'FAILED_DELIVERY',
  'Returned': 'RETURNED',
  'Return in Transit': 'RETURN_IN_TRANSIT',
  'Return Received': 'RETURN_RECEIVED',
  'Cancelled': 'CANCELLED'
};

const POSTEX_TO_DELIVERY_STATUS = {
  'CREATED': 'BOOKED',
  'BOOKED': 'BOOKED',
  'PICKED_UP': 'DISPATCHED',
  'IN_TRANSIT': 'IN_TRANSIT',
  'OUT_FOR_DELIVERY': 'IN_TRANSIT',
  'DELIVERED': 'DELIVERED',
  'FAILED_DELIVERY': 'RETURNED',
  'RETURNED': 'RETURNED',
  'RETURN_IN_TRANSIT': 'RETURNED',
  'RETURN_RECEIVED': 'RETURNED',
  'CANCELLED': 'REJECTED'
};

const TERMINAL_STATUSES = new Set(['DELIVERED', 'RETURNED', 'RETURN_RECEIVED', 'CANCELLED']);
const RETURN_STATUSES = new Set(['RETURNED', 'RETURN_IN_TRANSIT', 'RETURN_RECEIVED']);

function mapPostExStatus(rawStatus) {
  if (!rawStatus) return 'CREATED';
  const normalized = String(rawStatus).trim();
  return POSTEX_STATUS_MAP[normalized] || POSTEX_STATUS_MAP[normalized.toLowerCase()] || 'CREATED';
}

function isTerminalStatus(status) {
  return TERMINAL_STATUSES.has(status);
}

function isReturnStatus(status) {
  return RETURN_STATUSES.has(status);
}

function toDeliveryStatus(postexStatus) {
  return POSTEX_TO_DELIVERY_STATUS[postexStatus] || 'BOOKED';
}

// ─── Shipment Building ─────────────────────────────────────────────────────

function buildShipmentPayload(order, opts = {}) {
  const items = Array.isArray(order.productDetails) ? order.productDetails : [];
  const productDesc = items.map(i => {
    const name = i.productName || i.name || i.productType || 'Item';
    const color = i.color ? ` (${i.color})` : '';
    const size = i.size ? ` [${i.size}]` : '';
    const qty = i.quantity || 1;
    return `${name}${color}${size} x${qty}`;
  }).join(', ');

  const totalAmount = order.totalPrice || order.grandTotal || 0;
  const codAmount = order.paymentStatus === 'PAID' ? 0 : totalAmount;

  return {
    // Internal reference
    referenceNumber: order.orderNumber || `ORD-${order.id.slice(0, 8)}`,

    // Customer
    customerName: order.customerName || '',
    customerPhone: order.customerPhone || '',
    address: order.address || '',
    city: order.city || '',

    // Parcel
    productDetails: items,
    totalAmount,
    codAmount,
    paymentMethod: order.paymentStatus === 'PAID' ? 'PREPAID' : 'COD',
    parcelWeight: opts.parcelWeight || null,
    parcelDescription: productDesc || `Order ${order.orderNumber}`,

    // Destination
    destinationCity: order.city || '',
    destinationOutlet: order.outletName || '',
    specialInstructions: opts.specialInstructions || order.instructionNotes || '',

    // Order snapshot
    orderNumber: order.orderNumber,
    orderId: order.id
  };
}

// ─── API Client (stub — actual calls only when LIVE) ───────────────────────

async function createPostExShipment(shipmentPayload, credentials) {
  const mode = await getIntegrationMode();

  if (mode === 'OFF') {
    // Return a simulated response
    return {
      success: true,
      simulated: true,
      mode: 'OFF',
      shipmentNumber: `PEX-SIM-${Date.now().toString(36).toUpperCase()}`,
      trackingNumber: `TRK-${Date.now().toString(36).toUpperCase()}`,
      message: 'Integration is OFF. Shipment record created locally without PostEx API call.'
    };
  }

  if (mode === 'TEST') {
    return {
      success: true,
      simulated: true,
      mode: 'TEST',
      shipmentNumber: `PEX-TEST-${Date.now().toString(36).toUpperCase()}`,
      trackingNumber: `TRK-TEST-${Date.now().toString(36).toUpperCase()}`,
      message: 'TEST mode. Shipment record created with sandbox references.'
    };
  }

  // LIVE mode — actual PostEx API call
  // TODO: Replace with real PostEx API endpoint and auth once credentials received
  const creds = credentials || _apiCredentials;
  if (!creds || !creds.apiKey) {
    return { success: false, error: 'PostEx API credentials not configured.', mode: 'LIVE' };
  }

  try {
    const response = await fetch(creds.endpoint || 'https://api.postex.pk/api/v1/shipment/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.apiKey}`,
        'x-api-key': creds.apiKey
      },
      body: JSON.stringify({
        senderName: creds.senderName || 'Enamels',
        senderPhone: creds.senderPhone || '',
        receiverName: shipmentPayload.customerName,
        receiverPhone: shipmentPayload.customerPhone,
        receiverAddress: shipmentPayload.address,
        receiverCity: shipmentPayload.destinationCity || shipmentPayload.city,
        productDescription: shipmentPayload.parcelDescription,
        productWeight: shipmentPayload.parcelWeight || 1,
        codAmount: shipmentPayload.codAmount,
        orderReference: shipmentPayload.referenceNumber,
        specialInstructions: shipmentPayload.specialInstructions,
        items: (shipmentPayload.productDetails || []).map(item => ({
          name: item.productName || item.name || item.productType,
          color: item.color,
          size: item.size,
          quantity: item.quantity || 1
        }))
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || data.error || `PostEx API error: ${response.status}`,
        mode: 'LIVE',
        raw: data
      };
    }

    return {
      success: true,
      simulated: false,
      mode: 'LIVE',
      shipmentNumber: data.shipmentNumber || data.data?.shipmentNumber,
      trackingNumber: data.trackingNumber || data.data?.trackingNumber,
      estimatedDelivery: data.estimatedDelivery || data.data?.estimatedDelivery,
      raw: data
    };
  } catch (err) {
    return { success: false, error: err.message, mode: 'LIVE' };
  }
}

async function trackPostExShipment(trackingNumber, credentials) {
  const mode = await getIntegrationMode();

  if (mode === 'OFF' || mode === 'TEST') {
    return { success: true, simulated: true, status: 'UNKNOWN', trackingNumber, mode };
  }

  const creds = credentials || _apiCredentials;
  if (!creds || !creds.apiKey) {
    return { success: false, error: 'PostEx API credentials not configured.' };
  }

  try {
    const response = await fetch(`${creds.endpoint || 'https://api.postex.pk/api/v1/shipment/track'}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${creds.apiKey}`,
        'x-api-key': creds.apiKey
      },
      body: JSON.stringify({ trackingNumber })
    });
    const data = await response.json();
    return { success: true, data, mode: 'LIVE' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Webhook Validation ────────────────────────────────────────────────────

function validateWebhookPayload(payload) {
  if (!payload) return false;
  // PostEx webhook typically sends trackingNumber + status
  return Boolean(payload.trackingNumber || payload.tracking_number || payload.shipmentNumber);
}

module.exports = {
  getIntegrationMode,
  setIntegrationMode,
  getConfig,
  invalidateModeCache,
  POSTEX_STATUS_MAP,
  POSTEX_TO_DELIVERY_STATUS,
  mapPostExStatus,
  isTerminalStatus,
  isReturnStatus,
  toDeliveryStatus,
  buildShipmentPayload,
  createPostExShipment,
  trackPostExShipment,
  validateWebhookPayload,
  TERMINAL_STATUSES,
  RETURN_STATUSES
};
