import apiApplication from '../api/apiApplication';

export type QrTipo = 'asiento' | 'pase';

export interface QrSeed {
    schemeVersion: 'tqv1';
    qrPublicId: string;
    tipo: QrTipo;
    ownerId: string;
    eventoId: number;
    funcionId: number | null;
    secret: string;
    version: number;
    timeStepSec: number;
    acceptedSkew: number;
    otpBytes: number;
    serverEpoch: number;
    expiresAtEpoch: number;
}

export interface CachedSeed extends QrSeed {
    // Momento local EXACTO (ms) en que se recibió el seed. Se ancla junto al serverEpoch.
    fetchedAtLocalMs: number;
}

// v2: la v1 guardaba un ancla contaminada (fetchedAtLocalEpoch tomado tarde por el path
// initialSeed). Cambiar el prefijo orfana las entradas viejas y fuerza un fetch fresco.
const STORAGE_PREFIX = 'qr_seed_v2:';
const LEGACY_PREFIXES = ['qr_seed:'];

const storageKey = (tipo: QrTipo, boletoId: number) => `${STORAGE_PREFIX}${tipo}:${boletoId}`;

export const saveSeed = (tipo: QrTipo, boletoId: number, seed: QrSeed): CachedSeed => {
    const cached: CachedSeed = { ...seed, fetchedAtLocalMs: Date.now() };
    try {
        sessionStorage.setItem(storageKey(tipo, boletoId), JSON.stringify(cached));
    } catch {
        // sessionStorage llena o bloqueada — funciona en memoria igual
    }
    return cached;
};

export const loadSeed = (tipo: QrTipo, boletoId: number): CachedSeed | null => {
    try {
        const raw = sessionStorage.getItem(storageKey(tipo, boletoId));
        if (!raw) return null;
        return JSON.parse(raw) as CachedSeed;
    } catch {
        return null;
    }
};

export const clearSeed = (tipo: QrTipo, boletoId: number) => {
    try {
        sessionStorage.removeItem(storageKey(tipo, boletoId));
    } catch {
        // ignore
    }
};

export const clearAllSeeds = () => {
    try {
        const prefixes = [STORAGE_PREFIX, ...LEGACY_PREFIXES];
        const toRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const k = sessionStorage.key(i);
            if (k && prefixes.some((p) => k.startsWith(p))) toRemove.push(k);
        }
        toRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
        // ignore
    }
};

export const fetchSeed = async (tipo: QrTipo, boletoId: number): Promise<CachedSeed> => {
    const { data } = await apiApplication.get<QrSeed>('/dynamic-qr/seed', {
        params: { tipo, boletoId },
    });
    return saveSeed(tipo, boletoId, data);
};

export const base64ToBytes = (b64: string): Uint8Array => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
};

export const bytesToBase64Url = (bytes: Uint8Array): string => {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const utf8 = (s: string) => new TextEncoder().encode(s);

export const hmacSha256 = async (keyBytes: Uint8Array, msg: Uint8Array): Promise<Uint8Array> => {
    const key = await crypto.subtle.importKey(
        'raw',
        keyBytes as BufferSource,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, msg as BufferSource);
    return new Uint8Array(sig);
};

export interface ComputedQr {
    qrText: string;
    ts: number;
    secondsLeft: number;
}

/**
 * Hora del servidor anclada localmente: serverEpoch (al fetch) + tiempo transcurrido.
 * Solo depende de medir *tiempo transcurrido* (siempre confiable), no de la hora
 * absoluta del dispositivo. Ver doc §3.1.
 */
export const serverNowSec = (seed: CachedSeed, nowMs: number = Date.now()): number => {
    const elapsedSec = (nowMs - seed.fetchedAtLocalMs) / 1000;
    return seed.serverEpoch + elapsedSec;
};

export const computeQr = async (seed: CachedSeed, nowMs: number = Date.now()): Promise<ComputedQr> => {
    const serverNow = serverNowSec(seed, nowMs);
    const ts = Math.floor(serverNow / seed.timeStepSec);

    const msg = `tqv1|${seed.version}|${seed.qrPublicId}|${seed.ownerId}|${seed.eventoId}|${ts}`;
    const keyBytes = base64ToBytes(seed.secret);
    const macBytes = await hmacSha256(keyBytes, utf8(msg));
    const otp = bytesToBase64Url(macBytes.slice(0, seed.otpBytes));

    const qrText = `${seed.schemeVersion}.${seed.eventoId}.${seed.qrPublicId}.${ts}.${otp}`;
    const nextRotation = (ts + 1) * seed.timeStepSec;
    const secondsLeft = Math.max(0, Math.ceil(nextRotation - serverNow));
    return { qrText, ts, secondsLeft };
};
