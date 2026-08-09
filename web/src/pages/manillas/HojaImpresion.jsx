import { CodigoQr } from '../../components/CodigoQr.jsx';
import { Boton } from '../../components/ui.jsx';

/**
 * Hoja de stickers lista para imprimir.
 *
 * El QR lleva unicamente el codigo de la manilla (texto plano, no una URL):
 * asi la manilla sirve aunque cambie el dominio del sistema, y cualquier
 * lector generico muestra el codigo si hay que teclearlo a mano.
 */
export const HojaImpresion = ({ manillas, onVolver, titulo = 'Manillas' }) => (
  <div>
    <div className="no-imprimir mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-100">{titulo}</h1>
        <p className="text-sm text-slate-500">
          {manillas.length} codigos generados. Imprime, recorta y pega en las manillas.
        </p>
      </div>
      <div className="flex gap-2">
        <Boton variante="secundario" onClick={onVolver}>
          Volver
        </Boton>
        <Boton onClick={() => window.print()}>Imprimir</Boton>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-4 print:gap-2">
      {manillas.map((manilla) => (
        <div
          key={manilla.id ?? manilla.codigo}
          className="flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-white p-3 print:border-slate-300 print:break-inside-avoid"
        >
          <CodigoQr valor={manilla.codigo} tamano={140} margen={0} />
          <p className="text-center font-mono text-xs font-bold tracking-tight text-black">{manilla.codigo}</p>
        </div>
      ))}
    </div>
  </div>
);
