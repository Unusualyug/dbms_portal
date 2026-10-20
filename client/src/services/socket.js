import { io } from 'socket.io-client';

let socket;
export function connectPortalSocket() {
  if (!socket) socket = io('/', { path: '/socket.io', withCredentials: true, autoConnect: false, transports: ['websocket', 'polling'] });
  if (!socket.connected) socket.connect();
  return socket;
}
export function disconnectPortalSocket() {
  if (socket?.connected) socket.disconnect();
  socket = null;
}
