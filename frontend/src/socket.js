import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const socket = io(API_URL, {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default socket;
