import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : window.location.origin
);

const WS_URL = import.meta.env.VITE_WS_URL || API_URL;

function createStub() {
  return { on: () => createStub(), off: () => createStub(), emit: () => createStub(), connect: () => {}, disconnect: () => {}, id: null, connected: false };
}

let _socket = null;

function connectSocket(token) {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
  _socket = token
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
