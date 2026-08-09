import { useEffect, useState } from 'react';
import { post, put } from '../../api/client.js';
import { CodigoQr } from '../../components/CodigoQr.jsx';
import { Alerta, AreaTexto, Boton, Campo, Cargando, Entrada, Insignia, Tarjeta } from '../../components/ui.jsx';
import { useConfiguracion } from '../../hooks/useConfiguracion.js';
import { dinero } from '../../lib/formato.js';

/** Ajustes del negocio: precio del punto, datos de pago digital y clave propia. */
export const Configuracion = () => {
  const { configuracion, pagos, cargando, error: errorCarga, recargar } = useConfiguracion();

  const [formulario, setFormulario] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (configuracion) {
      setFormulario({
        nombreNegocio: configuracion.nombreNegocio ?? '',
        precioPunto: configuracion.precioPunto ?? 0,
        cooldownSegundosDefault: configuracion.cooldownSegundosDefault ?? 60,
        pagoDigitalTitular: configuracion.pagoDigitalTitular ?? '',
        pagoDigitalEntidad: configuracion.pagoDigitalEntidad ?? '',
        pagoDigitalNumero: configuracion.pagoDigitalNumero ?? '',
        pagoDigitalInstrucciones: configuracion.pagoDigitalInstrucciones ?? '',
      });
    }
  }, [configuracion]);

  const guardar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setMensaje('');
    setError('');

    try {
      await put('/configuracion', {
        nombreNegocio: formulario.nombreNegocio.trim(),
        precioPunto: Number(formulario.precioPunto),
        cooldownSegundosDefault: Number(formulario.cooldownSegundosDefault),
        pagoDigitalTitular: formulario.pagoDigitalTitular.trim() || null,
        pagoDigitalEntidad: formulario.pagoDigitalEntidad.trim() || null,
        pagoDigitalNumero: formulario.pagoDigitalNumero.trim() || null,
        pagoDigitalInstrucciones: formulario.pagoDigitalInstrucciones.trim() || null,
      });
      await recargar();
      setMensaje('Ajustes guardados. El precio nuevo aplica a las proximas recargas.');
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando || !formulario) return <Cargando />;

  const proveedorActivo = pagos.find((p) => p.activo);
  const vistaPreviaQr = [formulario.pagoDigitalEntidad, formulario.pagoDigitalNumero].filter(Boolean).join(' | ');

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Ajustes</h1>
        <p className="text-sm text-slate-500">Precio de los puntos y datos de cobro</p>
      </div>

      {errorCarga && <Alerta tono="peligro">{errorCarga}</Alerta>}
      {error && <Alerta tono="peligro">{error}</Alerta>}
      {mensaje && <Alerta tono="exito">{mensaje}</Alerta>}

      <form onSubmit={guardar} className="space-y-4">
        <Tarjeta className="space-y-3">
          <h2 className="font-semibold text-slate-200">Negocio y precios</h2>

          <Campo etiqueta="Nombre del negocio">
            <Entrada
              value={formulario.nombreNegocio}
              onChange={(e) => setFormulario((f) => ({ ...f, nombreNegocio: e.target.value }))}
            />
          </Campo>

          <Campo
            etiqueta={`Precio por punto (${configuracion.moneda})`}
            requerido
            ayuda="Un punto equivale a un acceso a una atraccion de costo 1."
          >
            <Entrada
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              value={formulario.precioPunto}
              onChange={(e) => setFormulario((f) => ({ ...f, precioPunto: e.target.value }))}
              required
            />
          </Campo>

          <div className="rounded-xl bg-slate-950/60 px-4 py-3 text-sm text-slate-400">
            Ejemplos: 1 punto = {dinero(formulario.precioPunto, configuracion.moneda)} · 5 puntos ={' '}
            {dinero(formulario.precioPunto * 5, configuracion.moneda)} · 10 puntos ={' '}
            {dinero(formulario.precioPunto * 10, configuracion.moneda)}
          </div>

          <Alerta tono="info">
            Cambiar el precio no altera las recargas ya hechas: cada venta guarda el precio que estaba vigente en ese
            momento, para que los reportes historicos no se muevan.
          </Alerta>

          <Campo
            etiqueta="Cortesia por defecto (segundos)"
            ayuda="Se aplica a las atracciones nuevas. Las existentes se ajustan en su propia pantalla."
          >
            <Entrada
              type="number"
              min={0}
              max={3600}
              value={formulario.cooldownSegundosDefault}
              onChange={(e) => setFormulario((f) => ({ ...f, cooldownSegundosDefault: e.target.value }))}
            />
          </Campo>
        </Tarjeta>

        <Tarjeta className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-200">Pago digital</h2>
            <Insignia tono={proveedorActivo?.soportaConfirmacionAutomatica ? 'exito' : 'aviso'}>
              {proveedorActivo?.nombre === 'wompi' ? 'Wompi' : 'Confirmacion manual'}
            </Insignia>
          </div>

          <p className="text-sm text-slate-500">
            Estos datos se convierten en el QR que recepcion le muestra al visitante para que transfiera.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Entidad" ayuda="Nequi, Daviplata, Bancolombia...">
              <Entrada
                value={formulario.pagoDigitalEntidad}
                onChange={(e) => setFormulario((f) => ({ ...f, pagoDigitalEntidad: e.target.value }))}
                placeholder="Nequi"
              />
            </Campo>

            <Campo etiqueta="Numero de cuenta o celular">
              <Entrada
                value={formulario.pagoDigitalNumero}
                onChange={(e) => setFormulario((f) => ({ ...f, pagoDigitalNumero: e.target.value }))}
                placeholder="300 123 4567"
              />
            </Campo>
          </div>

          <Campo etiqueta="Titular">
            <Entrada
              value={formulario.pagoDigitalTitular}
              onChange={(e) => setFormulario((f) => ({ ...f, pagoDigitalTitular: e.target.value }))}
              placeholder="Mirador SAS"
            />
          </Campo>

          <Campo etiqueta="Instrucciones para el visitante">
            <AreaTexto
              value={formulario.pagoDigitalInstrucciones}
              onChange={(e) => setFormulario((f) => ({ ...f, pagoDigitalInstrucciones: e.target.value }))}
              placeholder="Transfiere el monto exacto y muestra el comprobante en recepcion."
            />
          </Campo>

          {vistaPreviaQr && (
            <div className="flex items-center gap-4 rounded-xl bg-slate-950/60 p-3">
              <CodigoQr valor={vistaPreviaQr} tamano={100} />
              <div className="text-xs text-slate-500">
                <p className="font-medium text-slate-400">Vista previa del QR de pago</p>
                <p className="mt-1">
                  Al cobrar se le agrega el monto y una referencia unica para que recepcion pueda cruzarlo con el
                  comprobante.
                </p>
              </div>
            </div>
          )}

          <Alerta tono="aviso">
            Hoy los pagos digitales los confirma recepcion a mano. La arquitectura ya tiene el adaptador para Wompi:
            cuando se active, la pasarela confirmara sola y este paso desaparece.
          </Alerta>
        </Tarjeta>

        <Boton type="submit" tamano="lg" cargando={guardando}>
          Guardar ajustes
        </Boton>
      </form>

      <CambiarPassword />
    </div>
  );
};

const CambiarPassword = () => {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setGuardando(true);
    setMensaje('');
    setError('');
    try {
      await post('/auth/cambiar-password', { passwordActual: actual, passwordNueva: nueva });
      setActual('');
      setNueva('');
      setMensaje('Contrasena actualizada.');
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Tarjeta>
      <form onSubmit={enviar} className="space-y-3">
        <h2 className="font-semibold text-slate-200">Cambiar mi contrasena</h2>

        {error && <Alerta tono="peligro">{error}</Alerta>}
        {mensaje && <Alerta tono="exito">{mensaje}</Alerta>}

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Contrasena actual" requerido>
            <Entrada
              type="password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Campo>

          <Campo etiqueta="Nueva contrasena" requerido ayuda="Minimo 8 caracteres">
            <Entrada
              type="password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </Campo>
        </div>

        <Boton type="submit" cargando={guardando}>
          Cambiar contrasena
        </Boton>
      </form>
    </Tarjeta>
  );
};
