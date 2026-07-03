import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : window.location.origin
);

const WS_URL = import.meta.env.VITE_WS_URL || API_URL;

const token = sessionStorage.getItem('token');

function createStub() {
  return { on: () => createStub(), off: () => createStub(), emit: () => createStub(), connect: () => {}, disconnect: () => {}, id: null, connected: false };
}

// Only attempt WebSocket if we have a token and WebSockets are explicitly configured or running locally
const canWebSocket = import.meta.env.VITE_WS_URL || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const socket = token && canWebSocket
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

export default socket;
