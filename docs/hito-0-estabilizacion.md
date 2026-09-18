# Hito 0: estabilización y línea base

Inicio: 17 de septiembre de 2026.

Este registro distingue lo comprobado en el repositorio de lo que todavía debe
confirmarse en cada proyecto remoto. Ninguna auditoría de esta etapa modifica
cuentas, datos o configuración.

## Línea base local

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 108 pruebas aprobadas, 0 fallos |
| `npm run test:ui` | Recorrido móvil simulado aprobado |
| `npm run build` | Compilación de producción aprobada |
| Paridad de migraciones | 31 archivos y 31 incluidos en `install_staging.sql` |
| Instalación vacía | Aprobada mediante PGlite |
| Reejecución del instalador | Rechazada sin alterar datos, según prueba |
| Fallo al final del instalador | Transacción revertida por completo, según prueba |
| `npm audit` | 0 vulnerabilidades conocidas en dependencias |

La compilación advierte que el JavaScript principal minificado mide alrededor de
740 kB. No bloquea la estabilización funcional, pero queda como deuda de
rendimiento para separar pantallas mediante carga diferida.

El servidor de staging no pudo iniciarse en una segunda instancia porque el
puerto 5174 ya estaba ocupado. La instancia existente respondió HTTP 200. No se
detuvo porque puede pertenecer a una sesión de trabajo del usuario.

## Recorrido de interfaz aprobado

La prueba automatizada con Supabase simulado comprobó:

- selección y seguimiento de compras con existencias;
- filtros de pedidos;
- registro y corrección de pedidos conservando pagos;
- gastos reales y metas mensuales separadas;
- edición de gastos sin duplicación;
- arqueos, centavos y bloqueo de gastos con medio desconocido;
- archivo e historial sin borrar operaciones;
- registro atómico de compras e inventario;
- niveles de precio compatibles con SQL;
- categorías reales, «Agregar más» y conservación de borradores;
- registro público oculto.

Esta prueba no sustituye el recorrido con dos cuentas ficticias sobre el proyecto
remoto de staging.

## Auditoría de producción de solo lectura

Fecha de la lectura: 18 de septiembre de 2026, 05:26 UTC.

- Auth respondió correctamente y el registro público está desactivado.
- El esquema respondió para compras, inventario y compromisos mensuales.
- `business_history` y `sale_additional_payments` respondieron 401 al rol anónimo;
  esto es compatible con sus revocaciones de seguridad y no demuestra ausencia.
- La selección de `expenses.payment_method` respondió 400.
- `cash_reconciliations` respondió 404.
- La selección de `categories.is_user_created` respondió 400.

Los tres últimos resultados indican que las migraciones siguientes no están
visibles en el esquema REST auditado, ya sea porque no se aplicaron en ese proyecto
o porque el esquema todavía no se recargó:

1. `20260917000000_expense_edits_cash_reconciliation.sql`;
2. `20260917010000_explicit_business_categories.sql`;
3. `20260917020000_nicaragua_business_timezone.sql`.

No se aplicaron automáticamente. Antes de cualquier actualización remota se debe
confirmar el proyecto, comprobar respaldo y ejecutar la auditoría SQL de este hito.

## Auditoría REST de staging

Fecha de la lectura: 18 de septiembre de 2026, 05:30 UTC.

- La referencia validada fue `zijfywqastacydmuqswv`, distinta de producción.
- Auth respondió correctamente y el registro público está desactivado.
- `expenses.payment_method` y `categories.is_user_created` respondieron 200.
- `cash_reconciliations`, `business_history` y `sale_additional_payments`
  respondieron como recursos protegidos, no como recursos ausentes.

La lectura REST indica que staging está más actualizado que producción. La
auditoría SQL sigue siendo necesaria para comprobar funciones, zona horaria y
metadatos que el rol anónimo no puede leer.

### Resultado SQL confirmado por el usuario

La auditoría de metadatos devolvió las 14 comprobaciones en `true`: tablas,
columnas, funciones atómicas, arqueos y valores predeterminados están presentes;
se encontraron 6 funciones con `America/Managua` y ninguna con
`America/Guatemala`.

Los comandos seguros disponibles son:

```sh
npm run audit:staging
npm run audit:production
```

Ambos validan el entorno, consultan sin credenciales administrativas y nunca
imprimen la clave publicable.

## Despliegue web y push

La URL pública respondió HTTP 200, el manifiesto PWA está disponible con dos
iconos y `/api/push-config` informó que existe configuración pública VAPID. Esto
confirma configuración y despliegue del extremo público, no la entrega de una
notificación real con la aplicación cerrada.

## Resultado SQL de producción confirmado por el usuario

Producción conserva correctamente las funciones de archivo, historial, pagos
adicionales, compromisos mensuales y registro atómico, pero la auditoría devolvió
`false` en:

- `expenses.payment_method`;
- `cash_reconciliations`;
- `categories.is_user_created`;
- `save_cash_reconciliation`;
- valores predeterminados de compra y gasto en `America/Managua`;
- sustitución de `America/Guatemala` dentro de las funciones revisadas.

Se encontraron 5 funciones con `America/Guatemala` y ninguna con
`America/Managua`. Esto confirma que no es únicamente un retraso de PostgREST:
producción necesita las tres migraciones del 17 de septiembre en orden, después
de verificar respaldo.

### Avance de actualización de producción

1. `20260917000000_expense_edits_cash_reconciliation.sql`: aplicada con éxito,
   confirmado por el usuario.
2. `20260917010000_explicit_business_categories.sql`: aplicada con éxito,
   confirmado por el usuario.
3. `20260917020000_nicaragua_business_timezone.sql`: aplicada con éxito,
   confirmado por el usuario.

La auditoría REST posterior respondió 200 para `expenses.payment_method` y
`categories.is_user_created`, y reconoció `cash_reconciliations` como recurso
protegido. Ya no devuelve los errores 400/404 anteriores. La salida SQL final
confirma además los valores predeterminados y cuerpos de funciones.

### Auditoría final de producción

La ejecución final confirmada por el usuario devolvió las 14 comprobaciones en
`true`. Los valores predeterminados de compras y gastos usan `America/Managua`,
se encontraron 6 funciones con esa zona y ninguna con `America/Guatemala`.
Staging y producción quedan alineados en las estructuras cubiertas por esta
auditoría.

## Consulta segura de verificación

El archivo [audit_hito0.sql](../supabase/setup/audit_hito0.sql) consulta únicamente
metadatos. Se puede ejecutar por separado en staging y producción. No crea, edita
ni elimina objetos o registros. Devuelve una sola tabla: si todas las filas de
`passed` son `true`, las estructuras revisadas están presentes y usan Nicaragua.

Debe conservarse la salida con fecha y proyecto, sin copiar claves o datos de
clientes. La consulta permite distinguir una migración ausente de un retraso en
la caché REST.

## Pendientes para cerrar el hito

- [x] Guardar la salida de `audit_hito0.sql` para staging.
- [x] Guardar la salida de `audit_hito0.sql` para producción.
- [x] Aplicar y verificar las tres migraciones pendientes en producción.
- [ ] Confirmar el respaldo/restauración disponible antes de aplicar SQL remoto.
- [ ] Aplicar únicamente las migraciones ausentes, primero en staging.
- [ ] Completar el recorrido manual con dos cuentas ficticias en staging.
- [ ] Repetir pruebas y auditoría después de cada aplicación.
- [ ] Validar push real en Chrome/Brave, Android y Safari instalado en iPhone.
- [ ] Confirmar variables privadas y tarea programada sin exponer secretos.
- [ ] Corregir cualquier defecto encontrado y volver a ejecutar la línea base.

## Condición de cierre

El Hito 0 termina cuando el repositorio, staging y producción tienen un estado
conocido; staging aprueba el recorrido completo; producción tiene respaldo y solo
las migraciones autorizadas; y las notificaciones reales han sido verificadas en
los navegadores acordados.
