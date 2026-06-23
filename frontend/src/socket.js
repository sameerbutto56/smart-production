import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : window.location.origin);
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

function stubSocket() {
  const s = { on: () => s, off: () => s, emit: () => s, connect: () => {}, disconnect: () => {}, id: null, connected: false };
  return s;
}

const socket = isLocal
  ? io(API_URL, { reconnectionAttempts: 5, reconnectionDelay: 1000 })
  : stubSocket();

export default socket;
