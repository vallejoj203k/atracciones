import bcrypt from 'bcryptjs';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { CONFIG_ID } from '../src/services/configuracion.service.js';

/**
 * Datos minimos para que el mirador pueda operar el primer dia:
 * configuracion global, las tres atracciones y un administrador.
 *
 * Es idempotente: se puede correr las veces que haga falta.
 */

const ATRACCIONES = [
  { nombre: 'Mirador Panoramico', descripcion: 'Acceso a la plataforma de observacion', orden: 1 },
  { nombre: 'Telescopio', descripcion: 'Turno de observacion con telescopio', orden: 2 },
  { nombre: 'Columpio Extremo', descripcion: 'Columpio suspendido sobre el valle', orden: 3 },
];

const main = async () => {
  const configuracion = await prisma.configuracion.upsert({
    where: { id: CONFIG_ID },
    update: {},
    create: {
      id: CONFIG_ID,
      nombreNegocio: 'Mirador',
      moneda: 'COP',
      precioPunto: 5000,
      cooldownSegundosDefault: 60,
      pagoDigitalInstrucciones: 'Transfiere el monto exacto y muestra el comprobante en recepcion.',
    },
  });
  console.log(`[seed] configuracion lista (precio por punto: ${configuracion.precioPunto})`);

  for (const atraccion of ATRACCIONES) {
    await prisma.atraccion.upsert({
      where: { nombre: atraccion.nombre },
      update: {},
      create: { ...atraccion, cooldownSegundos: configuracion.cooldownSegundosDefault },
    });
  }
  console.log(`[seed] ${ATRACCIONES.length} atracciones aseguradas`);

  const username = env.seed.adminUsername.toLowerCase();
  const existente = await prisma.usuario.findUnique({ where: { username } });

  if (existente) {
    console.log(`[seed] el administrador "${username}" ya existe, no se toca su contrasena`);
  } else {
    await prisma.usuario.create({
      data: {
        nombre: env.seed.adminNombre,
        username,
        passwordHash: await bcrypt.hash(env.seed.adminPassword, 10),
        rol: 'ADMIN',
      },
    });
    console.log(`[seed] administrador creado -> usuario: ${username} / clave: ${env.seed.adminPassword}`);
    console.log('[seed] CAMBIA ESA CONTRASENA desde el panel apenas entres.');
  }
};

main()
  .catch((error) => {
    console.error('[seed] fallo:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
