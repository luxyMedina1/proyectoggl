import { describe, expect, it } from 'vitest';
import { Notificacion, planPerdidas, rutaPorTipo } from './notificaciones';

const notif = (id: number): Notificacion => ({
    id,
    tipo: 'transferencia_pendiente',
    titulo: 'Transferencia en proceso',
    cuerpo: 'Recibiste una transferencia',
    data: null,
    leida: false,
    createdAt: '2026-09-28T12:00:00Z',
});

describe('rutaPorTipo', () => {
    it('manda transferencias y devoluciones a mis transferencias', () => {
        expect(rutaPorTipo('transferencia_rechazada')).toBe('/perfil/mis_transferencias');
        expect(rutaPorTipo('boleto_devuelto')).toBe('/perfil/mis_transferencias');
    });

    it('manda boleto validado a mis compras y amistad a mis amigos', () => {
        expect(rutaPorTipo('boleto_validado')).toBe('/perfil/mis_compras');
        expect(rutaPorTipo('solicitud_amistad')).toBe('/perfil/mis_amigos');
    });

    it('no navega en comandas', () => {
        expect(rutaPorTipo('comanda_estatus')).toBeNull();
    });
});

describe('planPerdidas', () => {
    it('sin cursor previo solo resume las no leídas', () => {
        const plan = planPerdidas({ notificaciones: [notif(1), notif(2)], hayMas: false, noLeidas: 2 }, false);
        expect(plan.individuales).toEqual([]);
        expect(plan.resumen).toBe('Tienes 2 notificaciones sin leer');
    });

    it('sin cursor y sin no leídas no muestra nada', () => {
        const plan = planPerdidas({ notificaciones: [], hayMas: false, noLeidas: 0 }, false);
        expect(plan).toEqual({ individuales: [], resumen: null });
    });

    it('al reconectar muestra las últimas 3 y resume el resto', () => {
        const lote = [1, 2, 3, 4, 5].map(notif);
        const plan = planPerdidas({ notificaciones: lote, hayMas: false, noLeidas: 5 }, true);
        expect(plan.individuales.map((n) => n.id)).toEqual([3, 4, 5]);
        expect(plan.resumen).toBe('Y 2 notificaciones más mientras estabas sin conexión');
    });

    it('al reconectar con pocas no agrega resumen', () => {
        const plan = planPerdidas({ notificaciones: [notif(7)], hayMas: false, noLeidas: 1 }, true);
        expect(plan.individuales.map((n) => n.id)).toEqual([7]);
        expect(plan.resumen).toBeNull();
    });
});
