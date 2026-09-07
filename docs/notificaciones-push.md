# Notificaciones del teléfono y la computadora

La interfaz se activa en **Más → Alertas → Avisos en este dispositivo**. El permiso lo concede cada persona desde su navegador; una aplicación no puede concedérselo a sí misma.

Esta función requiere un despliegue de frontend y API en Vercel, una migración en Supabase y una tarea programada. Hacer push a GitHub publica el código, pero **no configura por sí solo los secretos, la base ni la tarea**. Hasta que estén listos, la pantalla indica que el servicio aún no está habilitado. Las alertas de la campana siguen funcionando.

## Activación por el administrador

1. Ejecutar `supabase/migrations/20260907010000_web_push.sql` en SQL Editor, después del esquema inicial. Para los avisos de entrega también debe estar aplicada `20260907000000_add_delivery_status.sql`.
2. Ejecutar `npm run push:keys` en una terminal personal. Genera las claves VAPID y un secreto aleatorio para la tarea. Conservarlos de forma segura; generar **una sola vez**, no en cada despliegue. No copiar la salida en Git ni en un chat.
3. En **Vercel → proyecto → Settings → Environment Variables**, añadir estas variables para **Production**:

   | Variable | Valor |
   | --- | --- |
   | `SUPABASE_URL` | URL del mismo proyecto que usa la aplicación. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Clave `service_role` del proyecto, exclusivamente del servidor. |
   | `VAPID_PUBLIC_KEY` | Valor generado en el paso 2. |
   | `VAPID_PRIVATE_KEY` | Valor generado en el paso 2. |
   | `PUSH_CRON_SECRET` | Valor generado en el paso 2. |
   | `VAPID_SUBJECT` | URL HTTPS pública de producción, por ejemplo `https://mi-tienda.vercel.app`. |

   Ninguna de estas claves privadas debe llamarse `VITE_*`. No configurarlas en despliegues de prueba conectados a producción: así no se duplica el emisor ni se registran dispositivos en dominios temporales.
4. Volver a desplegar Production en Vercel para aplicar las variables. El archivo `vercel.json` conserva las rutas de API y los archivos de instalación separados de las rutas de la aplicación.
5. En **Supabase → Vault**, guardar dos secretos: `pacacontrol_push_url` con `https://TU-DOMINIO/api/push-dispatch`, y `pacacontrol_push_cron_secret` con el mismo valor de `PUSH_CRON_SECRET`. Usar el dominio final HTTPS, sin redirecciones, accesible a la tarea programada.
6. Ejecutar `supabase/setup/push_cron.sql` en SQL Editor. Programa una revisión cada cinco minutos. No usa Vercel Cron, cuyo plan Hobby limita la frecuencia a una vez por día.
7. Esperar la primera ejecución y revisar la tarea en Supabase Cron. En la app, abrir **Alertas**, activar el dispositivo y pulsar **Enviar prueba**. Se envía desde el servidor; máximo una prueba por minuto por dispositivo.
8. Para verificar el flujo completo: con una alerta activa, cerrar la aplicación y esperar la siguiente revisión. El teléfono/PC debe tener conexión y permitir avisos del navegador y del sistema. El modo No molestar y el ahorro de batería pueden silenciarlos o retrasarlos.

## Teléfonos y computadoras

- En iPhone/iPad se requiere iOS/iPadOS 16.4 o posterior y añadir la web a la pantalla de inicio. Abrirla desde ese icono antes de conceder el permiso.
- Android y escritorio necesitan un navegador compatible con Push API y un sitio HTTPS. La instalación es opcional donde el navegador permita push sin ella.
- La aplicación incluye manifiesto, iconos PNG y un service worker para recibir avisos. No almacena páginas ni inventario en caché y no ofrece funcionamiento sin conexión.
- La entrega final depende del navegador, el sistema operativo y la conectividad; aceptar un envío en el servidor no prueba que el usuario lo haya visto.

## Comportamiento y límites

- Se envía un resumen de nuevas alertas por dispositivo. No se incluyen nombres de clientes, importes ni claves en el aviso de la pantalla bloqueada. Tocarlo abre `/alertas`, que exige iniciar sesión.
- Usa las mismas reglas del panel. Cada dispositivo conserva en Supabase una copia de sus últimos límites guardados; las lecturas de la campana continúan siendo locales. Leer la campana no cancela el primer push pendiente.
- Cada suscripción conserva las revisiones enviadas. No se repiten en cada revisión. Tras observar una resolución, una nueva aparición vuelve a notificarse; pasar de poco inventario a cero también vuelve a avisar.
- Un bloqueo temporal impide emisores simultáneos. Los errores temporales se reintentan sin marcar el aviso como enviado. Si el proveedor acepta el envío pero falla la escritura posterior, puede haber un reintento duplicado; no se garantiza entrega exactamente una vez.
- La revisión procesa hasta 100 dispositivos por llamada y rota los más antiguos primero; si aumenta el volumen hay que ajustar el procesamiento y vigilar los límites de ejecución. Los datos de cada dueño se consultan con filtros explícitos; no se mezclan tiendas.
- Las suscripciones vencidas (404/410) se eliminan. El servicio no manda solicitudes a endpoints ajenos a proveedores push admitidos.
- Cerrar sesión, incluido el cierre por inactividad, desuscribe este navegador. Para seguir recibiendo, iniciar sesión y activar de nuevo. Cerrar la pestaña o la aplicación no equivale a cerrar sesión.
- No se envían avisos porque sí: requiere permiso del dispositivo, suscripción guardada, configuración del servidor y ejecución de la tarea.

## Comprobaciones de despliegue

- `/api/push-config` debe devolver JSON y `configured: true`; `schedulerHealthy: true` indica que la revisión corrió en los últimos 15 minutos. No expone claves privadas.
- `/api/push-dispatch` rechaza llamadas sin el secreto de la tarea. No usar un enlace público para disparar envíos.
- `/sw.js` debe servirse como JavaScript y `/manifest.webmanifest` como manifiesto, no como el HTML principal.
- Si falla una prueba, revisar permisos y registros del servidor. No registrar tokens de sesión, endpoints de suscripción ni claves VAPID en los logs.
- `npm test` y `npm run build` verifican lógica y compilación. La entrega real necesita la prueba del paso 7 en cada plataforma.

Fuentes: [Web Push en iOS/iPadOS, WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Push API, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [tareas con Supabase Cron y pg_net](https://supabase.com/docs/guides/functions/schedule-functions), [límites de Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing).
