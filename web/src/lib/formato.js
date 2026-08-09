const formateadorMoneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

export const dinero = (valor, moneda = 'COP') => {
  const numero = Number(valor ?? 0);
  if (moneda === 'COP') return formateadorMoneda.format(numero);
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(
    numero
  );
};

export const numero = (valor) => new Intl.NumberFormat('es-CO').format(Number(valor ?? 0));

export const fechaHora = (valor) =>
  valor
    ? new Date(valor).toLocaleString('es-CO', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

export const hora = (valor) =>
  valor ? new Date(valor).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

export const fecha = (valor) =>
  valor ? new Date(valor).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

/** Valor para <input type="date"> en hora local (no UTC). */
export const aInputDate = (date) => {
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
};

export const inicioDelDia = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const finDelDia = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const etiquetaRol = (rol) =>
  ({ ADMIN: 'Administrador', RECEPCION: 'Recepcion', OPERADOR: 'Operador' })[rol] ?? rol;

export const etiquetaMetodoPago = (metodo) => ({ EFECTIVO: 'Efectivo', DIGITAL: 'Digital' })[metodo] ?? metodo;

export const etiquetaEstadoRecarga = (estado) =>
  ({ PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', ANULADA: 'Anulada' })[estado] ?? estado;
