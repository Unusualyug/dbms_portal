import { useEffect } from 'react';
import { api } from '../services/api';
import { connectPortalSocket, disconnectPortalSocket } from '../services/socket';

export function usePresenceHeartbeat(enabled) {
  useEffect(() => {
    if (!enabled) { disconnectPortalSocket(); return undefined; }
    const socket = connectPortalSocket();
    let reconnectTimer;
    const handleDisconnect = (reason) => {
      if (reason !== 'io server disconnect') return;
      reconnectTimer = window.setTimeout(async () => {
        try {
          await api.get('/auth/me');
          socket.connect();
        } catch {
          window.dispatchEvent(new Event('portal:auth-invalidated'));
        }
      }, 700);
    };
    socket.on('disconnect', handleDisconnect);
    const pulse = () => {
      if (document.visibilityState === 'visible') {
        api.post('/student/activity/pulse').catch(() => {});
        socket.emit('client:heartbeat');
      }
    };
    pulse();
    const interval = window.setInterval(pulse, 25000);
    document.addEventListener('visibilitychange', pulse);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(reconnectTimer);
      socket.off('disconnect', handleDisconnect);
      document.removeEventListener('visibilitychange', pulse);
      disconnectPortalSocket();
    };
  }, [enabled]);
}
