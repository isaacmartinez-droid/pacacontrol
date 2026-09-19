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

## Validación remota en staging

El 18 de septiembre se validó el recorrido autenticado contra el proyecto de
pruebas separado `zijfywqastacydmuqswv`, con registro público desactivado:

1. se creó una cuenta nueva y se comprobó su perfil `pending`, paso `0`;
2. la cuenta se activó como `owner` con plan `pilot_free` y vigencia de 30 días;
3. el acceso mediante el usuario interno, sin exponer un correo real, funcionó;
4. se recorrieron los siete pasos desde un navegador de escritorio;
5. la plantilla «Ropa y calzado» no mostró la plantilla heredada de pacas;
6. se confirmaron compra por unidades y lotes, variantes, ventas y entrega;
7. se editaron las sugerencias y la confirmación creó una sola vez las seis
   categorías elegidas por la persona.

La consulta de categorías se ejecutó después de pulsar «Preparar mi sistema» y
devolvió seis filas. Por tanto, esa ejecución remota confirma el resultado final,
pero no constituye evidencia directa de un conteo cero inmediatamente antes de
confirmar. Esa invariancia permanece cubierta por las pruebas automatizadas y por
la separación entre `save_business_onboarding_draft(...)` y
`complete_business_onboarding(...)`.

La regresión posterior con una cuenta existente en staging confirmó que entra
directamente al panel, conserva sus datos y mantiene el vocabulario heredado sin
ser forzada a repetir el asistente. Con esa comprobación, el Hito 3 queda aprobado
en staging.

La prueba push real puede completarse junto con el trabajo de vigencia y avisos
del Hito 4. Para publicar este hito se debe aplicar primero la migración del perfil
de negocio en producción y desplegar la interfaz únicamente después de verificar
el esquema remoto.
