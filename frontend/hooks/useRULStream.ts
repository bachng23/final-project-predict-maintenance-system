"use client";

import { useEffect, useRef, useState } from 'react';
import { getPredictionsSocket, getSnapshotsSocket } from '@/lib/ws-client';

export interface RULPoint {
  ts: string;           // ISO timestamp
  fileIdx: number;
  rulMinutes: number;
  rulLower: number;
  rulUpper: number;
  pFail: number;
  healthScore: number;
  anomaly?: boolean;    // true if a snapshot (anomaly trigger) arrived for this point
  faultType?: string;
}

const MAX_POINTS = 200;

export function useRULStream(bearingId: string) {
  const [points, setPoints] = useState<RULPoint[]>([]);
  const [connected, setConnected] = useState(false);
  const [snapshotsConnected, setSnapshotsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);
  const anomalyFileIdxs = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!bearingId) return;

    const predSock = getPredictionsSocket();
    const snapSock = getSnapshotsSocket();
    if (!predSock || !snapSock) return;

    // Join bearing-specific rooms
    predSock.emit('subscribe', bearingId);
    snapSock.emit('subscribe', bearingId);

    const onPredConnect = () => { setConnected(true); setWsError(null); };
    const onPredDisconnect = () => setConnected(false);
    const onSnapConnect = () => { setSnapshotsConnected(true); setWsError(null); };
    const onSnapDisconnect = () => setSnapshotsConnected(false);
    const onError = (err: Error) => {
      setConnected(false);
      setWsError(err?.message ?? 'WebSocket connection failed');
    };

    predSock.on('connect',       onPredConnect);
    predSock.on('disconnect',    onPredDisconnect);
    predSock.on('connect_error', onError);
    snapSock.on('connect',       onSnapConnect);
    snapSock.on('disconnect',    onSnapDisconnect);
    snapSock.on('connect_error', onError);

    const onPrediction = (payload: Record<string, unknown>) => {
      if (payload.bearing_id !== bearingId) return;
      const fileIdx = payload.file_idx as number;
      const point: RULPoint = {
        ts: payload.sample_ts as string,
        fileIdx,
        rulMinutes: payload.rul_minutes as number,
        rulLower: (payload.rul_lower_minutes as number) ?? 0,
        rulUpper: (payload.rul_upper_minutes as number) ?? 0,
        pFail: payload.p_fail as number,
        healthScore: payload.health_score as number,
        anomaly: anomalyFileIdxs.current.has(fileIdx),
        faultType: payload.fault_type as string | undefined,
      };
      setPoints((prev) => {
        const next = [...prev, point];
        return next.length > MAX_POINTS ? next.slice(-MAX_POINTS) : next;
      });
    };

    const onSnapshot = (payload: Record<string, unknown>) => {
      if (payload.bearing_id !== bearingId) return;
      const fileIdx = payload.trigger_file_idx as number;
      anomalyFileIdxs.current.add(fileIdx);
      // Retroactively mark the point
      setPoints((prev) =>
        prev.map((p) => (p.fileIdx === fileIdx ? { ...p, anomaly: true } : p)),
      );
    };

    predSock.on('prediction', onPrediction);
    snapSock.on('snapshot', onSnapshot);

    return () => {
      predSock.emit('unsubscribe', bearingId);
      snapSock.emit('unsubscribe', bearingId);
      predSock.off('prediction',    onPrediction);
      snapSock.off('snapshot',      onSnapshot);
      predSock.off('connect',       onPredConnect);
      predSock.off('disconnect',    onPredDisconnect);
      predSock.off('connect_error', onError);
      snapSock.off('connect',       onSnapConnect);
      snapSock.off('disconnect',    onSnapDisconnect);
      snapSock.off('connect_error', onError);
    };
  }, [bearingId]);

  return { points, connected, snapshotsConnected, wsError };
}
