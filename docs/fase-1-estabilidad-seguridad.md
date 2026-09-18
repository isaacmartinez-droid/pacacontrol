# Fase 1: estabilidad y seguridad

Estado: primera entrega implementada y probada localmente. La fase no se considera
cerrada hasta verificar entorno de pruebas, respaldo, migraciones y publicación.
No se han modificado datos, configuración Auth ni despliegues de producción.

## Inventario y hallazgos

El proyecto usa React/Vite, Supabase Auth/PostgreSQL y funciones Vercel para push.
Los datos pertenecen a una cuenta mediante `owner_id`; todavía no existe un modelo
de equipos con varios empleados por negocio. Ese alcance deberá definirse antes
de ofrecer usuarios adicionales en un plan comercial.

Las vistas financieras ya usan `security_invoker`, y los perfiles restringen
edición de rol, plan y estado. Se conservaron las modificaciones previas y el
archivo `Logo .jpeg`; no se ejecutó el reinicio de datos.

| Hallazgo | Corrección en esta entrega | Estado real |
| --- | --- | --- |
| Código de registro validado en navegador | Se retiró `VITE_SIGNUP_ACCESS_CODE`; registro público cerrado | Local; falta desplegar |
| Registro directo en Auth puede saltarse la interfaz | Nuevos perfiles suspendidos por defecto, sin confiar en roles de metadata | Migración pendiente; además cerrar registro en Supabase Auth |
| RPC antiguas pueden eludir políticas de suspensión | Triggers verifican cuenta activa, identidad y propietario al escribir | Pruebas PostgreSQL aprobadas; migración pendiente |
| Inventario propio permite categoría ajena | Se validan vínculos de propietario y categoría en tablas relacionadas | Pruebas PostgreSQL aprobadas; migración pendiente |
| Edición REST de entrega elude reglas RPC | Se revocan permisos directos de actualización en ventas | Pruebas PostgreSQL aprobadas; migración pendiente |
| Funciones privilegiadas heredan EXECUTE de PUBLIC | Revocación PUBLIC/anon, preservando concesiones explícitas | Pruebas PostgreSQL aprobadas; migración pendiente |
| Registro de paca utiliza múltiples peticiones | RPC atómica crea paca, categorías, inventario y daños | Rollback probado antes y después de comenzar escritura |
| Perfil anterior puede coincidir temporalmente con otra sesión | Autorización visual y consentimiento requieren mismo ID de perfil y usuario | Local; falta desplegar |
| `.env` o metadatos de despliegue pueden entrar a Git | Exclusiones ampliadas; `.env.example` sigue versionado | Local |

Los triggers permiten trabajos de SQL/servicio sin JWT, pero rechazan un rol
`authenticated`/`anon` sin identidad. No deben exponerse credenciales privilegiadas.
Los cron de servicio conservan su funcionamiento; se necesita validarlos también
en el entorno real. Una suspensión no elimina ventas, pagos ni historial.

## Revisión de solo lectura del entorno configurado

Diagnóstico ejecutado el 16 de septiembre de 2026 mediante `npm run audit:production`.
Se usó solo la URL y clave publicable de `.env.local`; no se consultaron cuentas,
clientes ni importes. Este comando no establece que el proyecto sea el de
producción: debe confirmarse su identidad en Supabase antes de instalar cambios.

- Auth settings: HTTP 200, `publicSignupEnabled: true`.
- Consulta HEAD de `bales.archived_at/archived_reason`: HTTP 400.
- Consulta HEAD de `bale_inventory.is_active`: HTTP 400.
- `business_history`, `monthly_expense_commitments`, `sale_additional_payments`: HTTP 404.

Estas respuestas son compatibles con migraciones pendientes o un esquema REST
no actualizado. No sustituyen consultar el historial de migraciones y permisos:
no se dispone aquí de conexión administrativa a Supabase ni de proyecto Vercel
enlazado. No se verificaron respaldos, MFA, versión desplegada o entregas push reales.

## Instalación segura

1. Confirmar el proyecto Supabase y el proyecto/dominio Vercel usados por clientes.
2. Crear un entorno Supabase de pruebas con datos ficticios y un despliegue preview
   que apunte SOLO a ese proyecto. No reutilizar la base de producción en preview.
3. Confirmar respaldo recuperable y ensayar restauración fuera de producción.
   El respaldo debe contemplar datos, Auth y archivos si se utilizan; una exportación
   de reportes/PDF no constituye respaldo recuperable de la aplicación.
4. En Supabase Auth desactivar **Allow new users to sign up**. Esto es configuración
   externa; ninguna variable Vite puede reemplazarlo. Para cuentas creadas por el
   administrador, aprobar explícitamente el acceso cuando corresponda.
5. Comparar las migraciones realmente aplicadas. Instalar únicamente las pendientes
   en orden, incluyendo las mejoras descritas en [Pacas y gastos](archivos-pacas-y-gastos.md).
6. Instalar las nuevas migraciones de fase 1:
   - `20260916000000_business_security_hardening.sql`.
   - `20260916010000_atomic_bale_registration.sql`.
   - `20260916020000_timezone_safe_business_timestamps.sql`.
7. Probar en staging registro administrativo, ventas, edición, gastos, archivo,
   pagos, reportes y permisos. Después aplicar la misma versión en producción
   durante una ventana de mantenimiento y desplegar el frontend compatible.
8. Comprobar que no hay peticiones fallidas por funciones/columnas faltantes y que
   las cuentas existentes conservan su acceso y datos. No ejecutar `reset_all_data.sql`.

Recuperación: conservar la versión anterior del frontend, respaldo y registro de
migraciones. Priorizar corregir hacia delante. No revertir permisos de seguridad
para hacer funcionar un cliente antiguo ni eliminar tablas con datos para deshacer
la actualización. Si es necesaria restauración, pausar escrituras y seguir el
procedimiento ensayado para no perder ventas posteriores al respaldo.

## Verificaciones reproducibles

- `npm test`: cálculos, push, service worker y PostgreSQL en memoria.
- `npm run test:ui`: Supabase simulado; recorrido móvil, edición y retorno a pedidos,
  gastos, archivo y registro de paca mediante una única RPC. También verifica que
  variables VITE antiguas no reabren registro.
- `npm run build`: compilación de distribución. Existe advertencia de tamaño del
  bundle; no bloquea compilación, pero se optimizará antes del lanzamiento comercial.
- `npm audit --omit=dev --audit-level=high`: sin vulnerabilidades reportadas en
  dependencias de ejecución al momento de esta entrega; no equivale a auditoría completa.
- `npm run audit:production`: HEAD del esquema y GET de ajustes públicos Auth,
  sin escrituras ni claves en la salida. No verifica aislamiento real con dos cuentas.

Antes de cerrar fase 1 quedan obligatorias la prueba con dos cuentas ficticias en
staging real, concurrencia de ventas sobre las últimas piezas, restauración de
respaldo y validación push en dispositivos. PGlite no verifica GoTrue, PostgREST,
Storage, Realtime ni configuración de Vercel. No se han creado recursos externos.

## Manejo de las fases

1. **Fase 1:** inventario, seguridad y estabilidad; staging, respaldo y publicación
   son puertas de salida, no tareas que se dan por hechas con las pruebas locales.
2. **Fase 2:** acceso administrador independiente, autorización y MFA.
3. **Fase 3:** códigos de un solo uso, 30 días y suscripciones en servidor; reemplaza
   el registro público cerrado, sin habilitar cuentas solo por cambiar el frontend.
4. **Fase 4:** cobros, renovaciones, historial y notificaciones persistentes.
5. **Fase 5:** marca/dominio, ajustes y temas.
6. **Fase 6:** PWA, piloto y lanzamiento.

Cada entrega incluye cambios, pruebas, pendientes y estado local/staging/producción.
No se mezclan compras, publicación ni nuevos planes comerciales sin resolver sus
decisiones y la configuración necesaria.

Referencias técnicas: [variables públicas de Vite](https://vite.dev/guide/env-and-mode),
[políticas RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security)
y [seguridad de API](https://supabase.com/docs/guides/api/securing-your-api).

## Actualización: migraciones y fechas comerciales

Tras la instalación manual, la revisión REST de solo lectura confirmó las
columnas de archivo, administración, entrega y pagos adicionales. El usuario
aportó seis comprobaciones SQL con resultado `Actualizada` para las funciones
principales. Eso sustituye el diagnóstico inicial de objetos faltantes, pero no
constituye una auditoría completa de permisos o una prueba de los flujos reales.
El registro público en Supabase Auth seguía habilitado en la última comprobación.

La migración nueva `20260916020000_timezone_safe_business_timestamps.sql` corrige
un desfase de seis horas reproducido en sesiones con zona Guatemala: convertir
`now()` a UTC sin zona y después guardarlo como `timestamptz` vuelve a interpretar
esa hora según la sesión. Ahora los instantes se guardan con `now()`; los defaults
de fecha de compra y gasto usan explícitamente la fecha de Guatemala.

La migración cambia defaults y expresiones de funciones existentes mediante una
lista cerrada; conserva las versiones instaladas, propietario y permisos, sin
reemplazarlas por las RPC antiguas. No modifica fechas históricas ni regenera
cierres. Si hubiera registros históricos afectados, se debe investigar su zona
de origen y el periodo antes de autorizar cualquier corrección de esos datos.

Las pruebas PostgreSQL recorren ventas, correcciones, cobros, gastos, archivo y
aislamiento en UTC y Guatemala. Incluyen instantes reales, medianoche local,
movimiento de gastos entre cierres y repetición de la migración. Esta corrección
sigue siendo local hasta ejecutarla en Supabase; no se ha desplegado Vercel.
