import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

/**
 * Dibuja un QR a partir de un texto. Se genera en el navegador (no en el
 * servidor) para que la hoja de impresion de stickers salga al instante y
 * funcione igual sin conexion al backend.
 */
export const CodigoQr = ({ valor, tamano = 160, className = '', margen = 1, nivel = 'M' }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    if (!valor) {
      setUrl('');
      return undefined;
    }

    QRCode.toDataURL(String(valor), {
      width: tamano,
      margin: margen,
      // Nivel M tolera ~15% de dano: suficiente para una manilla que se moja
      // o se raya sin agrandar demasiado el codigo.
      errorCorrectionLevel: nivel,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then((dataUrl) => {
        if (!cancelado) {
          setUrl(dataUrl);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });

    return () => {
      cancelado = true;
    };
  }, [valor, tamano, margen, nivel]);

  if (error) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-400 ${className}`}
        style={{ width: tamano, height: tamano }}
      >
        QR no disponible
      </div>
    );
  }

  if (!url) {
    return <div className={`animate-pulse rounded-lg bg-slate-800 ${className}`} style={{ width: tamano, height: tamano }} />;
  }

  return (
    <img
      src={url}
      alt={`Codigo QR ${valor}`}
      width={tamano}
      height={tamano}
      className={`rounded-lg bg-white ${className}`}
    />
  );
};
