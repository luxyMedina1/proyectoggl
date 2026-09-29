import { describe, expect, it } from 'vitest';
import {
    Notificacion,
    afectaAmigos,
    afectaCompras,
    afectaTransferencias,
    planPerdidas,
    rutaPorTipo,
} from './notificaciones';

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

    it('al reconectar con varias perdidas muestra un solo resumen', () => {
        const lote = [1, 2, 3, 4, 5].map(notif);
        const plan = planPerdidas({ notificaciones: lote, hayMas: false, noLeidas: 5 }, true);
        expect(plan.individuales).toEqual([]);
        expect(plan.resumen).toBe('Mientras estabas sin conexión llegaron 5 notificaciones');
    });

    it('al reconectar no cuenta las que ya se leyeron en otro dispositivo', () => {
        const leida = { ...notif(8), leida: true };
        const plan = planPerdidas({ notificaciones: [notif(7), leida, notif(9)], hayMas: false, noLeidas: 2 }, true);
        expect(plan.individuales).toEqual([]);
        expect(plan.resumen).toBe('Mientras estabas sin conexión llegaron 2 notificaciones');
    });

    it('al reconectar con una sola perdida la muestra tal cual', () => {
        const plan = planPerdidas({ notificaciones: [notif(7)], hayMas: false, noLeidas: 1 }, true);
        expect(plan.individuales.map((n) => n.id)).toEqual([7]);
        expect(plan.resumen).toBeNull();
    });

    it('al reconectar sin nada nuevo no muestra nada', () => {
        const plan = planPerdidas({ notificaciones: [], hayMas: false, noLeidas: 0 }, true);
        expect(plan).toEqual({ individuales: [], resumen: null });
    });
});

describe('qué pantalla recarga cada tipo', () => {
    it('sin tipo recarga todo', () => {
        expect(afectaTransferencias()).toBe(true);
        expect(afectaAmigos()).toBe(true);
        expect(afectaCompras()).toBe(true);
    });

    it('transferencias y devoluciones recargan la bandeja de transferencias', () => {
        expect(afectaTransferencias('transferencia_pendiente')).toBe(true);
        expect(afectaTransferencias('boleto_devuelto')).toBe(true);
        expect(afectaTransferencias('boleto_validado')).toBe(false);
    });

    it('boleto validado, devuelto o transferencia aceptada recargan mis compras', () => {
        expect(afectaCompras('boleto_validado')).toBe(true);
        expect(afectaCompras('boleto_devuelto')).toBe(true);
        expect(afectaCompras('transferencia_completada')).toBe(true);
        expect(afectaCompras('transferencia_pendiente')).toBe(false);
    });

    it('solo la solicitud de amistad recarga mis amigos', () => {
        expect(afectaAmigos('solicitud_amistad')).toBe(true);
        expect(afectaAmigos('comanda_estatus')).toBe(false);
    });
});
