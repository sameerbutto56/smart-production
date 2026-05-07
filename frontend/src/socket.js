import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:5000' : 'https://smart-production-production.up.railway.app');
const socket = io(API_URL, {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default socket;
