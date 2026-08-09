-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN', 'RECEPCION', 'OPERADOR');

-- CreateEnum
CREATE TYPE "EstadoManilla" AS ENUM ('ACTIVA', 'INACTIVA');

-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'DIGITAL');

-- CreateEnum
CREATE TYPE "EstadoRecarga" AS ENUM ('PENDIENTE', 'CONFIRMADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "OrigenCodigo" AS ENUM ('GENERADO', 'PREIMPRESO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoAcceso" TIMESTAMP(3),
    "atraccionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atraccion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "costoPuntos" INTEGER NOT NULL DEFAULT 1,
    "cooldownSegundos" INTEGER NOT NULL DEFAULT 60,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Atraccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manilla" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "saldoPuntos" INTEGER NOT NULL DEFAULT 0,
    "estado" "EstadoManilla" NOT NULL DEFAULT 'ACTIVA',
    "origen" "OrigenCodigo" NOT NULL DEFAULT 'GENERADO',
    "nombreVisitante" TEXT,
    "notas" TEXT,
    "creadaPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recarga" (
    "id" TEXT NOT NULL,
    "manillaId" TEXT NOT NULL,
    "puntos" INTEGER NOT NULL,
    "precioUnitario" DECIMAL(12,2) NOT NULL,
    "montoTotal" DECIMAL(12,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "metodoPago" "MetodoPago" NOT NULL,
    "estado" "EstadoRecarga" NOT NULL DEFAULT 'CONFIRMADA',
    "proveedorPago" TEXT,
    "referenciaPago" TEXT,
    "usuarioId" TEXT NOT NULL,
    "confirmadaPorId" TEXT,
    "confirmadaEn" TIMESTAMP(3),
    "anuladaEn" TIMESTAMP(3),
    "motivoAnulado" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recarga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Uso" (
    "id" TEXT NOT NULL,
    "manillaId" TEXT NOT NULL,
    "atraccionId" TEXT NOT NULL,
    "operadorId" TEXT NOT NULL,
    "puntosDescontados" INTEGER NOT NULL DEFAULT 1,
    "saldoAntes" INTEGER NOT NULL,
    "saldoDespues" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Uso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracion" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "nombreNegocio" TEXT NOT NULL DEFAULT 'Mirador',
    "moneda" TEXT NOT NULL DEFAULT 'COP',
    "precioPunto" DECIMAL(12,2) NOT NULL DEFAULT 5000,
    "cooldownSegundosDefault" INTEGER NOT NULL DEFAULT 60,
    "pagoDigitalTitular" TEXT,
    "pagoDigitalEntidad" TEXT,
    "pagoDigitalNumero" TEXT,
    "pagoDigitalInstrucciones" TEXT,
    "confirmacionDigitalManual" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "detalle" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE INDEX "Usuario_rol_idx" ON "Usuario"("rol");

-- CreateIndex
CREATE INDEX "Usuario_atraccionId_idx" ON "Usuario"("atraccionId");

-- CreateIndex
CREATE UNIQUE INDEX "Atraccion_nombre_key" ON "Atraccion"("nombre");

-- CreateIndex
CREATE INDEX "Atraccion_activa_idx" ON "Atraccion"("activa");

-- CreateIndex
CREATE UNIQUE INDEX "Manilla_codigo_key" ON "Manilla"("codigo");

-- CreateIndex
CREATE INDEX "Manilla_estado_idx" ON "Manilla"("estado");

-- CreateIndex
CREATE INDEX "Manilla_createdAt_idx" ON "Manilla"("createdAt");

-- CreateIndex
CREATE INDEX "Recarga_manillaId_idx" ON "Recarga"("manillaId");

-- CreateIndex
CREATE INDEX "Recarga_createdAt_idx" ON "Recarga"("createdAt");

-- CreateIndex
CREATE INDEX "Recarga_estado_idx" ON "Recarga"("estado");

-- CreateIndex
CREATE INDEX "Recarga_usuarioId_idx" ON "Recarga"("usuarioId");

-- CreateIndex
CREATE INDEX "Uso_manillaId_idx" ON "Uso"("manillaId");

-- CreateIndex
CREATE INDEX "Uso_atraccionId_createdAt_idx" ON "Uso"("atraccionId", "createdAt");

-- CreateIndex
CREATE INDEX "Uso_createdAt_idx" ON "Uso"("createdAt");

-- CreateIndex
CREATE INDEX "Uso_operadorId_idx" ON "Uso"("operadorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entidad_entidadId_idx" ON "AuditLog"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "AuditLog_usuarioId_idx" ON "AuditLog"("usuarioId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_atraccionId_fkey" FOREIGN KEY ("atraccionId") REFERENCES "Atraccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Manilla" ADD CONSTRAINT "Manilla_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recarga" ADD CONSTRAINT "Recarga_manillaId_fkey" FOREIGN KEY ("manillaId") REFERENCES "Manilla"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recarga" ADD CONSTRAINT "Recarga_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recarga" ADD CONSTRAINT "Recarga_confirmadaPorId_fkey" FOREIGN KEY ("confirmadaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Uso" ADD CONSTRAINT "Uso_manillaId_fkey" FOREIGN KEY ("manillaId") REFERENCES "Manilla"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Uso" ADD CONSTRAINT "Uso_atraccionId_fkey" FOREIGN KEY ("atraccionId") REFERENCES "Atraccion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Uso" ADD CONSTRAINT "Uso_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
