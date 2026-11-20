import { io, type Socket } from 'socket.io-client';
import { getFreshAccessToken, refreshSession } from './api';

let socket: Socket | null = null;

/** One shared connection for collaboration and live workspace updates. */
export function getSocket(): Socket {
  if (socket) return socket;

  const options = {
    // Called on every (re)connect, so expired access tokens are refreshed first.
    auth: (cb: (data: object) => void) => {
      void getFreshAccessToken().then((token) => cb({ token: token ?? '' }));
    },
  };
  const url = import.meta.env.VITE_SOCKET_URL;
  const s = url ? io(url, options) : io(options);

  // Auth failures don't auto-reconnect; refresh the session once and retry.
  s.on('connect_error', (err) => {
    if (err.message !== 'unauthorized') return;
    void refreshSession().then((token) => {
      if (token) setTimeout(() => s.connect(), 500);
    });
  });

  // Browsers keep a dead WebSocket open until the ping times out (~45s); drop it right
  // away so the UI shows "offline" and edits queue locally. Socket.io reconnects when back.
  window.addEventListener('offline', () => s.io.engine?.close());

  socket = s;
  return s;
}

export function closeSocket(): void {
  socket?.disconnect();
  socket = null;
}
