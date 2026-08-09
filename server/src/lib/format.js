/**
 * Prisma devuelve los campos Decimal como objetos Decimal.js, que al
 * serializarse a JSON quedan como string. El frontend trabaja con numeros,
 * asi que se convierten aqui en un solo lugar.
 */
export const toNumber = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;
  return Number(value.toString());
};

/** Normaliza el contenido de un QR para que la busqueda sea estable. */
export const normalizarCodigo = (codigo) => String(codigo ?? '').trim().toUpperCase();

export const serializarManilla = (manilla) =>
  manilla && {
    ...manilla,
    creadaPor: manilla.creadaPor
      ? { id: manilla.creadaPor.id, nombre: manilla.creadaPor.nombre }
      : undefined,
  };

export const serializarRecarga = (recarga) =>
  recarga && {
    ...recarga,
    precioUnitario: toNumber(recarga.precioUnitario),
    montoTotal: toNumber(recarga.montoTotal),
  };

export const serializarConfiguracion = (config) =>
  config && {
    ...config,
    precioPunto: toNumber(config.precioPunto),
  };

export const serializarUsuario = (usuario) => {
  if (!usuario) return usuario;
  const { passwordHash, ...resto } = usuario;
  return resto;
};
