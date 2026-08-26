import { useEffect, useRef, useState } from 'react';
import {
    CachedSeed,
    QrTipo,
    computeQr,
    fetchSeed,
    loadSeed,
    serverNowSec,
} from '../utils/dynamicQr';

export type DynamicQrStatus = 'idle' | 'loading' | 'ready' | 'expired' | 'error';

interface UseDynamicQrArgs {
    tipo: QrTipo;
    boletoId: number;
    enabled?: boolean;
}

export interface UseDynamicQrResult {
    qrText: string | null;
    secondsLeft: number;
    status: DynamicQrStatus;
    error: string | null;
    refresh: () => Promise<void>;
}

const REFRESH_THRESHOLD_SEC = 30 * 60;

export const useDynamicQr = ({
    tipo,
    boletoId,
    enabled = true,
}: UseDynamicQrArgs): UseDynamicQrResult => {
    const [seed, setSeed] = useState<CachedSeed | null>(null);
    const [qrText, setQrText] = useState<string | null>(null);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const [status, setStatus] = useState<DynamicQrStatus>('idle');
    const [error, setError] = useState<string | null>(null);
    const inFlight = useRef<Promise<void> | null>(null);

    const doRefresh = async () => {
        if (inFlight.current) return inFlight.current;
        const p = (async () => {
            try {
                setStatus('loading');
                setError(null);
                const cached = await fetchSeed(tipo, boletoId);
                setSeed(cached);
                setStatus('ready');
            } catch (e: any) {
                console.error('fetchSeed error', e);
                setError(e?.response?.data?.message ?? 'No se pudo obtener el QR');
                setStatus('error');
            } finally {
                inFlight.current = null;
            }
        })();
        inFlight.current = p;
        return p;
    };

    useEffect(() => {
        if (!enabled) return;
        // Solo se confía en cache producido por fetchSeed (su fetchedAtLocalEpoch fue
        // muestreado junto al serverEpoch, así el clockOffset es válido). El seed embebido
        // en /eventos/mis_eventos no sirve para el offset porque se generó antes de guardarse.
        const cached = loadSeed(tipo, boletoId);
        if (cached) {
            setSeed(cached);
            setStatus('ready');
            // Vida restante anclada a la hora del servidor, no al reloj local crudo.
            const remaining = cached.expiresAtEpoch - serverNowSec(cached);
            if (remaining < REFRESH_THRESHOLD_SEC) {
                doRefresh();
            }
            return;
        }
        doRefresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tipo, boletoId, enabled]);

    useEffect(() => {
        if (!seed) return;
        let cancelled = false;
        const tick = async () => {
            const nowMs = Date.now();
            if (serverNowSec(seed, nowMs) >= seed.expiresAtEpoch) {
                setStatus('expired');
                setQrText(null);
                setSecondsLeft(0);
                doRefresh();
                return;
            }
            const { qrText: text, secondsLeft: left } = await computeQr(seed, nowMs);
            if (cancelled) return;
            setQrText(text);
            setSecondsLeft(left);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [seed]);

    return {
        qrText,
        secondsLeft,
        status,
        error,
        refresh: doRefresh,
    };
};
