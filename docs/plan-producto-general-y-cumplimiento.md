# Plan maestro: producto comercial general, acceso y cumplimiento

Fecha de consolidación: 18 de septiembre de 2026.

Este documento reúne dos planes acordados previamente y añade la decisión de
evolucionar el producto hacia una plataforma para comercios en general. El nombre
actual se considera provisional y no debe utilizarse como identidad futura.

## Decisiones de producto

- El producto dejará de presentarse como una herramienta exclusiva para pacas.
- La primera audiencia será **personas y pequeños negocios que venden productos**:
  inventario, compras, ventas, clientes, cobros, gastos, entregas y caja.
- No se intentará cubrir de inmediato todos los negocios posibles. Servicios,
  restaurantes, manufactura, facturación fiscal e integraciones contables pueden
  incorporarse después como módulos o plantillas específicas.
- Se conservará un solo núcleo de datos y reglas. Cada tipo de negocio utilizará
  una plantilla de configuración, vocabulario y funciones visibles, sin mantener
  aplicaciones independientes.
- No se hará un renombrado masivo de tablas y funciones en producción. Primero se
  desacoplará la interfaz; las migraciones internas se harán posteriormente, con
  compatibilidad y pruebas.

## Orden de ejecución y control del trabajo

La transformación no comenzará dejando tareas operativas a medias. Se trabajará
con **un solo bloque técnico principal a la vez**. Únicamente la investigación de
nombre, marca y requisitos legales podrá avanzar en paralelo, porque no modifica
datos ni comportamiento de producción.

Regla de trabajo:

1. terminar y verificar un hito;
2. registrar migraciones y decisiones;
3. probarlo en staging;
4. comprobar compatibilidad con cuentas existentes;
5. pasar al hito siguiente.

No se mezclarán en una misma entrega una migración estructural grande, cambios de
acceso, nuevo cobro y renombrado general. Esto reduce el tamaño de los fallos y
permite identificar qué cambio causó un problema.

### Estado consolidado al 17 de septiembre de 2026

La palabra «implementado» en esta tabla describe el repositorio. No confirma que
la migración o configuración correspondiente ya esté aplicada en producción.

| Trabajo | Estado del repositorio | Verificación pendiente |
| --- | --- | --- |
| Categorías reales y «Agregar más» | Pruebas locales aprobadas | Confirmar migración y flujo completo en staging |
| Protección de borradores en preferencias | Pruebas locales aprobadas | Prueba visual en dispositivos reales |
| Niveles de precio compatibles con SQL | Pruebas locales aprobadas | Regresión remota de crear y editar compras |
| Referencias de precios registrados | Pruebas locales aprobadas | Comprobar ventas reales con varios precios |
| Importes con centavos | Pruebas locales aprobadas | Revisar dispositivos y datos remotos |
| Zona comercial `America/Managua` | Staging y producción verificados | Recorrido funcional en dispositivos |
| Edición auditada de gastos | Esquema remoto y pruebas locales aprobados | Recorrido con cuenta ficticia |
| Arqueos de efectivo | Esquema remoto y pruebas locales aprobados | Recorrido con cuenta ficticia |
| Corrección de pedidos conservando pagos | Pruebas locales aprobadas | Pruebas remotas de concurrencia e inventario |
| Archivo de compras/lotes | Pruebas locales aprobadas | Comprobar historial, alertas y reactivación remotos |
| Avisos visibles dentro de la aplicación | Pruebas locales aprobadas | Prueba cruzada en dispositivos reales |
| Push con la aplicación cerrada | Configuración pública detectada | Tarea programada y prueba real en dispositivos |
| Centro formal de Ajustes | Hito 2 cerrado y verificado en producción | Ninguna |
| Detalle de otros gastos de compra | Hito 1 cerrado y verificado en producción | Ninguna |
| Códigos de prueba y campañas | Pendiente | Diseño seguro, administración y reglas legales |
| Avisos de vencimiento de prueba | Pendiente | Depende de campañas y vigencia de cuenta |
| Perfil y asistente de negocio | Hito 3 implementado y verificado localmente | Recorrido remoto con una cuenta nueva en staging |
| Documentos legales definitivos | Investigación iniciada | Dependen de identidad y modelo comercial definitivos |

### Hito 0. Cerrar la estabilización actual

Este es el punto de inicio. Antes de construir la plataforma general se debe:

1. crear un registro de migraciones aplicadas en staging y producción;
2. confirmar que `install_staging.sql` contiene todas las migraciones requeridas
   para una instalación vacía, sin usarlo para actualizar bases existentes;
3. ejecutar pruebas unitarias, de base de datos, seguridad y humo visual;
4. validar zona horaria, centavos, preferencias y categorías en una cuenta nueva;
5. validar gastos, arqueos, pedidos corregidos y archivo en una cuenta con datos;
6. completar una prueba push real con la aplicación abierta, cerrada y en móvil;
7. corregir únicamente defectos encontrados en esta validación.

Condición de salida: existe una versión estable que puede desplegarse sin depender
de trabajo de la transformación general.

El registro de ejecución y pendientes se mantiene en
[`docs/hito-0-estabilizacion.md`](hito-0-estabilizacion.md).

### Hito 1. Terminar el detalle de otros gastos

Es una función delimitada, necesaria y también válida para el producto general.
Se completará antes de cambiar el modelo principal:

1. tabla de conceptos de otros gastos;
2. creación y edición atómicas;
3. compatibilidad con totales antiguos no desglosados;
4. acordeón de detalle;
5. inclusión en historial, costos y pruebas.

Condición de salida: todo total nuevo de «otros gastos» puede explicarse mediante
sus conceptos, sin modificar datos históricos desconocidos.

La implementación y el procedimiento de verificación se registran en
[`docs/hito-1-otros-gastos.md`](hito-1-otros-gastos.md).

### Hito 2. Fundamento general del negocio

Después de cerrar los pendientes actuales se implementará:

1. perfil del negocio y estado del onboarding;
2. plantillas versionadas;
3. configuración reanudable e idempotente;
4. migración segura de cuentas existentes a una plantilla compatible;
5. capa de vocabulario neutral;
6. ruta `/ajustes` construida sobre ese perfil.

Condición de salida: una cuenta nueva puede describir su negocio y una cuenta
existente continúa funcionando sin pérdida ni duplicación.

La implementación y el procedimiento de verificación se registran en
[`docs/hito-2-fundamento-negocio.md`](hito-2-fundamento-negocio.md).

### Hito 3. Asistente y experiencia neutral

1. crear `/configurar-negocio` a pantalla completa;
2. permitir sugerencias editables y configuración manual;
3. crear categorías solo después de confirmarlas;
4. mostrar progreso real al preparar el espacio;
5. sustituir referencias visibles a pacas por compra, lote, producto o la palabra
   elegida por la configuración;
6. adaptar navegación, panel, alertas, reportes y notificaciones.

Condición de salida: una cuenta de tienda general puede completar el flujo sin ver
ropa o pacas, mientras una cuenta existente conserva su forma de trabajo.

La implementación y el procedimiento de verificación se registran en
[`docs/hito-3-asistente-experiencia-neutral.md`](hito-3-asistente-experiencia-neutral.md).

### Hito 4. Identidad y acceso comercial

Con la experiencia neutral estable:

1. seleccionar y validar el nuevo nombre;
2. cambiar identidad visual, dominio, manifest, remitentes y notificaciones;
3. implementar campañas y códigos de prueba;
4. añadir redención, vigencia y avisos de vencimiento;
5. completar controles administrativos y auditoría;
6. definir conversión a plan pagado, suspensión y recuperación.

Condición de salida: se puede publicar una campaña de prueba con reglas claras,
trazabilidad y sin otorgar privilegios administrativos.

### Hito 5. Cierre legal antes del lanzamiento público

1. completar hechos comerciales y técnicos;
2. redactar términos, privacidad, tratamiento de datos y bases promocionales;
3. verificar que describan el producto real;
4. obtener revisión profesional local;
5. implementar historial de aceptación y publicación de versiones;
6. solicitar aceptación de la versión aprobada.

Condición de salida: identidad, promoción, cobro, soporte, privacidad y salida del
servicio coinciden entre documentos, interfaz y operación real.

### Hito 6. Modelo general de productos e inventario

La generalización profunda continuará después del primer lanzamiento controlado:

1. productos y variantes;
2. compras y renglones de compra;
3. lotes neutrales de existencias;
4. compatibilidad o migración desde las estructuras actuales;
5. módulos especializados por tipo de comercio.

Este hito no debe confundirse con un simple cambio de palabras. Requiere diseño,
migraciones y pruebas propias.

### Trabajo permitido en paralelo

Mientras se ejecutan los hitos 0 y 1 se puede investigar, sin publicar cambios:

- opciones de nombre y disponibilidad de dominio/marca;
- información requerida para los documentos legales;
- contratos y regiones de los proveedores técnicos;
- entrevistas breves con posibles comercios para validar las preguntas del
  asistente.

No se redactarán términos definitivos ni se publicará una campaña hasta cerrar la
identidad y las condiciones comerciales.

## Parte I. Plan funcional acordado

### 1. Centro de ajustes

Crear una ruta `/ajustes` como lugar reconocible para administrar el negocio. La
opción «Más» puede continuar como menú secundario, pero no debe reemplazar un área
formal de configuración.

Secciones previstas:

1. Negocio: nombre visible, actividad, moneda, zona horaria y vocabulario.
2. Ventas: pago habitual, estado habitual, entrega y advertencias de precios.
3. Inventario y precios: categorías, niveles, reglas y objetivo de ganancia.
4. Indicadores: período y tarjetas del panel principal.
5. Notificaciones: avisos internos, dispositivo y pruebas push.
6. Cuenta y acceso: plan, vigencia, cierre de sesión y seguridad.
7. Legal y privacidad: documentos vigentes, aceptaciones y solicitudes.

Los formularios deben proteger borradores frente a recargas de datos, cambios de
pestaña y operaciones auxiliares. Ninguna preferencia se guarda hasta una acción
explícita del usuario.

### 2. Códigos de prueba gratuita

El sistema actual permite asignar manualmente fechas y planes, pero todavía no
constituye un sistema completo de códigos promocionales. Se necesita:

- tabla de campañas o códigos, guardando un hash y nunca el código reutilizable en
  texto plano;
- duración, vigencia, límite de usos, estado, creador y reglas de elegibilidad;
- tabla de redenciones con cuenta, fecha, campaña y vencimiento concedido;
- función transaccional para validar y canjear una sola vez;
- protección contra intentos repetidos y enumeración de códigos;
- generación y revocación desde el panel administrativo;
- historial de cada acción administrativa;
- registro o activación de cuenta unido al canje, sin confiar en una variable
  pública del navegador.

La promoción debe indicar antes de publicarse: duración, alcance, limitaciones,
fecha de vencimiento, si requiere medio de pago y qué sucede al terminar. La
primera versión no debe renovar ni cobrar automáticamente.

### 3. Vigencia y avisos de prueba

Mostrar el tiempo restante tanto dentro del sistema como, si el dispositivo está
suscrito, mediante notificaciones push privadas.

Hitos iniciales sugeridos: 7 días, 3 días, 1 día y vencido. El servidor debe
guardar qué aviso fue emitido para no repetirlo. La hora comercial será
`America/Managua` y los instantes continuarán almacenándose en UTC.

Al vencer:

- impedir nuevas operaciones según una regla explícita;
- permitir entrar a una pantalla de estado y contacto;
- no borrar datos automáticamente;
- ofrecer exportación o un período de recuperación conforme a la política legal;
- permitir al administrador extender, convertir o cerrar la cuenta con auditoría.

### 4. Administración y acceso

El panel administrativo ya tiene separación lógica y comprobaciones del lado de
la base de datos. Puede compartir la misma pantalla de acceso, siempre que el rol
determine el destino y que ninguna autorización dependa únicamente de la interfaz.

Mejoras pendientes:

- panel de campañas y códigos;
- vista de vigencia, últimos avisos y redención de cada cuenta;
- acciones explícitas para extender, convertir a pago, suspender y reactivar;
- filtros de cuentas próximas a vencer;
- auditoría inmutable de acciones;
- protección adicional para operaciones administrativas sensibles.

No se crearán «usuarios administradores» por medio de un código promocional. El
rol administrativo seguirá siendo una asignación separada y privilegiada.

### 5. Otros gastos de una compra

El monto agregado `other_expenses` no basta para explicar una compra. Se necesita
una colección de conceptos, por ejemplo transporte adicional, impuestos,
reparación, descarga o embalaje.

Cada detalle tendrá concepto, monto, fecha de creación y orden. El total de los
detalles será la fuente del monto agregado utilizado en costos. La creación y
edición se realizarán atómicamente y conservarán historial.

En el detalle de una compra se mostrará un acordeón con:

- concepto;
- monto con centavos;
- total de otros gastos;
- estado vacío claro cuando no existan detalles.

Los registros antiguos conservarán su total. Si no existen conceptos históricos,
se mostrarán como «Detalle anterior no desglosado» hasta que el usuario decida
corregirlos; el sistema no inventará conceptos.

### 6. Trabajo ya realizado que debe preservarse

- categorías reales y acción «Agregar más»;
- borradores protegidos en preferencias;
- importes con centavos;
- fechas comerciales de Nicaragua;
- edición auditada de gastos y arqueos;
- corrección de pedidos conservando pagos;
- archivo de compras/lotes sin borrar el historial;
- avisos visibles dentro del programa y soporte para push;
- niveles de precio consistentes entre interfaz y base de datos.

## Parte II. Plan legal y de cumplimiento

El trabajo legal se gestionará como un frente separado. Ningún texto debe afirmar
que existe una sociedad mercantil mientras no esté constituida. Hasta entonces,
el proveedor se identificará con la persona natural responsable y el nombre del
producto se presentará como marca o nombre comercial, sujeto a validación.

### 1. Hallazgos de la revisión preliminar

El texto actual es un borrador útil, pero no es suficiente para un lanzamiento
comercial. Faltan identidad y domicilio del proveedor, reglas completas de cobro,
cancelación y soporte, tratamiento de datos de clientes de los comercios,
transferencias internacionales, propiedad intelectual, salida del servicio,
reclamos, evidencia de aceptación y límites legales a las exoneraciones.

La plataforma trata datos de dos grupos:

1. titulares de las cuentas que contratan el servicio;
2. clientes, contactos y deudores registrados por esos negocios.

Esto exige distinguir al negocio que decide qué datos cargar y a la plataforma
que los procesa para prestar el servicio.

### 2. Paquete documental

Preparar y versionar por separado:

1. Términos y condiciones del servicio.
2. Aviso o política de privacidad.
3. Acuerdo de tratamiento de datos para negocios usuarios.
4. Bases de promociones y códigos de prueba.
5. Aviso de notificaciones push y almacenamiento local.
6. Política interna de seguridad, incidentes, respaldos, retención y eliminación.
7. Política de soporte, suspensión, cancelación y salida.

### 3. Fundamento mínimo que debe verificarse

- [Ley N.º 787 de Protección de Datos Personales](https://legislacion.asamblea.gob.ni/normaweb.nsf/9e314815a08d4a6206257265005d21f9/e5d37e9b4827fc06062579ed0076ce1d).
- Reglamento de la Ley 787, Decreto N.º 36-2012.
- [Ley N.º 842 de Protección de los Derechos de las Personas Consumidoras y Usuarias](https://legislacion.asamblea.gob.ni/Diariodebate.nsf/76ed72912dd57e570625698c00773f5d/d6aa88431eb0ac6906257c2a005885e2).
- [Ley N.º 729 de Firma Electrónica](https://legislacion.asamblea.gob.ni/gacetas/2010/8/g165.pdf).
- Normativa aplicable a propiedad intelectual y programas de ordenador.
- [Acuerdo de procesamiento de datos de Supabase](https://supabase.com/downloads/docs/Supabase%2BDPA%2B231211.pdf).
- [Acuerdo de procesamiento de datos de Vercel](https://vercel.com/legal/dpa).

La revisión final debe realizarla un abogado nicaragüense con experiencia en
contratos, consumo y protección de datos. Los documentos no sustituyen procesos
reales de seguridad, atención de solicitudes y cumplimiento.

### 4. Información que debe definirse antes de redactar

- nombre legal de la persona responsable;
- futuro nombre comercial del producto;
- ciudad o domicilio para notificaciones;
- correo y teléfono de soporte y privacidad;
- territorio donde se ofrecerá;
- duración y reglas de las pruebas;
- precio, moneda, impuestos, comprobantes y periodicidad;
- renovación, cancelación y falta de pago;
- horarios y alcance del soporte;
- exportación, conservación y eliminación de datos;
- política real de respaldos;
- región y configuración real de los proveedores técnicos;
- titularidad del código, marca, diseños y componentes de terceros.

### 5. Evidencia técnica de aceptación

No sobrescribir una única fecha. Crear un historial que conserve:

- cuenta y documento aceptado;
- versión y hash del contenido exacto;
- fecha y hora UTC;
- forma de aceptación;
- versión de la aplicación;
- motivo por el que se solicitó una nueva aceptación.

La interfaz debe permitir leer y descargar los documentos antes de aceptar. La
aceptación electrónica no se anunciará como firma electrónica certificada.

### 6. Secuencia legal

1. Inventario de hechos comerciales y técnicos.
2. Matriz requisito–documento–función del sistema–evidencia.
3. Primer borrador en español correcto y comprensible.
4. Revisión de coherencia con el comportamiento real del producto.
5. Revisión profesional local.
6. Publicación, versionado y solicitud de aceptación.
7. Auditoría periódica al cambiar precio, marca, proveedores o funciones.

## Parte III. Evolución hacia una plataforma para comercios

### 1. Alcance inicial recomendado

La promesa inicial no debería ser «sirve para cualquier negocio». Una promesa más
realista y vendible es:

> Sistema adaptable para pequeños comercios que compran productos, controlan
> inventario y venden de contado o al crédito.

Esto ya cubre ropa, calzado, cosméticos, accesorios, bazares, ventas por catálogo
y tiendas generales sin asumir de inmediato las reglas de restaurantes,
manufactura, citas profesionales o contabilidad fiscal.

### 2. Asistente inicial

Después del primer inicio de sesión, una ruta de configuración a pantalla completa
reemplazará temporalmente el panel. No será un modal: debe poder continuar después
de cerrar el navegador, funcionar bien en teléfono y mostrar el progreso.

Preguntas de la primera versión:

1. ¿Cómo se llama tu negocio?
2. ¿Qué tipo de productos vendes?
3. ¿Compras unidades sueltas, lotes o ambos?
4. ¿Necesitas controlar variantes como talla, color o presentación?
5. ¿Vendes de contado, al crédito o de ambas formas?
6. ¿Ofreces retiro, entrega o ambos?
7. ¿Qué categorías deseas comenzar usando?

Cada plantilla ofrecerá sugerencias editables. La persona deberá confirmar las
categorías; «Otro» no creará suposiciones ni inventario. También existirá
«Configurar manualmente» para negocios que no encajen en una plantilla.

Al final se mostrará un resumen. Solo al confirmar se ejecutará una operación
idempotente que cree la configuración. La pantalla «Estamos preparando tu
negocio» se mostrará mientras exista trabajo real y deberá informar éxito o error,
sin una espera artificial.

### 3. Plantillas, no aplicaciones distintas

Ejemplos iniciales:

- ropa y calzado: talla, color, temporada y lotes;
- cosméticos y accesorios: presentación, marca y existencias;
- venta por catálogo o redes: pedidos, clientes, saldos y entregas;
- tienda general: productos, categorías y compras;
- configuración manual: negocio sin categorías predeterminadas.

Una plantilla define valores iniciales y módulos visibles. No cambia las reglas de
seguridad ni crea una versión distinta del código.

### 4. Modelo general propuesto

Agregar gradualmente conceptos neutrales:

- `business_profiles`: identidad, actividad, plantilla y estado de configuración;
- `products`: producto vendible;
- `product_variants`: talla, color, presentación, código o SKU;
- `purchases` y `purchase_items`: entradas de mercancía y sus costos;
- `stock_batches`: lote de existencias y costo de referencia;
- ventas, pagos, clientes, gastos y entregas como núcleo compartido;
- `business_features`: capacidades activadas por configuración, no permisos de
  seguridad;
- vocabulario de interfaz controlado, sin alterar nombres físicos de tablas en la
  primera etapa.

Las tablas actuales de pacas se pueden tratar temporalmente como compras por lote.
La interfaz mostrará «Compra» o «Lote» según configuración. Renombrar físicamente
tablas, funciones y columnas será una migración posterior porque hoy hay muchas
funciones, vistas, pruebas y tareas que dependen de esos nombres.

### 5. Compatibilidad de cuentas existentes

- Las cuentas actuales conservarán todos sus datos.
- Se les asignará una plantilla compatible con su operación actual.
- No se volverán a crear categorías ni se ejecutará el asistente destructivamente.
- Podrán revisar su perfil de negocio y cambiar vocabulario o módulos después.
- Cualquier migración tendrá respaldo, validaciones y posibilidad de reversión.

### 6. Fases de implementación

#### Fase A. Identidad neutral

- seleccionar nombre y revisar disponibilidad de dominio y marca;
- retirar nombres anteriores de títulos, manifest, correo y notificaciones;
- definir vocabulario neutral en la interfaz;
- mantener alias internos para no romper la base existente.

#### Fase B. Perfil de negocio y asistente

- tabla y estado de configuración;
- plantillas versionadas;
- asistente reanudable;
- función transaccional e idempotente de finalización;
- protección para impedir entrar al panel con una configuración incompleta.

#### Fase C. Compras e inventario generales

- presentar las pacas actuales como compras/lotes;
- introducir productos y variantes sin perder categorías existentes;
- adaptar precios, mermas, costos e historial;
- actualizar reportes y alertas con términos neutrales.

#### Fase D. Módulos opcionales

- crédito y cobros;
- delivery;
- variantes;
- arqueos;
- precios recomendados;
- funciones especializadas por plantilla.

#### Fase E. Migración interna

Solo después de estabilizar la interfaz general se evaluará renombrar tablas y
RPC. Se hará mediante nuevas estructuras o capas de compatibilidad, nunca mediante
una sustitución masiva en una base con datos reales.

## Criterios para considerar completa la transformación

- Una cuenta nueva puede configurarse sin ver referencias a pacas o ropa si no
  eligió esa plantilla.
- Las categorías sugeridas requieren confirmación del usuario.
- El asistente puede cerrarse y continuar sin duplicar datos.
- Las cuentas antiguas mantienen inventario, ventas, pagos e historial.
- Las alertas, reportes, notificaciones y documentos legales usan la nueva marca.
- La promoción gratuita tiene reglas publicadas y evidencia de cada redención.
- Los documentos legales describen lo que el sistema hace realmente.
- Ninguna autorización administrativa depende solo de componentes de React.
