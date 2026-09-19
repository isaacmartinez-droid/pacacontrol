# Hito 3: asistente y experiencia neutral

Fecha de implementación en el repositorio: 18 de septiembre de 2026.

## Objetivo

Permitir que una cuenta nueva describa su negocio antes de entrar al panel y que
la interfaz utilice el vocabulario confirmado, sin alterar los nombres internos
de tablas, rutas o funciones que mantienen compatibilidad con las cuentas
existentes.

## Asistente inicial

La ruta protegida `/configurar-negocio` ofrece siete pasos a pantalla completa:

1. identidad y actividad del negocio;
2. plantilla o configuración manual;
3. forma de comprar y controlar inventario;
4. forma de vender;
5. retiro, entrega o ambas opciones;
6. categorías sugeridas, editables y confirmadas por la persona;
7. revisión y preparación del espacio.

El progreso se guarda mediante `save_business_onboarding_draft(...)`. Cerrar o
recargar el navegador permite continuar desde el paso guardado. Las categorías
no se crean al elegir una plantilla ni al guardar un borrador: solo se escriben
durante la confirmación atómica con `complete_business_onboarding(...)`.

Una cuenta con configuración pendiente no puede entrar al panel. Las cuentas
existentes, migradas como `legacy_bales`, continúan directamente y conservan su
vocabulario anterior.

## Experiencia neutral

El perfil confirmado alimenta una capa de términos visibles para:

- navegación lateral y móvil;
- panel e indicadores configurables;
- compras, inventario, ventas, clientes, gastos, caja e historial;
- alertas dentro de la aplicación;
- notificaciones push generadas por el servidor;
- reportes y pantallas de edición.

La identidad antigua visible se sustituyó temporalmente por descriptores
neutrales como «Sistema de ventas» y «Avisos del negocio». El nombre comercial
definitivo, dominio e identidad visual corresponden al Hito 4 y no se inventan en
esta entrega. Los identificadores internos `bale`, `paca` y `pacacontrol` se
conservan donde no son texto presentado a la persona.

## Verificación local

- 117 pruebas unitarias, de servidor, seguridad y PostgreSQL aprobadas;
- prueba de humo visual completa aprobada en tamaño móvil;
- cuenta existente conserva «Paca/Pacas» hasta que decide cambiarlo;
- cuenta nueva de tienda general termina con «Compra/Compras» y no muestra la
  palabra «paca» en el panel;
- borrador guardado en cada paso y categorías creadas únicamente al confirmar;
- alertas y push usan el vocabulario del perfil sin incluir nombres, códigos ni
  importes privados en el mensaje externo;
- compilación de producción aprobada, con la advertencia conocida de tamaño del
  paquete principal.

## Validación remota pendiente

El preflight de staging del 18 de septiembre confirmó la referencia separada
`zijfywqastacydmuqswv`, registro público desactivado y recursos de perfiles y
plantillas protegidos. Esa comprobación es de solo lectura y no sustituye el
recorrido autenticado.

Antes de cerrar el hito se necesita en el entorno de pruebas:

1. crear o disponer de una cuenta nueva cuyo `business_profiles.onboarding_status`
   sea `pending`;
2. recorrer el asistente desde teléfono y computadora;
3. cerrar y volver a abrir a mitad del proceso para comprobar la reanudación;
4. confirmar que no existen categorías antes del último paso y que aparecen una
   sola vez después;
5. revisar panel, navegación, inventario, ventas, alertas y reportes con el
   vocabulario general;
6. comprobar una notificación push real si el dispositivo ya está suscrito.

El despliegue en producción debe realizarse después de esta validación y de una
regresión breve con una cuenta existente.
