#!/usr/bin/env bash
# Prueba de humo end-to-end contra la API local.
set -uo pipefail
API=http://localhost:4000/api
FAILS=0

j() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{const o=JSON.parse(s);const v=process.argv[1].split('.').reduce((a,k)=>a?.[k],o);console.log(v===undefined?'':typeof v==='object'?JSON.stringify(v):v)}catch(e){console.log('')}})" "$1"; }

check() { # check <desc> <actual> <esperado>
  if [ "$2" = "$3" ]; then echo "  OK   $1 -> $2"; else echo "  FALLA $1 -> got='$2' want='$3'"; FAILS=$((FAILS+1)); fi
}

echo "== login admin =="
ADMIN=$(curl -s -X POST $API/auth/login -H 'content-type: application/json' -d '{"username":"admin","password":"cambiar123"}')
TOKEN_ADMIN=$(echo "$ADMIN" | j token)
check "token admin" "$([ -n "$TOKEN_ADMIN" ] && echo si || echo no)" "si"
AH="Authorization: Bearer $TOKEN_ADMIN"

echo "== login con clave mala =="
BAD=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/auth/login -H 'content-type: application/json' -d '{"username":"admin","password":"nope"}')
check "401 credenciales" "$BAD" "401"

echo "== atracciones =="
ATR=$(curl -s $API/atracciones -H "$AH")
A1=$(echo "$ATR" | j atracciones.0.id)
A2=$(echo "$ATR" | j atracciones.1.id)
check "hay atracciones" "$([ -n "$A1" ] && echo si || echo no)" "si"

echo "== crear usuarios recepcion y operador =="
curl -s -X POST $API/usuarios -H "$AH" -H 'content-type: application/json' \
  -d '{"nombre":"Ana Recepcion","username":"recepcion","password":"recepcion123","rol":"RECEPCION"}' > /dev/null
OPJSON=$(curl -s -X POST $API/usuarios -H "$AH" -H 'content-type: application/json' \
  -d "{\"nombre\":\"Luis Operador\",\"username\":\"operador1\",\"password\":\"operador123\",\"rol\":\"OPERADOR\",\"atraccionId\":\"$A1\"}")
check "operador con atraccion" "$(echo "$OPJSON" | j usuario.atraccionId)" "$A1"

echo "== operador sin atraccion debe fallar =="
NOATR=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/usuarios -H "$AH" -H 'content-type: application/json' \
  -d '{"nombre":"X","username":"opsin","password":"opsin1234","rol":"OPERADOR"}')
check "400 operador sin atraccion" "$NOATR" "400"

TOKEN_REC=$(curl -s -X POST $API/auth/login -H 'content-type: application/json' -d '{"username":"recepcion","password":"recepcion123"}' | j token)
TOKEN_OP=$(curl -s -X POST $API/auth/login -H 'content-type: application/json' -d '{"username":"operador1","password":"operador123"}' | j token)
RH="Authorization: Bearer $TOKEN_REC"
OH="Authorization: Bearer $TOKEN_OP"

echo "== recepcion no puede crear usuarios =="
FORB=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/usuarios -H "$RH" -H 'content-type: application/json' \
  -d '{"nombre":"Y","username":"y1","password":"y1234567","rol":"ADMIN"}')
check "403 recepcion->usuarios" "$FORB" "403"

echo "== recepcion genera lote de manillas =="
LOTE=$(curl -s -X POST $API/manillas/lote -H "$RH" -H 'content-type: application/json' -d '{"cantidad":3}')
COD=$(echo "$LOTE" | j manillas.0.codigo)
check "codigo generado" "$([ -n "$COD" ] && echo si || echo no)" "si"
echo "  codigo: $COD"

echo "== recarga en efectivo de 3 puntos =="
REC=$(curl -s -X POST $API/recargas -H "$RH" -H 'content-type: application/json' \
  -d "{\"codigoManilla\":\"$COD\",\"puntos\":3,\"metodoPago\":\"EFECTIVO\"}")
check "saldo tras recarga" "$(echo "$REC" | j manilla.saldoPuntos)" "3"
check "monto total 15000" "$(echo "$REC" | j recarga.montoTotal)" "15000"
check "estado confirmada" "$(echo "$REC" | j recarga.estado)" "CONFIRMADA"

echo "== escaneo del operador (atraccion asignada) =="
E1=$(curl -s -X POST $API/escaneos -H "$OH" -H 'content-type: application/json' -d "{\"codigo\":\"$COD\"}")
check "escaneo 1 permitido" "$(echo "$E1" | j resultado)" "PERMITIDO"
check "saldo despues 2" "$(echo "$E1" | j saldoDespues)" "2"

echo "== re-escaneo inmediato: cooldown, no cobra =="
E2=$(curl -s -X POST $API/escaneos -H "$OH" -H 'content-type: application/json' -d "{\"codigo\":\"$COD\"}")
check "escaneo 2 cooldown" "$(echo "$E2" | j resultado)" "COOLDOWN"
check "saldo sigue en 2" "$(echo "$E2" | j saldoDespues)" "2"
check "cooldown permite pasar" "$(echo "$E2" | j permitido)" "true"

echo "== operador no puede escanear en otra atraccion =="
OTRA=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/escaneos -H "$OH" -H 'content-type: application/json' \
  -d "{\"codigo\":\"$COD\",\"atraccionId\":\"$A2\"}")
check "403 otra atraccion" "$OTRA" "403"

echo "== admin escanea en atraccion 2 (cooldown es por atraccion) =="
E3=$(curl -s -X POST $API/escaneos -H "$AH" -H 'content-type: application/json' -d "{\"codigo\":\"$COD\",\"atraccionId\":\"$A2\"}")
check "escaneo atraccion 2 permitido" "$(echo "$E3" | j resultado)" "PERMITIDO"
check "saldo despues 1" "$(echo "$E3" | j saldoDespues)" "1"

echo "== gastar el ultimo punto y quedar sin saldo =="
A3=$(echo "$ATR" | j atracciones.2.id)
E4=$(curl -s -X POST $API/escaneos -H "$AH" -H 'content-type: application/json' -d "{\"codigo\":\"$COD\",\"atraccionId\":\"$A3\"}")
check "escaneo 4 permitido" "$(echo "$E4" | j resultado)" "PERMITIDO"
check "saldo 0" "$(echo "$E4" | j saldoDespues)" "0"

# Manilla nueva sin recargar: no hay uso previo, asi que el cooldown no aplica
# y el escaneo debe chocar contra el saldo.
VACIA=$(curl -s -X POST $API/manillas -H "$RH" -H 'content-type: application/json' -d '{}' | j manilla.codigo)
E5=$(curl -s -X POST $API/escaneos -H "$AH" -H 'content-type: application/json' -d "{\"codigo\":\"$VACIA\",\"atraccionId\":\"$A2\"}")
check "saldo insuficiente" "$(echo "$E5" | j resultado)" "SALDO_INSUFICIENTE"
check "no permitido" "$(echo "$E5" | j permitido)" "false"
check "puntos faltantes" "$(echo "$E5" | j puntosFaltantes)" "1"
check "http 200 en saldo insuficiente" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/escaneos -H "$AH" -H 'content-type: application/json' -d "{\"codigo\":\"$VACIA\",\"atraccionId\":\"$A2\"}")" "200"

# El cooldown se evalua ANTES del saldo a proposito: un re-escaneo dentro de la
# ventana corresponde a un acceso ya cobrado, no debe volver a cobrar ni negar.
E5B=$(curl -s -X POST $API/escaneos -H "$AH" -H 'content-type: application/json' -d "{\"codigo\":\"$COD\",\"atraccionId\":\"$A2\"}")
check "cooldown gana al saldo 0" "$(echo "$E5B" | j resultado)" "COOLDOWN"

echo "== manilla inexistente =="
E6=$(curl -s -X POST $API/escaneos -H "$AH" -H 'content-type: application/json' -d "{\"codigo\":\"MIR-XXXX-XXXX\",\"atraccionId\":\"$A2\"}")
check "manilla no encontrada" "$(echo "$E6" | j resultado)" "MANILLA_NO_ENCONTRADA"

echo "== recarga digital queda pendiente hasta confirmar =="
DIG=$(curl -s -X POST $API/recargas -H "$RH" -H 'content-type: application/json' \
  -d "{\"codigoManilla\":\"$COD\",\"puntos\":2,\"metodoPago\":\"DIGITAL\"}")
RID=$(echo "$DIG" | j recarga.id)
check "estado pendiente" "$(echo "$DIG" | j recarga.estado)" "PENDIENTE"
check "saldo NO sube aun" "$(echo "$DIG" | j manilla.saldoPuntos)" "0"
check "hay contenido para QR de pago" "$([ -n "$(echo "$DIG" | j pago.contenidoQr)" ] && echo si || echo no)" "si"

CONF=$(curl -s -X POST $API/recargas/$RID/confirmar -H "$RH")
check "confirmada" "$(echo "$CONF" | j recarga.estado)" "CONFIRMADA"
check "saldo tras confirmar" "$(curl -s $API/manillas/$COD -H "$RH" | j manilla.saldoPuntos)" "2"

echo "== doble confirmacion rechazada =="
check "409 ya confirmada" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/recargas/$RID/confirmar -H "$RH")" "409"

echo "== anular recarga: solo admin, devuelve puntos =="
check "403 recepcion anula" "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/recargas/$RID/anular -H "$RH" -H 'content-type: application/json' -d '{}')" "403"
ANU=$(curl -s -X POST $API/recargas/$RID/anular -H "$AH" -H 'content-type: application/json' -d '{"motivo":"prueba"}')
check "anulada" "$(echo "$ANU" | j recarga.estado)" "ANULADA"
check "saldo devuelto a 0" "$(curl -s $API/manillas/$COD -H "$RH" | j manilla.saldoPuntos)" "0"

echo "== manilla inactiva bloquea =="
MID=$(curl -s $API/manillas/$COD -H "$RH" | j manilla.id)
curl -s -X POST $API/recargas -H "$RH" -H 'content-type: application/json' -d "{\"codigoManilla\":\"$COD\",\"puntos\":1,\"metodoPago\":\"EFECTIVO\"}" > /dev/null
curl -s -X PATCH $API/manillas/$MID -H "$RH" -H 'content-type: application/json' -d '{"estado":"INACTIVA"}' > /dev/null
E7=$(curl -s -X POST $API/escaneos -H "$AH" -H 'content-type: application/json' -d "{\"codigo\":\"$COD\",\"atraccionId\":\"$A2\"}")
check "manilla inactiva" "$(echo "$E7" | j resultado)" "MANILLA_INACTIVA"
curl -s -X PATCH $API/manillas/$MID -H "$RH" -H 'content-type: application/json' -d '{"estado":"ACTIVA"}' > /dev/null

echo "== recarga a manilla preimpresa inexistente =="
NOEX=$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/recargas -H "$RH" -H 'content-type: application/json' \
  -d '{"codigoManilla":"PREIMPRESA-001","puntos":1,"metodoPago":"EFECTIVO"}')
check "404 sin crearSiNoExiste" "$NOEX" "404"
PRE=$(curl -s -X POST $API/recargas -H "$RH" -H 'content-type: application/json' \
  -d '{"codigoManilla":"preimpresa-001","puntos":2,"metodoPago":"EFECTIVO","crearSiNoExiste":true}')
check "manilla preimpresa creada" "$(echo "$PRE" | j manillaCreada)" "true"
check "codigo normalizado a mayusculas" "$(echo "$PRE" | j manilla.codigo)" "PREIMPRESA-001"

echo "== resumen del dia del operador =="
RES=$(curl -s "$API/escaneos/resumen" -H "$OH")
check "usos hoy >=1" "$([ "$(echo "$RES" | j usosHoy)" -ge 1 ] && echo si || echo no)" "si"

echo "== dashboard admin =="
DASH=$(curl -s "$API/reportes/dashboard" -H "$AH")
check "ingresos > 0" "$([ "$(echo "$DASH" | j ingresos.total)" -gt 0 2>/dev/null ] && echo si || echo no)" "si"
check "usos totales >= 3" "$([ "$(echo "$DASH" | j usos.total)" -ge 3 2>/dev/null ] && echo si || echo no)" "si"
check "recarga anulada excluida de ingresos" "$(echo "$DASH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const o=JSON.parse(s);console.log(o.ingresos.porMetodoPago.some(m=>m.metodoPago==='DIGITAL')?'si':'no')})")" "no"
check "3 atracciones en reporte" "$(echo "$DASH" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).usos.porAtraccion.length))")" "3"
check "recepcion no ve reportes" "$(curl -s -o /dev/null -w '%{http_code}' $API/reportes/dashboard -H "$RH")" "403"

echo "== precio configurable =="
curl -s -X PUT $API/configuracion -H "$AH" -H 'content-type: application/json' -d '{"precioPunto":8000}' > /dev/null
NUEVA=$(curl -s -X POST $API/recargas -H "$RH" -H 'content-type: application/json' \
  -d "{\"codigoManilla\":\"$COD\",\"puntos\":1,\"metodoPago\":\"EFECTIVO\"}")
check "usa el precio nuevo" "$(echo "$NUEVA" | j recarga.montoTotal)" "8000"
curl -s -X PUT $API/configuracion -H "$AH" -H 'content-type: application/json' -d '{"precioPunto":5000}' > /dev/null

echo "== auditoria registrada =="
AUD=$(curl -s "$API/reportes/auditoria?pageSize=5" -H "$AH")
check "hay auditoria" "$([ "$(echo "$AUD" | j total)" -gt 0 ] && echo si || echo no)" "si"

echo "== sin token =="
check "401 sin token" "$(curl -s -o /dev/null -w '%{http_code}' $API/manillas)" "401"

echo
if [ $FAILS -eq 0 ]; then echo "TODAS LAS PRUEBAS PASARON"; else echo "$FAILS PRUEBAS FALLARON"; fi
exit $FAILS
