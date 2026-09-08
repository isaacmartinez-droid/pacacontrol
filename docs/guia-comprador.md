# Guía completa de PacaControl

Bienvenido a PacaControl. Esta guía explica cómo usar el sistema para controlar compras de pacas, inventario, ventas, cobros, entregas, mermas y resultados.

PacaControl funciona desde un navegador en computadora o teléfono. Necesitas conexión a Internet para guardar los cambios.

## 1. Primer acceso

1. Abre la dirección que te proporcionó el vendedor.
2. Pulsa **Crear mi primera cuenta**.
3. Escribe tu **nombre** y **apellido**.
4. El sistema genera tu usuario automáticamente con el formato `nombre.apellido`.
5. Escribe una contraseña de al menos seis caracteres.
6. Pulsa el icono del **ojo** si quieres revisar lo que escribiste antes de guardar.
7. Pulsa **Crear cuenta**.

Para entrar después, escribe el usuario generado y tu contraseña en la pantalla de acceso.

> Importante: no compartas tu contraseña. Cada cuenta tiene sus propios datos; un usuario no puede ver las pacas, ventas ni clientes de otro usuario.

## 2. Recorrido rápido

Al iniciar sesión verás el panel principal. Desde allí puedes abrir:

- **Registrar venta:** registra la salida de prendas y el cobro.
- **Registrar paca:** registra una compra nueva y clasifica las prendas.
- **Pacas:** consulta la inversión y avance de cada compra.
- **Inventario:** revisa las piezas disponibles por categoría.
- **Ventas:** confirma pagos y actualiza entregas.
- **Más:** clientes, gastos, productos dañados, reportes y alertas.

Las tarjetas **Piezas disponibles** y **Piezas dañadas** del panel se pueden pulsar: abren directamente Inventario y Productos dañados.

## 3. Registrar una paca variada

Una paca puede contener diferentes tipos de prendas. No necesitas crear una paca separada para pantalones, camisas o ropa deportiva que venían en la misma compra.

1. Abre **Registrar paca**.
2. Indica la **fecha de compra**.
3. Escribe el **costo de compra**. Agrega transporte y otros gastos si los pagaste.
4. En **Clasificación de la paca**, completa la primera fila:
   - **Nombre:** escribe una categoría, por ejemplo `Pantalones`, `Camisas`, `Deportiva` o cualquier nombre propio de tu negocio.
   - **Piezas:** cantidad encontrada de esa categoría.
   - **Dañadas:** prendas que ya identificaste como no vendibles.
5. Si la paca es variada, pulsa **Agregar** y registra otra categoría. Repite las veces necesarias.
6. Si hay daños, escribe su motivo en la fila correspondiente: por ejemplo, “manchas”, “roturas” o “sin cierre”.
7. Indica el **margen de ganancia deseado**. El sistema propone 40%, pero puedes ajustarlo entre 1% y 90%.
8. Elige el nivel de precio de cada categoría: **Económica**, **Normal**, **Premium** o **Precio personalizado**.
9. Revisa el costo real y los precios recomendados; después pulsa **Registrar paca**.

El sistema suma todas las filas para obtener el total de la paca. También calcula las piezas vendibles y el costo estimado por pieza, incluyendo compra, transporte, gastos y mermas.

### Reglas importantes

- No repitas una misma categoría dentro de la misma paca. Si encontraste más prendas de una categoría, suma la cantidad en su misma fila.
- Puedes escribir una categoría nueva o reutilizar una existente. No hay una lista fija obligatoria.
- Las prendas dañadas se descuentan de las piezas disponibles.
- El costo real por pieza divide toda la inversión entre las prendas vendibles, no entre las recibidas.
- El precio recomendado usa margen real y se redondea hacia arriba al siguiente múltiplo de C$5.
- Los precios recomendados pueden cambiar si después registras nuevas prendas dañadas.
- El código `PAC-0001`, `PAC-0002`, etc., se asigna automáticamente al guardar.

## 4. Consultar pacas

En **Pacas** puedes revisar cada compra:

- costo de compra, transporte e inversión total;
- piezas recibidas, vendidas, dañadas y disponibles;
- porcentaje de avance de venta;
- estado: **En venta**, **Agotada** o **Sin piezas vendibles**.

Si tienes más de una, usa **Ver otra paca** para cambiar entre ellas. Una alerta de paca agotada también abrirá el detalle de esa compra.

## 5. Registrar una venta

1. Abre **Registrar venta**.
2. En **Categoría**, selecciona la prenda vendida. Solo se muestran categorías con existencias reales.
3. En **Paca de origen**, selecciona obligatoriamente la paca física de la que tomaste las prendas. Esto conserva el control correcto de la inversión y la ganancia.
4. Al seleccionar la paca, el sistema completa el **precio recomendado** para esa categoría. Puedes modificarlo manualmente.
5. Escribe la cantidad de piezas que tienen ese precio. Si otras piezas de la misma categoría tienen un precio diferente, pulsa **Otro precio** y agrega otro grupo. Por ejemplo: `1 × C$60` y `2 × C$90`.
6. Revisa el costo real mostrado. Cada grupo que quede debajo del costo o de la recomendación mostrará su propia advertencia.
7. Selecciona el cliente o **Venta de mostrador**.
8. Para una venta a cliente, escribe el **costo real del delivery**. Este dato es obligatorio. Si también cobras el envío al cliente, registra ese monto por separado.
9. Selecciona el método de pago.
10. Selecciona el estado de pago:
   - **Pagado completo:** se recibió todo el dinero.
   - **Pago parcial:** escribe cuánto recibiste. Debe ser menor al total.
   - **Pendiente de pago:** no se recibió dinero todavía.
11. Pulsa **Registrar venta**.

Los pagos parciales y pendientes requieren seleccionar un cliente. De esa manera sabes a quién corresponde el saldo.

> Registrar la venta aparta y descuenta las prendas del inventario, incluso si el cliente aún no ha terminado de pagar. Úsalo solo cuando el pedido ya esté confirmado.

## 6. Cobros y entregas

En **Ventas** cada pedido tiene dos controles independientes.

### Pago

Verás uno de estos estados:

- **Pagado:** no queda saldo.
- **Parcial:** muestra el monto que falta.
- **Pendiente:** muestra el total pendiente.

Cada pedido admite un primer pago y un segundo pago final. Ambos conservan monto, método y fecha. Cuando un cliente complete el pago, abre su historial, elige el método del pago final y pulsa **Cobrar saldo**. El sistema calcula exactamente lo que falta.

El historial conserva los pagos aunque la deuda ya esté cancelada. La ganancia estimada del pedido se calcula restando del total el costo de las prendas y el costo real del delivery.

### Entrega

Un pedido pagado puede avanzar por estos pasos:

1. **Preparar:** reúne y revisa las prendas.
2. **Listo:** el pedido está empacado o disponible.
3. **En camino:** ya salió con repartidor o hacia el cliente.
4. **Entregado:** el cliente lo recibió.

No es posible avanzar una entrega si el pedido no está pagado por completo. Esto evita marcar una entrega como terminada por error.

## 7. Registrar daños descubiertos después

Si encuentras una prenda dañada luego de registrar la paca:

1. Ve a **Más → Productos dañados**.
2. Pulsa el selector de paca y categoría.
3. Escribe la cantidad dañada y el motivo.
4. Pulsa **Registrar daño**.

El sistema descuenta esas prendas de la paca correcta. En la lista puedes ver el código de paca, categoría, cantidad y motivo de cada merma.

No registres como dañada una prenda ya vendida o apartada; el sistema solo permite descontar piezas disponibles.

## 8. Inventario

En **Inventario** ves las existencias por categoría. El número disponible ya descuenta:

- prendas vendidas;
- pedidos registrados;
- prendas dañadas.

Cuando una categoría llega al límite configurado, PacaControl puede crear una alerta de inventario bajo. Cuando una paca llega a cero piezas vendibles, se marca como agotada.

## 9. Clientes y gastos

### Clientes

Registra clientes cuando vendes fiado, aceptas pago parcial o haces entregas. Puedes guardar nombre, teléfono y prioridad. Pulsa una tarjeta para consultar todas sus compras, primer y segundo pago, métodos utilizados, delivery, saldo y ganancia o pérdida estimada.

### Gastos

En **Más → Gastos** registra gastos de operación que no estén incluidos al crear la paca. Ejemplos: bolsas, combustible, reparaciones o comisiones.

Si un gasto pertenece directamente a una paca, inclúyelo preferiblemente al registrarla para que su costo por prenda sea más preciso.

## 10. Alertas y notificaciones

En **Más → Alertas** puedes activar o desactivar reglas y definir límites:

- **Inventario bajo:** avisa cuando una categoría alcanza el número de piezas definido.
- **Revisar entregas:** avisa sobre pedidos pagados que continúan sin preparación o despacho después del número de horas elegido.
- **Daños por paca:** avisa cuando las mermas alcanzan el porcentaje definido.
- **Paca agotada:** avisa cuando una compra ya no tiene piezas vendibles.
- **Cobros pendientes:** avisa al cumplirse 24 horas con deuda y vuelve a notificar cada 5 horas mientras exista saldo.

Pulsa una alerta para abrir el registro relacionado. Marcarla como leída no la resuelve: desaparece solamente cuando cambian los datos y deja de existir el problema.

Al completar el pago, la alerta desaparece y cesan las notificaciones. La compra y sus dos pagos permanecen en el historial del cliente.

### Notificaciones en el teléfono o computadora

En la pantalla de Alertas puedes permitir notificaciones del navegador. Debes aceptar el permiso cuando el dispositivo lo pregunte. Las notificaciones no muestran datos privados del cliente; solo avisan que hay asuntos que revisar.

Si cambias de dispositivo, activa las notificaciones nuevamente en el dispositivo nuevo.

## 11. Reportes y ganancias

En **Más → Reportes y ganancias** puedes revisar:

- el último cierre diario generado;
- ventas registradas y piezas vendidas;
- costo estimado de las prendas vendidas;
- gastos del día;
- resultado neto estimado;
- entregas pendientes y mermas del día;
- efectivo, transferencias, tarjeta y otros cobros realmente recibidos;
- costo real y cobro de deliveries;
- saldo pendiente por cobrar;
- inversión y resultado de la paca actual.

El cierre diario se genera automáticamente después de medianoche, según la hora de Guatemala. El costo no descuenta toda la compra de una paca en un solo día: se reparte entre las prendas vendibles para estimar mejor el resultado de cada venta.

El reporte es una herramienta de control. Confirma físicamente el efectivo en caja y los comprobantes de transferencia antes de tomar decisiones finales.

## 12. Buenas prácticas de operación

1. Registra una paca al clasificarla, no días después.
2. Separa correctamente las categorías dentro de la paca.
3. Elige la paca manualmente en una venta si no usaste la más antigua.
4. Registra daños tan pronto como los descubras.
5. Crea cliente para cualquier venta pendiente, parcial o a domicilio.
6. Confirma el pago antes de avanzar la entrega.
7. Revisa Alertas al inicio y al final del día.
8. Compara el resumen diario con tu efectivo físico y transferencias recibidas.
9. No compartas usuarios ni contraseñas.

## 13. Problemas frecuentes

### “No aparece una categoría al vender”

La categoría solo aparece si tiene piezas disponibles. Revisa si se agotó, si todas sus prendas se marcaron como dañadas o si la registraste con otro nombre.

### “No puedo avanzar el pedido a entrega”

El pedido debe estar en **Pagado**. Abre la tarjeta y pulsa **Confirmar pago completo**.

### “No puedo registrar más daños”

No quedan suficientes prendas disponibles en esa paca y categoría. Revisa si ya fueron vendidas, apartadas o dañadas.

### “El usuario generado ya existe”

Otro usuario ya usa la combinación de nombre y apellido. Usa una variación real, por ejemplo agregando un segundo apellido, para crear un usuario distinto.

### “No recibo notificaciones”

Revisa que el navegador tenga permiso de notificaciones, que el dispositivo tenga conexión y que las reglas estén activas en Alertas.

## 14. Soporte

Antes de solicitar ayuda, toma una captura de la pantalla y anota:

- usuario con el que ingresaste;
- fecha y hora aproximada;
- acción que intentabas realizar;
- mensaje de error, si aparece.

No envíes contraseñas ni claves privadas al soporte.
