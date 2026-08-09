import { createHash } from 'node:crypto';
import { env } from '../../config/env.js';
import { ApiError } from '../../lib/errors.js';

/**
 * Adaptador para Wompi. Esta es la fase 2: la estructura, las firmas y el
 * calculo de integridad ya estan, pero las llamadas HTTP quedan marcadas
 * como no implementadas para no fingir una integracion que no se ha probado
 * contra el sandbox real.
 *
 * Para activarlo:
 *   1. PAGOS_PROVEEDOR=wompi y las WOMPI_* en el entorno.
 *   2. Completar `crearIntento` con POST /payment_links (o Widget/Checkout).
 *   3. Exponer POST /api/pagos/webhook y llamar a `confirmarRecargaPorReferencia`.
 *   4. Poner Configuracion.confirmacionDigitalManual = false.
 */
export const wompiProvider = {
  nombre: 'wompi',
  soportaConfirmacionAutomatica: true,

  /**
   * Firma de integridad que exige Wompi: SHA256 de
   * `<referencia><monto-en-centavos><moneda><secreto-de-integridad>`.
   */
  firmaIntegridad({ referencia, montoCentavos, moneda }) {
    const cadena = `${referencia}${montoCentavos}${moneda}${env.pagos.wompi.integritySecret}`;
    return createHash('sha256').update(cadena).digest('hex');
  },

  async crearIntento() {
    throw new ApiError(
      501,
      'PASARELA_NO_IMPLEMENTADA',
      'La integracion con Wompi aun no esta habilitada. Usa PAGOS_PROVEEDOR=manual mientras tanto.'
    );
  },

  async consultarEstado() {
    throw new ApiError(501, 'PASARELA_NO_IMPLEMENTADA', 'Consulta de estado en Wompi no implementada.');
  },

  /**
   * Wompi firma sus eventos con SHA256 sobre los valores de las propiedades
   * listadas en `signature.properties`, mas el timestamp y el events secret.
   */
  async verificarFirmaWebhook(evento) {
    const secreto = env.pagos.wompi.eventsSecret;
    if (!secreto || !evento?.signature?.checksum) return false;

    const valores = (evento.signature.properties || []).map((ruta) =>
      ruta.split('.').reduce((acc, parte) => acc?.[parte], evento.data)
    );
    const cadena = `${valores.join('')}${evento.timestamp}${secreto}`;
    return createHash('sha256').update(cadena).digest('hex').toUpperCase() ===
      String(evento.signature.checksum).toUpperCase();
  },
};
