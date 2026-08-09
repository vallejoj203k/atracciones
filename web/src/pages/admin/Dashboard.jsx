import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { get } from '../../api/client.js';
import { Alerta, Boton, Cargando, Entrada, Insignia, Tarjeta } from '../../components/ui.jsx';
import { aInputDate, dinero, fecha, finDelDia, inicioDelDia, numero } from '../../lib/formato.js';

const COLORES_ATRACCION = ['#38bdf8', '#a78bfa', '#fbbf24', '#34d399', '#f472b6', '#fb923c'];

const RANGOS = [
  { clave: 'hoy', texto: 'Hoy', dias: 0 },
  { clave: '7d', texto: '7 dias', dias: 6 },
  { clave: '30d', texto: '30 dias', dias: 29 },
];

const hace = (dias) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d;
};

const Metrica = ({ etiqueta, valor, detalle, tono = 'text-slate-100' }) => (
  <Tarjeta>
    <p className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</p>
    <p className={`mt-1 text-2xl font-black tabular-nums ${tono}`}>{valor}</p>
    {detalle && <p className="mt-0.5 text-xs text-slate-500">{detalle}</p>}
  </Tarjeta>
);

const estiloTooltip = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '0.75rem',
  color: '#e2e8f0',
  fontSize: '0.8rem',
};

/** Panel del dueño: ingresos, uso por atraccion y estado de las manillas. */
export const Dashboard = () => {
  const [rango, setRango] = useState('hoy');
  const [desde, setDesde] = useState(aInputDate(new Date()));
  const [hasta, setHasta] = useState(aInputDate(new Date()));
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const aplicarRango = (clave) => {
    const preset = RANGOS.find((r) => r.clave === clave);
    setRango(clave);
    if (preset) {
      setDesde(aInputDate(hace(preset.dias)));
      setHasta(aInputDate(new Date()));
    }
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const respuesta = await get('/reportes/dashboard', {
        desde: inicioDelDia(new Date(`${desde}T00:00:00`)),
        hasta: finDelDia(new Date(`${hasta}T00:00:00`)),
        zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setDatos(respuesta);
      setError('');
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando && !datos) return <Cargando texto="Calculando reportes..." />;

  const efectivo = datos?.ingresos.porMetodoPago.find((m) => m.metodoPago === 'EFECTIVO');
  const digital = datos?.ingresos.porMetodoPago.find((m) => m.metodoPago === 'DIGITAL');
  const usoMaximo = Math.max(1, ...(datos?.usos.porAtraccion.map((a) => a.usos) ?? [1]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Resumen</h1>
          <p className="text-sm text-slate-500">
            {fecha(desde)} — {fecha(hasta)}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex gap-1">
            {RANGOS.map((preset) => (
              <button
                key={preset.clave}
                type="button"
                onClick={() => aplicarRango(preset.clave)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  rango === preset.clave
                    ? 'bg-marca-500/20 text-marca-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {preset.texto}
              </button>
            ))}
          </div>
          <Entrada
            type="date"
            value={desde}
            onChange={(e) => {
              setDesde(e.target.value);
              setRango('custom');
            }}
            className="w-auto"
          />
          <Entrada
            type="date"
            value={hasta}
            onChange={(e) => {
              setHasta(e.target.value);
              setRango('custom');
            }}
            className="w-auto"
          />
          <Boton variante="secundario" onClick={cargar} cargando={cargando}>
            Actualizar
          </Boton>
        </div>
      </div>

      {error && <Alerta tono="peligro">{error}</Alerta>}

      {datos && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metrica
              etiqueta="Ingresos"
              valor={dinero(datos.ingresos.total)}
              detalle={`${numero(datos.ingresos.recargas)} recargas confirmadas`}
              tono="text-emerald-400"
            />
            <Metrica
              etiqueta="Puntos vendidos"
              valor={numero(datos.ingresos.puntosVendidos)}
              detalle={`${numero(datos.usos.total)} accesos usados`}
            />
            <Metrica
              etiqueta="Manillas con saldo"
              valor={numero(datos.manillas.conSaldo)}
              detalle={`${numero(datos.manillas.activas)} activas en total`}
            />
            <Metrica
              etiqueta="Puntos por consumir"
              valor={numero(datos.manillas.puntosEnCirculacion)}
              detalle="Saldo vivo en manos de visitantes"
              tono="text-amber-400"
            />
          </div>

          {datos.ingresos.pendientes.cantidad > 0 && (
            <Alerta tono="aviso" titulo="Pagos digitales sin confirmar">
              Hay {datos.ingresos.pendientes.cantidad} recargas pendientes por{' '}
              {dinero(datos.ingresos.pendientes.total)}. No suman a los ingresos hasta que recepcion las confirme.
            </Alerta>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <Tarjeta>
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Uso por atraccion</h2>
              {datos.usos.porAtraccion.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">Sin atracciones registradas.</p>
              ) : (
                <>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={datos.usos.porAtraccion} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis
                          dataKey="nombre"
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          axisLine={{ stroke: '#334155' }}
                          tickLine={false}
                          interval={0}
                          tickFormatter={(valor) => (valor.length > 12 ? `${valor.slice(0, 11)}…` : valor)}
                        />
                        <YAxis
                          tick={{ fill: '#64748b', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip contentStyle={estiloTooltip} cursor={{ fill: '#1e293b66' }} />
                        <Bar dataKey="usos" name="Accesos" radius={[6, 6, 0, 0]}>
                          {datos.usos.porAtraccion.map((entrada, indice) => (
                            <Cell key={entrada.atraccionId} fill={COLORES_ATRACCION[indice % COLORES_ATRACCION.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {datos.usos.porAtraccion.map((atraccion, indice) => (
                      <li key={atraccion.atraccionId} className="flex items-center gap-3 text-sm">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: COLORES_ATRACCION[indice % COLORES_ATRACCION.length] }}
                        />
                        <span className="min-w-0 flex-1 truncate text-slate-300">
                          {atraccion.nombre}
                          {!atraccion.activa && (
                            <Insignia tono="peligro" className="ml-2">
                              inactiva
                            </Insignia>
                          )}
                        </span>
                        <span className="tabular-nums text-slate-400">{numero(atraccion.usos)}</span>
                        <span className="w-16 text-right text-xs text-slate-600">
                          {Math.round((atraccion.usos / usoMaximo) * 100)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Tarjeta>

            <Tarjeta>
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Ingresos y accesos por dia</h2>
              {datos.serieDiaria.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">Sin movimientos en el rango.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={datos.serieDiaria} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis
                        dataKey="dia"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={{ stroke: '#334155' }}
                        tickLine={false}
                        tickFormatter={(valor) => valor.slice(5)}
                      />
                      <YAxis
                        yAxisId="izq"
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(valor) => (valor >= 1000 ? `${Math.round(valor / 1000)}k` : valor)}
                      />
                      <YAxis yAxisId="der" orientation="right" hide />
                      <Tooltip
                        contentStyle={estiloTooltip}
                        formatter={(valor, nombre) => (nombre === 'Ingresos' ? dinero(valor) : numero(valor))}
                      />
                      <Line
                        yAxisId="izq"
                        type="monotone"
                        dataKey="ingresos"
                        name="Ingresos"
                        stroke="#34d399"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        yAxisId="der"
                        type="monotone"
                        dataKey="usos"
                        name="Accesos"
                        stroke="#38bdf8"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Tarjeta>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Tarjeta>
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Como pagaron</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">💵 Efectivo</p>
                  <p className="mt-1 text-xl font-bold text-slate-100">{dinero(efectivo?.total ?? 0)}</p>
                  <p className="text-xs text-slate-600">{numero(efectivo?.recargas ?? 0)} recargas</p>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-3">
                  <p className="text-xs text-slate-500">📱 Digital</p>
                  <p className="mt-1 text-xl font-bold text-slate-100">{dinero(digital?.total ?? 0)}</p>
                  <p className="text-xs text-slate-600">{numero(digital?.recargas ?? 0)} recargas</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-600">
                {numero(datos.manillas.nuevasEnRango)} manillas nuevas registradas en el rango.
              </p>
            </Tarjeta>

            <Tarjeta>
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Accesos registrados por trabajador</h2>
              {datos.usos.topOperadores.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-600">Sin accesos en el rango.</p>
              ) : (
                <ul className="space-y-2">
                  {datos.usos.topOperadores.map((operador) => (
                    <li key={operador.operadorId} className="flex items-center justify-between text-sm">
                      <span className="truncate text-slate-300">{operador.nombre}</span>
                      <span className="tabular-nums text-slate-400">{numero(operador.usos)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Tarjeta>
          </div>
        </>
      )}
    </div>
  );
};
