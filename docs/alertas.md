# Alertas de la tienda

Acceso: campana de cualquier pantalla o **Más → Alertas**. Esta versión usa los datos existentes y no requiere una migración adicional.

| Regla inicial (ajustable) | Condición |
| --- | --- |
| Inventario bajo: 10 piezas | Categoría que recibió inventario y tiene 10 piezas o menos disponibles. Cero piezas tiene prioridad. |
| Revisar entregas: 24 horas | Venta con cliente, estado persistido `paid` y al menos 24 horas desde `sold_at`. No incluye mostrador ni estados ausentes. |
| Daños elevados: 10 % | Piezas dañadas / piezas recibidas de cada paca alcanza el límite. |

La aplicación todavía no distingue envío de retiro para ventas con cliente, ni almacena la hora efectiva del pago. Por eso el aviso pide revisar la entrega y calcula el tiempo desde el registro; no afirma que el delivery esté retrasado. El usuario puede desactivar esta regla.

Cada aviso abre la categoría, venta o paca correspondiente. Leerlo reduce el contador, pero no resuelve el problema ni modifica inventario o pedidos. Desaparece cuando una actualización de datos deja de cumplir la regla. Si se observa su resolución y luego vuelve a ocurrir, vuelve a estar sin leer. Agotar una categoría previamente leída también la vuelve a marcar sin leer.

Los datos se consultan cada minuto mientras la pestaña esté visible y al volver a ella, con un intervalo mínimo de 15 segundos entre actualizaciones automáticas exitosas. Registrar ventas, pacas o cambiar entregas también actualiza los datos. Las respuestas antiguas no reemplazan una consulta más reciente. Las fallas de conexión conservan el último resultado con una advertencia.

Las preferencias y lecturas se guardan en `localStorage` bajo una clave separada por el ID de la cuenta y se comparten entre pestañas del mismo navegador. No se sincronizan con otros dispositivos. Si se borra el almacenamiento, vuelven los límites iniciales y las alertas activas quedan sin leer. Si el navegador bloquea el almacenamiento, funcionan durante la sesión y se muestra el aviso en la configuración.

La campana no procesa datos con la aplicación cerrada. Los avisos del dispositivo se configuran por separado siguiendo [notificaciones-push.md](notificaciones-push.md); requieren suscripciones en Supabase y la tarea del servidor. Ningún modo registra problemas que aparecen y se resuelven entre consultas.

Verificación local: `npm test` prueba límites, resolución, repetición y casos sin datos; `npm run build` verifica la compilación de la interfaz.
