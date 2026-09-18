# Avisos visibles y hora de Nicaragua

Se corrigieron los niveles ofrecidos para registrar/editar inventario: económico,
normal, premium y personalizado, que son los cuatro admitidos por SQL. Las
herramientas de cálculo de descuentos se mantienen sin prometer guardarlos como
niveles de inventario.

Preferencias protege campos editados frente a recargas, cambios de pestaña y
categorías nuevas. Los valores sin editar se sincronizan con el servidor. Guardar
normaliza el borrador; los campos no son editables mientras se guarda. Los precios
recordados usan la fecha de creación de la venta, con fecha de venta como respaldo
para datos antiguos. Se ofrecen todos sus importes únicos; no se supone que el
menor fue el último digitado ni a qué nivel corresponde.

Los importes muestran hasta dos decimales y no esconden faltantes menores a C$1.
Fechas comerciales y horas visibles usan `America/Managua`. Las fechas sin hora
se conservan sin desplazarlas. La nueva migración cambia funciones/defaults, no
reescribe instantes ni registros históricos.

## Notificaciones

En cualquier pantalla del negocio aparece un aviso emergente sin abrir la campana.
Se muestran hasta tres juntos, durante 15 segundos; apuntar o enfocar un aviso
pausa su cierre. Cerrar un aviso no lo marca leído. Abrir su acción sí lo marca.
No se repite la misma revisión al refrescar en la misma sesión del navegador.
Cuando el problema se resuelve y vuelve, o cambia su revisión, vuelve a emerger.
La campana conserva las alertas activas y sin leer.

Los avisos del sistema necesitan permiso, navegador compatible, suscripción y
servidor/tarea configurados. Son distintos de los avisos internos. Cada tipo tiene
título y etiqueta propios para que avisos diferentes no se reemplacen entre sí.
El aviso del sistema sigue siendo privado: no muestra clientes ni importes.
El service worker informa a las ventanas abiertas para refrescar sus alertas.

Alertas muestra permiso, dispositivo registrado y revisión automática del servidor.
«Probar permiso del dispositivo» es una prueba local y no confirma la entrega con
la aplicación cerrada. «Enviar prueba» usa el servidor. El diseño de los banners,
su sonido y su aparición en bloqueo los decide el sistema, no el sitio web.

El Vite local no ejecuta `/api/push-*`. Para envío real hace falta el despliegue con
las variables privadas y la tarea de `docs/notificaciones-push.md`. No se crearon
claves, se enviaron notificaciones reales ni se cambió el despliegue durante este
trabajo. En iPhone/iPad se necesita una web instalada en pantalla de inicio y
iOS/iPadOS 16.4 o posterior; otros navegadores se comprueban por capacidades.

## Consulta nueva para una base existente

Ejecutar después de las anteriores, primero en pruebas:
`supabase/migrations/20260917020000_nicaragua_business_timezone.sql`.
No volver a ejecutar el instalador sobre una base ya instalada.

Fuentes: [Notifications API, MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API/Using_the_Notifications_API),
[Web Push para iOS/iPadOS, WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
