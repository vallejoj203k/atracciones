import { useCallback, useEffect, useState } from 'react';
import { get } from '../api/client.js';

/**
 * Configuracion global (precio del punto, datos de pago digital). La usan
 * varias pantallas, asi que se centraliza aqui el fetch y el estado.
 */
export const useConfiguracion = () => {
  const [configuracion, setConfiguracion] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await get('/configuracion');
      setConfiguracion(datos.configuracion);
      setPagos(datos.pagos ?? []);
      setError('');
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { configuracion, pagos, cargando, error, recargar, setConfiguracion };
};
