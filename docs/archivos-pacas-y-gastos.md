# Actualización: pacas archivadas, pedidos y gastos

Continuación: [fase 1 de estabilidad y seguridad](fase-1-estabilidad-seguridad.md),
con registro de pacas atómico, restricciones adicionales y comprobaciones previas
a publicación.

## Aplicación en producción

Primero aplicar las migraciones SQL pendientes en Supabase, en orden por nombre.
Después desplegar el frontend y el servicio de notificaciones en Vercel.
Esta actualización no borra registros ni reinicia la numeración de pacas.
No ejecutar `supabase/setup/reset_all_data.sql` para instalarla: ese archivo es un reinicio destructivo independiente.

Si `20260909000000_editable_orders_and_records.sql` falló anteriormente, ejecutar
su versión corregida y las migraciones posteriores que aún no se hayan aplicado.
Se corrigió el mensaje `RAISE` que contenía porcentajes sin escapar y provocaba
`too few parameters specified for RAISE`, abortando la transacción completa.

Migraciones nuevas de este trabajo:

1. `20260915000000_bale_archives_expense_planning.sql`: archivo lógico, inventario inactivo, bitácora y presupuestos mensuales.
2. `20260915010000_order_corrections_with_history.sql`: corrección de pedidos incluso entregados, con artículos y pagos anteriores conservados en la bitácora.
3. `20260915020000_supplemental_order_payments.sql`: nuevos cobros cuando un pedido aumenta después de haber recibido dos pagos.
4. `20260915030000_refresh_expense_and_payment_reports.sql`: cierres diarios que incluyen gastos reales y cobros adicionales.

La migración previa pendiente `20260912000000_refresh_summaries_on_payment_changes.sql`
también debe aplicarse antes de las anteriores si aún no está instalada.

## Uso

- **Pacas → Archivar**: retira la paca y sus piezas de las operaciones. Conserva las ventas, pagos, daños, gastos y el número de paca.
- **Pacas → Archivadas**: consulta el resultado individual o reactiva una paca. Hay que reactivarla para modificar sus artículos o costos.
- **Pedidos → Pacas archivadas**: consulta pedidos cuyo inventario completo proviene de pacas archivadas. Los pedidos mixtos continúan vigentes mientras contengan una paca vigente.
- **Clientes → Historial → Editar piezas y total**: corrige cantidades, precios, cliente o entrega. El total se calcula desde los artículos, no desde un saldo manual.
- **Más → Historial de cambios**: consulta antes y después de cada corrección y los archivados/reactivaciones, con paginación. La bitácora empieza con esta actualización; no inventa cambios antiguos.
- **Más → Gastos**: registra pagos reales, elige el mes a consultar y crea, corrige o pausa metas de reserva mensual.
- **Más → Preferencias → Indicadores**: selecciona inversión, inversión por recuperar, cobrado de la paca y/o reserva mensual, manteniendo un máximo de cuatro KPI.

## Cómo se calculan los importes

- Inversión de una paca = compra + transporte de adquisición + otros costos de adquisición.
- Inversión pendiente = máximo entre cero e inversión menos cobrado de prendas.
- Resultado final de ventas de una paca = ventas de prendas menos inversión completa menos gastos operativos asignados a esa paca.
- Precio promedio necesario restante = (meta de ganancia + inversión + gastos asignados − ventas registradas) / piezas restantes, limitado a cero.
- Ganancia mensual = resultados estimados de ventas del mes menos gastos pagados del mes.
- Reserva mensual = suma de metas vigentes. Es un presupuesto, no una salida de dinero; no se resta nuevamente de la ganancia.

Los periodos Hoy/Semana/Mes filtran ventas, cobros y gastos por fecha del negocio
(`America/Managua`). La inversión es la de la paca elegida, no la suma histórica.
Por defecto se elige la paca más reciente sin archivar; se puede elegir otra.
El inventario general muestra todas las pacas vigentes, no solamente la seleccionada.

Los cobros de pedidos con varias pacas se distribuyen proporcionalmente entre sus
prendas y delivery. El dinero asignado a una paca puede incluir efectivo, banco u
otros métodos: no es un arqueo de caja física. Las deudas reales siguen visibles
incluso si se archiva una paca. Archivar no debe cambiar artificialmente los
resultados financieros históricos.

## Verificación local

`npm test` incluye pruebas de cálculos y ejecución de todas las migraciones en
PostgreSQL en memoria mediante PGlite, con Auth simulado. No toca Supabase real.

`npm run test:ui` inicia Vite y comprueba el flujo móvil con Supabase simulado.
En Windows usa Edge o Chrome instalado. En otras plataformas se puede proporcionar
`PACA_BROWSER_PATH` o instalar el navegador de Playwright con `npx playwright install chromium`.
