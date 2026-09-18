# Categorías y valores habituales

Precios muestra categorías utilizadas en compras (también históricas), categorías
agregadas explícitamente y categorías con reglas de precio guardadas. El catálogo
inicial sin uso se oculta; no se borra nada. Las compras más recientes van primero.
«Otros» permanece si realmente se utilizó, pero ya no se propone por defecto.

«Agregar más» recuerda una categoría por nombre sin registrar piezas ni crear
una compra. Agregar un nombre existente reutiliza la categoría. Los precios que
se estén editando no se pierden al agregar otra categoría.

El último precio vendido se muestra como referencia real y solo se copia a un
nivel cuando el usuario pulsa su botón. No se supone qué nivel corresponde.
Los campos vacíos mantienen la regla existente de cálculo por costo y objetivo.

Valores habituales separa ventas, compras y envíos. Los botones recuperan
registros existentes sin modificar preferencias hasta pulsar Guardar. Para la
venta se copia el método del primer pago y el estado actual, no se reconstruye
un estado histórico desconocido. La ganancia deseada es un objetivo, no utilidad
real. Los costos de delivery no son el cobro al cliente ni un gasto en efectivo
confirmado.

En una base ya instalada ejecutar únicamente
`supabase/migrations/20260917010000_explicit_business_categories.sql`.
La consulta de gastos y arqueos anterior no incluye este campo nuevo. No volver
a ejecutar `install_staging.sql` sobre una base existente. No se cambian cuentas
ni se aplica SQL remoto desde el código.
