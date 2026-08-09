import { randomBytes } from 'node:crypto';

/**
 * Proveedor "manual": el visitante transfiere por Nequi / Daviplata / banco y
 * recepcion confirma con el comprobante a la vista. No hay verificacion
 * automatica, por eso `soportaConfirmacionAutomatica` es false y la recarga
 * nace en estado PENDIENTE.
 */
export const manualProvider = {
  nombre: 'manual',
  soportaConfirmacionAutomatica: false,

  /**
   * Construye los datos que recepcion le muestra al visitante para pagar.
   * El "QR de pago" se arma en el frontend a partir de `contenidoQr`.
   */
  async crearIntento({ montoTotal, moneda, configuracion, referenciaExterna }) {
    const referencia = referenciaExterna || `MIR-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;

    return {
      proveedor: 'manual',
      referencia,
      estado: 'PENDIENTE',
      requiereConfirmacionManual: true,
      instrucciones: {
        titular: configuracion.pagoDigitalTitular || null,
        entidad: configuracion.pagoDigitalEntidad || null,
        numero: configuracion.pagoDigitalNumero || null,
        texto:
          configuracion.pagoDigitalInstrucciones ||
          'Transfiere el monto exacto y muestra el comprobante en recepcion.',
        montoTotal,
        moneda,
      },
      // Cadena que el frontend convierte en imagen QR para que el visitante
      // la escanee con su app bancaria (o simplemente lea los datos).
      contenidoQr: [
        configuracion.pagoDigitalEntidad,
        configuracion.pagoDigitalNumero,
        `${moneda} ${montoTotal}`,
        referencia,
      ]
        .filter(Boolean)
        .join(' | '),
    };
  },

  async consultarEstado() {
    // No hay nada que consultar: lo confirma una persona.
    return { estado: 'PENDIENTE', requiereConfirmacionManual: true };
  },

  async verificarFirmaWebhook() {
    return false;
  },
};
