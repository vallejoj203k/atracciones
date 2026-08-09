# Mirador · Sistema de gestión de atracciones

Control de acceso a las atracciones de un mirador turístico mediante **manillas con código QR** y un **sistema de puntos**. Un punto equivale a un acceso a una atracción.

```
Recepción            Estación de atracción         Administración
──────────           ─────────────────────         ──────────────
cobra y recarga  →   escanea la manilla        →   ve ingresos, usos,
puntos en la         y descuenta 1 punto           manillas y auditoría
manilla QR           (o niega el acceso)
```

---

## Índice

- [Cómo funciona](#cómo-funciona)
- [Decisiones de diseño](#decisiones-de-diseño)
- [Puesta en marcha local](#puesta-en-marcha-local)
- [Despliegue en Railway](#despliegue-en-railway)
- [Variables de entorno](#variables-de-entorno)
- [Modelo de datos](#modelo-de-datos)
- [API](#api)
- [Pantallas](#pantallas)
- [Manillas y códigos QR](#manillas-y-códigos-qr)
- [Pagos digitales y la ruta a Wompi](#pagos-digitales-y-la-ruta-a-wompi)
- [Pruebas](#pruebas)
- [Operación diaria](#operación-diaria)
- [Limitaciones conocidas](#limitaciones-conocidas)

---

## Cómo funciona

1. **Entrada.** El visitante llega a recepción, dice cuántos puntos quiere y paga en efectivo o por transferencia. Recepción escanea (o genera) su manilla y le carga los puntos.
2. **En cada atracción.** El operador escanea el QR de la manilla con la cámara de su celular o tablet. Si hay saldo se descuenta un punto, se registra el uso y la pantalla se pone **verde**. Si no hay saldo, se pone **roja** e indica que debe recargar en recepción.
3. **Administración.** El dueño ve ingresos, recargas, uso por atracción, manillas activas y la bitácora de quién hizo qué.

### Roles

| Rol | Entra a | Puede |
|---|---|---|
| **Administrador** | Panel de reportes | Todo: reportes, precios, atracciones, usuarios, anular recargas |
| **Recepción** | Pantalla de recarga | Crear y recargar manillas, confirmar pagos digitales, ver recargas |
| **Operador** | Estación de su atracción | Solo escanear en la atracción que tiene asignada |

Un operador **no puede** registrar accesos en una atracción distinta a la suya, ni siquiera manipulando la petición: el backend ignora el `atraccionId` que envíe y usa el de su usuario.

---

## Decisiones de diseño

Estas son las decisiones que más condicionan el resto del sistema, con el porqué.

**Escaneo por cámara del navegador, no lector físico ni app nativa.**
Se usa `html5-qrcode` sobre la cámara del dispositivo. No requiere instalación ni hardware dedicado: cada estación abre una URL en un celular o tablet fijo. Requiere HTTPS, que Railway ya provee.

**Los resultados de negocio del escaneo viajan con HTTP 200.**
"Saldo insuficiente" o "manilla inactiva" no son errores de la petición, son respuestas que la pantalla debe pintar. El campo `resultado` distingue el caso; los códigos 4xx quedan reservados para errores reales (sin token, sin permiso, datos inválidos).

**Ventana de cortesía en lugar de confirmación manual.**
Un re-escaneo de la misma manilla en la misma atracción dentro de N segundos (60 por defecto, configurable por atracción) deja pasar sin volver a cobrar. Esto evita el doble cobro por escaneo accidental sin agregar un toque extra por visitante, que es lo que importa cuando hay fila. La cortesía se evalúa **antes** que el saldo: un re-escaneo corresponde a un acceso ya cobrado, así que no debe cobrarse ni negarse aunque el saldo haya quedado en cero.

**El descuento es atómico.**
Se hace con un `UPDATE ... WHERE saldoPuntos >= costo` dentro de una transacción. Si la misma manilla se escanea a la vez en dos atracciones, solo una alcanza a gastar el último punto; la otra recibe `SALDO_INSUFICIENTE`.

**El pago digital no acredita puntos hasta que alguien lo confirma.**
Una recarga digital nace `PENDIENTE`. Los puntos entran cuando recepción pulsa "ya recibí el pago". Así el sistema nunca regala puntos por una transferencia que no llegó.

**El precio se congela en cada venta.**
Cada `Recarga` guarda el `precioUnitario` vigente en ese momento. Cambiar el precio hoy no altera los reportes de ayer.

**Nada asume que hay tres atracciones.**
Agregar una cuarta es crear un registro y un usuario operador. No hay constantes ni enums con las atracciones.

**Los usuarios no se borran, se desactivan.**
Están referenciados por recargas y usos; borrarlos destruiría la trazabilidad.

---

## Puesta en marcha local

Requisitos: Node 20+ y PostgreSQL 14+.

```bash
git clone <este-repo> && cd atracciones
npm install

# 1. Configura la conexión a la base
cp .env.example .env
# edita DATABASE_URL con tu Postgres local

# 2. Crea el esquema y los datos iniciales
npm run prisma:migrate    # crea las tablas
npm run seed              # config, 3 atracciones y el usuario admin

# 3. Levanta backend y frontend
npm run dev:server        # http://localhost:4000
npm run dev:web           # http://localhost:5173
```

El seed imprime las credenciales del administrador (`admin` / `cambiar123` por defecto). **Cámbialas apenas entres**, desde Ajustes.

> El frontend en desarrollo hace proxy de `/api` al backend, así que no hay que configurar CORS ni URLs.

### Probar el escaneo desde el celular

La cámara solo funciona sobre HTTPS o en `localhost`. Para probar desde un celular en la misma red durante el desarrollo, lo más simple es exponer el puerto con un túnel (`cloudflared tunnel --url http://localhost:5173`, `ngrok http 5173`) y abrir la URL HTTPS que devuelve.

---

## Despliegue en Railway

El repositorio está preparado para **un solo servicio**: Express sirve la API y también el frontend compilado. Es más barato y evita configurar CORS.

1. **Crea el proyecto y la base.** En Railway: *New Project* → *Deploy from GitHub repo* → este repositorio, rama `main`. Luego *New* → *Database* → *Add PostgreSQL* dentro del mismo proyecto.

2. **Conecta la base al servicio.** Railway **no** inyecta `DATABASE_URL` automáticamente: hay que referenciarla. En el servicio de la app, *Variables* → añade

   ```
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   ```

   (si nombraste el servicio de base distinto, usa ese nombre en lugar de `Postgres`).

3. **Añade el resto de variables:**

   ```
   NODE_ENV=production
   JWT_SECRET=<48 bytes aleatorios en hex>
   SERVE_WEB=true
   SEED_ADMIN_PASSWORD=<una clave tuya>
   ```

   Genera el secreto con:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

   El servidor **se niega a arrancar en producción** si `JWT_SECRET` falta o tiene menos de 32 caracteres.

4. **Publica un dominio.** *Settings* → *Networking* → *Generate Domain*. La cámara necesita HTTPS y el dominio de Railway ya lo trae.

`railway.json` se encarga del resto en cada despliegue:

- build: `npm run build` — compila el frontend y genera el cliente de Prisma
- start: `npm run prisma:deploy && npm run seed && npm start` — aplica migraciones pendientes, asegura los datos iniciales y arranca
- healthcheck: `/api/health`

El seed es idempotente y corre en cada arranque sin efectos: crea la configuración, las atracciones y el administrador solo si no existen, y **nunca** cambia la contraseña de un administrador ya creado. Por eso cambiar `SEED_ADMIN_PASSWORD` después del primer despliegue no tiene efecto; para cambiarla, usa Ajustes dentro de la aplicación.

> **Por qué `vite`, `tailwindcss` y `prisma` están en `dependencies` y no en `devDependencies`:** con `NODE_ENV=production`, npm omite las `devDependencies` al instalar, así que el build se quedaría sin `vite` y el `startCommand` sin el CLI de `prisma`. Ponerlas como dependencias normales hace que el despliegue funcione sin depender de banderas extra como `NPM_CONFIG_INCLUDE=dev`.

Para desplegar frontend y backend por separado, pon `SERVE_WEB=false` en el backend y `VITE_API_URL=https://tu-api.railway.app` al compilar el frontend, y añade el dominio del frontend a `CORS_ORIGIN`.

---

## Variables de entorno

Ver `.env.example` para la lista completa y comentada. Las que importan:

| Variable | Por defecto | Para qué |
|---|---|---|
| `DATABASE_URL` | — | Conexión a PostgreSQL. Obligatoria. |
| `JWT_SECRET` | — | Firma de los tokens. Obligatoria en producción, mínimo 32 caracteres. |
| `JWT_EXPIRES_IN` | `30d` | Vigencia de la sesión. Larga a propósito: las estaciones son dispositivos fijos. |
| `PORT` | `4000` | Puerto HTTP. |
| `SERVE_WEB` | `true` en producción | Servir `web/dist` desde el mismo Express. |
| `CORS_ORIGIN` | vacío (todo) | Orígenes permitidos, separados por coma. |
| `PAGOS_PROVEEDOR` | `manual` | `manual` o `wompi`. |
| `SEED_ADMIN_*` | `admin` / `cambiar123` | Credenciales del administrador que crea el seed. |

Aunque el token dure 30 días, **desactivar a un trabajador surte efecto de inmediato**: el backend recarga el usuario desde la base en cada petición y rechaza a los inactivos sin esperar a que expire su token.

---

## Modelo de datos

```
Usuario ──< Recarga >── Manilla ──< Uso >── Atraccion
   │                                 │
   └─────────────────────────────────┘
            (operador / recepción)

Configuracion (fila única)      AuditLog
```

| Entidad | Campos que importan |
|---|---|
| **Manilla** | `codigo` (contenido del QR, único), `saldoPuntos`, `estado`, `origen` (generado / preimpreso) |
| **Atraccion** | `nombre`, `costoPuntos` (cuántos puntos cuesta un acceso), `cooldownSegundos`, `activa` |
| **Recarga** | `puntos`, `precioUnitario` y `montoTotal` congelados, `metodoPago`, `estado`, `referenciaPago`, quién la registró y quién la confirmó |
| **Uso** | `manillaId`, `atraccionId`, `operadorId`, `puntosDescontados`, `saldoAntes`, `saldoDespues` |
| **Usuario** | `rol`, `atraccionId` (solo operadores), `activo`, `ultimoAcceso` |
| **Configuracion** | `precioPunto`, `moneda`, datos del pago digital, `cooldownSegundosDefault` |
| **AuditLog** | quién, qué acción, sobre qué entidad, con qué detalle y desde qué IP |

`costoPuntos` está en la atracción aunque hoy todas cuesten 1: permite cobrar distinto por atracción en el futuro sin migrar la estructura.

El esquema completo está en [`server/prisma/schema.prisma`](server/prisma/schema.prisma).

---

## API

Todas las rutas cuelgan de `/api`. Autenticación por `Authorization: Bearer <token>`.

### Autenticación
| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `POST` | `/auth/login` | — | Devuelve token y usuario. Limitado a 20 intentos / 5 min. |
| `GET` | `/auth/me` | cualquiera | Usuario de la sesión actual. |
| `POST` | `/auth/cambiar-password` | cualquiera | Cambia la propia contraseña. |

### Escaneo (estación de atracción)
| Método | Ruta | Rol | Qué hace |
|---|---|---|---|
| `POST` | `/escaneos` | operador, recepción, admin | Valida la manilla y descuenta puntos. |
| `GET` | `/escaneos/resumen` | operador, recepción, admin | Contador de accesos del día y últimos escaneos. |

`POST /escaneos` responde siempre 200 con uno de estos `resultado`:

| `resultado` | `permitido` | Significado |
|---|---|---|
| `PERMITIDO` | `true` | Se descontaron los puntos, puede pasar. |
| `COOLDOWN` | `true` | Re-escaneo dentro de la ventana de cortesía; no se cobró. |
| `SALDO_INSUFICIENTE` | `false` | Debe recargar en recepción. |
| `MANILLA_NO_ENCONTRADA` | `false` | El código no corresponde a ninguna manilla. |
| `MANILLA_INACTIVA` | `false` | La manilla fue desactivada. |
| `ATRACCION_INACTIVA` | `false` | La atracción está fuera de servicio. |

### Manillas
| Método | Ruta | Rol |
|---|---|---|
| `GET` | `/manillas` | recepción, admin |
| `POST` | `/manillas` | recepción, admin |
| `POST` | `/manillas/lote` | recepción, admin |
| `GET` | `/manillas/:codigo` | recepción, admin |
| `PATCH` | `/manillas/:id` | recepción, admin |

### Recargas
| Método | Ruta | Rol |
|---|---|---|
| `POST` | `/recargas` | recepción, admin |
| `GET` | `/recargas` | recepción, admin |
| `POST` | `/recargas/:id/confirmar` | recepción, admin |
| `POST` | `/recargas/:id/anular` | **solo admin** |

### Administración
| Método | Ruta | Rol |
|---|---|---|
| `GET` | `/atracciones` | cualquiera |
| `POST` `PATCH` `DELETE` | `/atracciones[/:id]` | solo admin |
| `GET` `POST` `PATCH` `DELETE` | `/usuarios[/:id]` | solo admin |
| `GET` | `/configuracion` | cualquiera (recepción necesita el precio) |
| `PUT` | `/configuracion` | solo admin |
| `GET` | `/reportes/dashboard` | solo admin |
| `GET` | `/reportes/usos` | solo admin |
| `GET` | `/reportes/auditoria` | solo admin |

Los errores tienen forma estable, con un `code` que el frontend puede usar sin depender del texto:

```json
{ "error": { "code": "MANILLA_NO_ENCONTRADA", "message": "No existe una manilla con ese codigo" } }
```

---

## Pantallas

| Ruta | Quién | Qué |
|---|---|---|
| `/login` | todos | Entra y redirige según el rol. |
| `/estacion` | operador | Pantalla completa de escaneo, sin menús, con el resultado a toda pantalla y contador del día. |
| `/recepcion` | recepción, admin | Recarga en tres pasos: identificar manilla → puntos y pago → confirmación. |
| `/recepcion/manillas` | recepción, admin | Buscar manillas, ver historial, generar lotes e imprimir QR. |
| `/recepcion/recargas` | recepción, admin | Historial y confirmación de pagos digitales pendientes. |
| `/admin` | admin | Ingresos, uso por atracción, serie diaria, manillas y pagos pendientes. |
| `/admin/usos` | admin | Trazabilidad: cada acceso con manilla, atracción, operador y hora. |
| `/admin/atracciones` | admin | Alta, edición, costo en puntos y cortesía de cada atracción. |
| `/admin/usuarios` | admin | Trabajadores y su atracción asignada. |
| `/admin/configuracion` | admin | Precio por punto, datos de pago digital y cambio de contraseña. |

Todo es *mobile-first* y el frontend se divide por ruta: la tablet de una atracción descarga el lector de QR pero nunca las librerías de gráficas del panel (~110 kB comprimidos en lugar de ~320 kB).

---

## Manillas y códigos QR

Se contemplan las dos opciones que pediste:

**Códigos generados por el sistema.** En Manillas → *Generar lote e imprimir* se crean N manillas vacías y se abre una hoja lista para imprimir y recortar. El formato es `MIR-4H7K-92QX`, con un alfabeto sin `I`, `L`, `O` ni `U` para que nadie confunda un 0 con una O al teclearlo cuando el QR está rayado o mojado.

**Manillas preimpresas.** Si tus manillas ya vienen con un QR de fábrica, no generes nada: escanéala en recepción, el sistema dirá que no la conoce y ofrecerá *"Registrar esta manilla y recargar"*. Queda marcada con `origen = PREIMPRESO`.

El QR contiene **solo el código en texto plano**, no una URL. Así la manilla sigue sirviendo aunque el dominio del sistema cambie, y cualquier lector genérico muestra el código si hay que escribirlo a mano. Toda pantalla que escanea tiene entrada manual como respaldo.

---

## Pagos digitales y la ruta a Wompi

Hoy, con `PAGOS_PROVEEDOR=manual`:

1. Recepción elige *Digital*. El sistema genera una referencia única y muestra un QR con los datos de cobro configurados en Ajustes (entidad, número, titular, monto, referencia).
2. La recarga queda `PENDIENTE` y **no acredita puntos**.
3. El visitante transfiere y muestra el comprobante. Recepción pulsa *"Ya recibí el pago"* y los puntos entran.

Toda la lógica de pago está detrás de un adaptador (`server/src/services/pagos/`) con una interfaz común. Para activar Wompi:

1. Completar `crearIntento` y `consultarEstado` en `wompi.provider.js` (el cálculo de la firma de integridad y la verificación de firma de webhooks ya están escritos).
2. Exponer `POST /api/pagos/webhook` que verifique la firma y llame a `confirmarRecarga`.
3. Poner `PAGOS_PROVEEDOR=wompi` y las variables `WOMPI_*`.
4. Poner `Configuracion.confirmacionDigitalManual = false`.

A partir de ahí las recargas digitales se confirman solas y el paso manual desaparece, sin tocar rutas ni pantallas.

---

## Pruebas

**API — flujo completo end to end** (44 aserciones):

```bash
# con el backend corriendo en localhost:4000 y la base sembrada
./scripts/smoke-api.sh
```

Cubre login y roles, permisos por rol, generación de lotes, recarga en efectivo y digital, confirmación y anulación, escaneo permitido, cortesía por re-escaneo, saldo insuficiente, manilla inactiva, manilla preimpresa, precio configurable, reportes y auditoría.

El script crea usuarios (`recepcion`, `operador1`) y datos de prueba, así que conviene correrlo contra una base desechable.

---

## Operación diaria

**Montar una estación.** Crea el usuario operador en Administración → Usuarios, asígnale su atracción, y en el celular o tablet de esa atracción abre la URL, inicia sesión y añade la página a la pantalla de inicio (es una PWA). La sesión dura 30 días, así que no hay que volver a entrar cada mañana.

**El sonido.** El navegador bloquea el audio hasta la primera interacción. La estación muestra un aviso flotante: basta tocar la pantalla una vez al abrirla.

**Si el QR no lee.** Toda pantalla de escaneo tiene *"El QR no lee: escribir código"*. El código está impreso bajo el QR.

**Si se pierde una manilla con saldo.** Búscala en Manillas y desactívala: deja de servir de inmediato. Si recepción anotó el nombre del visitante al recargar, aparece en la ficha.

**Cierre de caja.** Administración → Resumen con el rango en "Hoy" da ingresos por método de pago, y Recargas permite revisar una por una. Los pagos digitales sin confirmar salen destacados: no cuentan como ingreso.

---

## Limitaciones conocidas

- **Requiere conexión.** El sistema es *online*: cada escaneo consulta el servidor. Si la atracción se queda sin internet, la estación muestra "sin conexión" y no registra el acceso. Es la decisión tomada para esta versión; migrar a offline-first implicaría cache local del saldo, cola de sincronización y una política de conflicto para el caso de gastar puntos que ya no existen.
- **La cortesía deja pasar sin saldo.** Dentro de la ventana de cortesía, un re-escaneo pasa aunque el saldo esté en cero. Es intencional (ese acceso ya se cobró) y dura lo que dure la ventana; se puede bajar o desactivar por atracción con `cooldownSegundos = 0`.
- **La confirmación del pago digital es humana.** Hasta que se integre Wompi, nada impide que alguien confirme una transferencia que no llegó. Queda registrado en la auditoría quién confirmó cada recarga.
- **Un aviso de consola con la cámara.** Al desmontar el lector, `html5-qrcode` puede dejar un `play()` pendiente y el navegador lo registra como *"The play() request was interrupted"*. Es sólo un mensaje de consola, sin efecto funcional; aparece de forma sistemática con la cámara simulada de las pruebas automatizadas.

---

## Estructura

```
server/
  prisma/schema.prisma       modelo de datos y migraciones
  prisma/seed.js             config, atracciones y admin inicial
  src/routes/                endpoints por recurso
  src/services/              reglas de negocio (escaneo, recargas, reportes)
  src/services/pagos/        adaptador de pasarela: manual y Wompi
  src/middleware/            autenticación por JWT y manejo de errores
web/
  src/pages/estacion/        pantalla de escaneo
  src/pages/recepcion/       recarga en tres pasos
  src/pages/manillas/        gestión e impresión de QR
  src/pages/admin/           reportes y configuración
  src/components/            lector de QR, generador de QR y UI compartida
scripts/smoke-api.sh         prueba end to end de la API
```
