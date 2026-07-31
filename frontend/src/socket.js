import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : window.location.origin
);

const WS_URL = import.meta.env.VITE_WS_URL || API_URL;

// Vercel serverless functions cannot host a socket.io server (no WebSocket upgrade
// passthrough, and the polling transport loses sessions because requests can land on
// different stateless instances), so attempting a connection there only produces a
// stream of /socket.io/ 404s + reconnect storms. Only connect on localhost or when an
// explicit VITE_WS_URL (a self-hosted socket server) is configured.
function socketAvailable() {
  if (import.meta.env.VITE_WS_URL) return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function createStub() {
  return { on: () => createStub(), off: () => createStub(), emit: () => createStub(), connect: () => {}, disconnect: () => {}, id: null, connected: false };
}

let _socket = null;

function connectSocket(token) {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  _socket = token && socketAvailable()
    ? io(WS_URL, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 8000,
        timeout: 8000,
        transports: ['polling', 'websocket'],
      })
    : createStub();
  return _socket;
}

function getSocket() {
  if (_socket) return _socket;
  const token = sessionStorage.getItem('token');
  return connectSocket(token);
}

function resetSocket() {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

const socketProxy = new Proxy({}, {
  get(_, prop) {
    const s = getSocket();
    const val = s[prop];
    if (typeof val === 'function') return val.bind(s);
    return val;
  }
});

export { resetSocket, connectSocket };
export default socketProxy;
