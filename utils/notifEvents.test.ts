import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    emitNotifRefresh,
    onNotifRefresh,
    pollingDeRespaldo,
    setSocketNotifConectado,
} from './notifEvents';

describe('onNotifRefresh', () => {
    it('recibe el tipo de la notificación que lo disparó', () => {
        const handler = vi.fn();
        const off = onNotifRefresh(handler);
        emitNotifRefresh('boleto_validado');
        emitNotifRefresh();
        off();
        emitNotifRefresh('transferencia_pendiente');
        expect(handler.mock.calls).toEqual([['boleto_validado'], [undefined]]);
    });
});

describe('pollingDeRespaldo', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
        setSocketNotifConectado(false);
        vi.useRealTimers();
    });

    it('solo consulta mientras el socket está caído', () => {
        const fn = vi.fn();
        const off = pollingDeRespaldo(fn, 1000);

        vi.advanceTimersByTime(1000);
        expect(fn).toHaveBeenCalledTimes(1);

        setSocketNotifConectado(true);
        vi.advanceTimersByTime(3000);
        expect(fn).toHaveBeenCalledTimes(1);

        setSocketNotifConectado(false);
        vi.advanceTimersByTime(1000);
        expect(fn).toHaveBeenCalledTimes(2);

        off();
        vi.advanceTimersByTime(5000);
        expect(fn).toHaveBeenCalledTimes(2);
    });
});
