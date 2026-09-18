# Edición de gastos y arqueo de caja

En Gastos, el botón **Editar gasto** permite corregir concepto, monto, fecha,
categoría, paca, notas y medio de pago. **Guardar cambios del gasto** actualiza
el mismo registro; no crea otro gasto. Las correcciones quedan en Historial
de cambios → Gastos y recalculan los cierres de las fechas anterior y nueva.

Más → **Arqueo de caja** compara efectivo contado y esperado para un período:

`saldo inicial + cobros en efectivo + otras entradas − gastos en efectivo − otras salidas`.

El saldo inicial es el efectivo existente al comenzar la fecha Desde. No se
cuentan transferencias, tarjetas ni ventas aún sin cobrar. Los gastos históricos
quedan Sin especificar: hay que revisar su medio de pago para guardar un arqueo.
“Otro (fuera de caja)” no descuenta efectivo.

En otras salidas registra compras de pacas, delivery, retiros o depósitos bancarios
pagados con efectivo de caja que no figuren ya como gastos en efectivo. En otras
entradas registra aportes o retiros bancarios que entraron a caja. Detalla estos
montos en notas. No registrar dos veces el mismo movimiento. La inversión de una
paca no se descuenta automáticamente: no sabemos cómo fue pagada.

Los arqueos guardados son fotografías inmutables, no ajustes contables ni ganancias.
Si incluyen hoy, conservan lo registrado hasta el momento de guardar. Correcciones
posteriores o nuevos cobros requieren un nuevo arqueo. Se muestran los últimos 20;
los anteriores permanecen en la base. Las fechas comerciales usan
`America/Managua`.

## Actualización SQL por entorno

Para una base **ya instalada**, ejecutar solamente la migración
`supabase/migrations/20260917000000_expense_edits_cash_reconciliation.sql`, primero
en el proyecto de pruebas. No volver a ejecutar `install_staging.sql`: es exclusivo
para instalar desde cero una base de pruebas vacía.

La auditoría del Hito 0 detectó esta estructura en staging y no en producción.
Confirmar con `supabase/setup/audit_hito0.sql`, respaldo y registro del proyecto
antes de aplicar cambios. Los pedidos editables y los indicadores de inversión
por paca se conservan.
