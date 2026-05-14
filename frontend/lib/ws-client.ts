/**
 * socket.io singleton clients — one per namespace.
 * Safe to import in SSR (returns null on server).
 */

import { type Socket, io } from 'socket.io-client';
import { getToken } from '@/lib/auth';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? '';

function makeSocket(namespace: string): Socket | null {
  if (typeof window === 'undefined') return null;
  return io(`${WS_URL}${namespace}`, {
    transports: ['websocket'],
    auth: { token: getToken() },
    autoConnect: true,
    reconnectionDelay: 2000,
  });
}

// Lazily created singletons
let _predictions: Socket | null = null;
let _snapshots: Socket | null = null;
let _decisions: Socket | null = null;

export function getPredictionsSocket(): Socket | null {
  if (!_predictions) _predictions = makeSocket('/predictions');
  return _predictions;
}

export function getSnapshotsSocket(): Socket | null {
  if (!_snapshots) _snapshots = makeSocket('/snapshots');
  return _snapshots;
}

export function getDecisionsSocket(): Socket | null {
  if (!_decisions) _decisions = makeSocket('/decisions');
  return _decisions;
}
