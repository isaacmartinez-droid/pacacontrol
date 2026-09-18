# Hito 2: fundamento general del negocio

Fecha de implementación en el repositorio: 18 de septiembre de 2026.

## Objetivo de esta entrega

Separar la identidad y la configuración de cada negocio del modelo histórico de
pacas, sin renombrar tablas existentes ni obligar a las cuentas actuales a pasar
por un asistente nuevo.

## Base de datos

La migración
[`20260918000000_business_onboarding_foundation.sql`](../supabase/migrations/20260918000000_business_onboarding_foundation.sql)
incorpora:

- `business_templates`, con plantillas versionadas y de solo lectura para las
  cuentas usuarias;
- `business_profiles`, con identidad, modelo de inventario, ventas, entrega,
  vocabulario y estado reanudable de configuración;
- `save_business_onboarding_draft(...)`, que guarda avance sin crear categorías;
- `complete_business_onboarding(...)`, que confirma en una sola transacción las
  categorías escritas por la persona;
- `update_business_profile(...)`, para cambios posteriores controlados.

Las cuentas existentes reciben la plantilla compatible `legacy_bales`, quedan
marcadas como configuradas y conservan todos sus datos. Las cuentas nuevas dejan
de recibir categorías de ropa automáticamente y comienzan con estado `pending`.

## Reglas importantes

- Las plantillas son sugerencias: no crean categorías por sí solas.
- Deben confirmarse entre una y treinta categorías con nombres reales.
- La confirmación elimina duplicados por nombre, sin borrar categorías existentes.
- Repetir una confirmación completada no duplica ni cambia la plantilla.
- Un borrador no puede volver a abrir una configuración ya completada.
- Las tablas solo admiten lectura directa; las escrituras pasan por RPC validadas.
- Una cuenta suspendida no puede guardar ni completar configuración.

## Interfaz

La ruta `/ajustes` reúne:

- nombre y descripción del negocio;
- vocabulario de compras e inventario;
- modelo de operación actualmente asignado;
- accesos a ventas y precios, notificaciones y documentos legales.

El nombre guardado sustituye la marca fija en el encabezado lateral. La aplicación
de todo el vocabulario y el asistente a pantalla completa corresponden al Hito 3.

## Verificación local

- migración ejecutada junto con las 30 anteriores en PostgreSQL de prueba;
- cuenta nueva sin categorías supuestas;
- borrador reanudable sin efectos en inventario;
- confirmación atómica y sin duplicados;
- segunda confirmación convertida en operación sin cambios;
- aislamiento por propietario y bloqueo de cuentas suspendidas;
- instalador vacío con 31 migraciones;
- prueba móvil de lectura y guardado en `/ajustes`;
- compilación de producción aprobada.

## Despliegue pendiente

1. Aplicar la migración en staging.
2. Ejecutar `audit_hito0.sql`; ahora debe devolver 22 comprobaciones en `true`.
3. Probar `/ajustes` con una cuenta existente y confirmar que aparecen su nombre,
   plantilla heredada y categorías sin cambios.
4. Cuando staging sea aprobado, aplicar y auditar producción.
5. Publicar el frontend compatible.
