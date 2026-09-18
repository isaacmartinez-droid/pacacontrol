# Hito 1: otros gastos explicables por compra

Fecha de implementación en el repositorio: 18 de septiembre de 2026.

## Resultado

Los otros gastos de una compra nueva ya no se capturan como un monto sin origen.
Cada renglón guarda su concepto y monto, mientras `bales.other_expenses` conserva
el total para que cálculos, vistas y clientes anteriores sigan funcionando.

La migración es
[`20260917030000_bale_other_expense_details.sql`](../supabase/migrations/20260917030000_bale_other_expense_details.sql).

## Reglas de compatibilidad

- Una compra nueva guarda todos sus conceptos y calcula el total en el servidor.
- La creación y la edición son atómicas: si falla un concepto, no queda una compra
  o corrección parcial.
- Las compras históricas con un total pero sin renglones muestran «Detalle anterior
  no desglosado».
- El sistema nunca crea conceptos ficticios para datos históricos.
- Una corrección que no toca ese total histórico lo conserva sin convertirlo.
- Si el usuario decide desglosarlo, debe escribir conceptos reales antes de guardar.
- Las correcciones quedan registradas en `business_history` con la fotografía
  anterior y posterior.

## Seguridad

La tabla `bale_other_expense_items` tiene aislamiento por propietario y solo permite
lectura directa al usuario autenticado. Las escrituras pasan por las RPC validadas:

- `create_bale_with_expense_details(...)`;
- `update_bale_with_expense_details(...)`.

Las RPC antiguas permanecen disponibles para compatibilidad, pero no inventan un
desglose. Una compra archivada debe reactivarse antes de corregirse.

## Interfaz

- «Registrar paca» permite agregar o quitar renglones de otros gastos.
- «Editar paca» permite corregirlos o iniciar voluntariamente el desglose histórico.
- El detalle de la compra contiene un acordeón con concepto, monto y total.
- Si no hay gastos, el acordeón muestra un estado vacío claro.

## Verificación local completada

- Ejecución de las 30 migraciones en PostgreSQL de pruebas.
- Creación y reemplazo atómicos de conceptos.
- Rechazo y reversión de conceptos inválidos.
- Conservación de totales históricos sin conceptos.
- Aislamiento entre negocios.
- Prueba visual de crear, editar y consultar el acordeón.
- Compilación de producción.

## Verificación de staging

El 18 de septiembre de 2026 se aplicó la migración en
`Sistema-Pacas-Pruebas (zijfywqastacydmuqswv)`. La auditoría devolvió sus 17
comprobaciones en `true`, incluyendo:

- tabla `bale_other_expense_items`;
- RPC de creación con desglose;
- RPC de corrección auditada;
- seis funciones con `America/Managua`;
- cero funciones restantes con `America/Guatemala`.

### Recorrido funcional aprobado

El usuario confirmó satisfactoriamente en la aplicación conectada a staging:

- creación de una compra con conceptos y total calculado;
- visualización del acordeón;
- edición de los montos;
- actualización de inversión e historial.

La compatibilidad de una compra histórica sin desglose también está cubierta por
la prueba automatizada de interfaz y la prueba transaccional de PostgreSQL.

### Producción

El 18 de septiembre de 2026 se aplicó la migración en producción. La comprobación
REST posterior confirmó que `bale_other_expense_items` existe y responde `401` a
una solicitud sin sesión, protección esperada.

La auditoría completa de producción devolvió sus 17 comprobaciones en `true`:

- tabla y RPC nuevas instaladas;
- fechas comerciales con `America/Managua`;
- seis funciones con la zona correcta;
- cero funciones restantes con `America/Guatemala`;
- controles anteriores de historial, arqueos, pagos e inventario presentes.

El frontend compatible se publicó desde `main` en el commit `2664f12`. El humo
público posterior confirmó respuesta `200` en acceso, rutas internas, manifest,
service worker y configuración push. El paquete publicado contiene la interfaz
de desglose de otros gastos.

Pendiente para cerrar el hito:

1. Hacer un recorrido autenticado breve de lectura, creación y edición en
   producción con una cuenta de prueba.
