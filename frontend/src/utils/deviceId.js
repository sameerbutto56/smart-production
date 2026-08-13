const KEY = 'enamels_device_id';

function randomId() {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  bytes.forEach((b) => out += b.toString(16).padStart(2, '0'));
  return `${Date.now().toString(16)}-${out}`;
}

function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anon-' + Math.random().toString(36).slice(2);
  }
}

function getDeviceName() {
  const ua = navigator.userAgent || '';
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  else if (/MSIE|Trident/.test(ua)) browser = 'Internet Explorer';

  const plat = navigator.platform || '';
  let os = 'OS';
  if (/Win/.test(plat)) os = 'Windows';
  else if (/Mac/.test(plat)) os = 'Mac';
  else if (/Linux/.test(plat)) os = 'Linux';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';

  return `${browser} on ${os}`;
}

export function getDeviceInfo() {
  return {
    deviceId: getDeviceId(),
    deviceName: getDeviceName(),
  };
}
