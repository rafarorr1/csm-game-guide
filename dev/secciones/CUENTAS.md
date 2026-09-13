# Cuentas de jugadores — acceso obligatorio y progreso offline

## Revisión vigente — 2026-09-13

Rama `feature/acceso-correo-offline`, desde `origin/develop` / build 258.
El acceso con correo y código pasa a ser necesario para jugar. La app instalada
puede continuar sin conexión después de verificar y vincular la cuenta en ese
dispositivo; el avance pendiente se sincroniza cuando vuelve internet.

**Beta conserva 258 y producción 257.** Las cuentas reales ya funcionan desde
257. Esta revisión sigue el orden sección aislada → aprobación → integración y
validación para beta → producción autorizada. BUILD 258 sólo identifica la base;
el próximo número se asignará al integrar. La revisión aislada no sustituye la
validación completa ni constituye una publicación del juego en beta.

La ruta de revisión existente es
`https://aislados.caoz-tcg.pages.dev/cuenta/`. Sus 13 archivos ya están publicados
y verificados; commit, artefacto y comprobaciones figuran en `caoz_tcg/HANDOFF.md`.
La configuración real se documenta en [`../cuentas/README.md`](../cuentas/README.md).

## Recorrido que se puede revisar

1. Crear o abrir una cuenta con correo y código de seis números. El buzón
   muestra un **código de prueba**; «Usar código» lo rellena, sin confirmar solo.
2. Vincular el avance local o recuperar el de la cuenta. Si hay dos copias,
   elegir una; no se suman. El menú permanece bloqueado hasta completar el acceso.
3. «Entrar al Domo» abre un menú de revisión, sin cargar una batalla. «Simular
   victoria» modifica los récords del snapshot real en el almacenamiento temporal.
4. Activar «Sin conexión» y sumar victorias. El contador del dispositivo aumenta
   mientras el de la cuenta mantiene lo último confirmado.
5. «Recargar app» reconstruye los módulos conservando la misma memoria y la
   cola. La cuenta previamente vinculada puede continuar sin volver a pedir código.
6. Recuperar la conexión: la cola se sincroniza y ambos contadores coinciden.

El banner dice «Datos ficticios». No se usan cuentas, correos, cookies ni
almacenamiento persistente reales. Una recarga real del navegador, cambiar
escenario o «Reiniciar prueba» empieza otra demostración. El botón «Recargar app»
es el que conserva los datos temporales y permite comprobar el arranque offline.

Escenarios: `?estado=vacio` (predeterminado) empieza sin progreso; `nuevo`
contiene un avance local; `entrar` recupera una cuenta de ejemplo y `conflicto`
presenta dos avances. Una primera entrada offline no permite jugar.

## Componentes reales y aislamiento

| Archivo | Responsabilidad |
|---|---|
| `cuenta-modelo.js` | Estados y decisiones de correo, verificación, vínculo, conflicto y acceso obligatorio. |
| `cuenta-ui.js`, `cuenta.css` | Formulario y perfil compartidos entre móvil, escritorio y laboratorio. |
| `cuenta-progreso.js` | Captura íntegra del progreso, vínculo y copias locales por propietario. |
| `cuenta-servicio.js` | API inyectable, recibo local de identidad y cola persistente con revisión/operación. |
| `cuenta-acceso.js` | Coordinación de identidad, vínculo confirmado, acceso y sincronización; escucha los cambios de conexión. |
| `cuenta-demo.js` | `crearTransporte()` imita únicamente HTTP en memoria y `crearMemoria()` ofrece almacenamiento temporal. `crear()` se conserva para las pruebas de modelo anteriores. |
| `cuenta-lab.js/css`, `cuenta.html` | Montaje, datos de ejemplo, menú de revisión y controles de simulación. |
| `cuenta-exportar.mjs` | Lista cerrada de componentes, procedencia y hashes, manteniendo la CSP común. |

`CAOZ_CUENTA_ACCESO.crear({progreso,servicio,storage,eventos,onImportar,puedeVincular})`
devuelve `modelo`, `estado()`, `puedeJugar()`, `iniciar()`,
`activarVinculo()`, `guardar()`, `suscribir()` y `destruir()`.
El laboratorio inyecta un Map tipo Storage, un EventTarget y el transporte
temporal. No distribuye `cuenta-juego.js`, motor, campaña, online ni service worker.
El juego monta su diálogo como hijo de `document.body`, fuera del lienzo escalado.

## Contrato de continuidad

La primera entrada en cada almacenamiento de navegador o app necesita internet.
El recibo local de acceso guarda únicamente identidad pública
`{id,nombre,correo}` y entorno. No es un token ni autoriza solicitudes al servidor.
No contiene cookies, códigos ni una respuesta cacheada de `/api/cuenta/sesion`.
Reabrir offline exige que recibo, vínculo y base local coincidan.

La API continúa autenticando con su cookie privada y permanece fuera de la
caché PWA. Una caducidad o revocación confirmada requiere nuevo acceso; un
fallo de red conserva el avance. El cambio de cuenta preserva las copias de
su propietario y no incorpora automáticamente el progreso de otro jugador.

Los snapshots mantienen campaña, miniatura, sellos, colección, sobres, recibos,
récords y nombre. La cola se guarda antes de tocar la red y conserva operación
y contenido al repetir un envío. Resolver un conflicto elige una copia completa,
sin sumar cartas ni contadores y sin volver a sortear sobres. No reanuda un
combate a mitad de turno. Los deseos continúan fuera del guardado remoto.
El esquema real y sus límites están en `dev/cuentas/README.md`.

## Comprobación y publicación de la sección

Desde la raíz, comprobar únicamente el alcance afectado:

```sh
node dev/secciones/pruebas_cuenta_modelo.mjs
node dev/secciones/pruebas_cuenta_acceso.mjs
node dev/secciones/pruebas_cuenta_entradas.mjs --sabotaje
node dev/secciones/pruebas_cuenta_exportacion.mjs
node dev/secciones/pruebas_cuenta_ui.mjs --capturas /tmp/caoz-cuenta-revision
node caoz_tcg/pruebas_cuenta_progreso.mjs
node caoz_tcg/pruebas_cuenta_servicio.mjs
node dev/cuentas/pruebas_cache.mjs
```

El recorrido UI comprueba escritorio, 390×844 y 320×568: código y vínculo,
entrada bloqueada, conflicto, victoria, cola offline, recarga y reconexión,
foco, geometría y ausencia de accesos al progreso/red reales. Acepta
`PLAYWRIGHT_MODULE` y `BASE_URL`; el modo `--sabotaje` conserva la regresión
de navegación entre pestañas. Las pruebas de entradas extraen las guardias
reales sin iniciar una partida ni el motor.

El servidor de secciones ofrece
`http://127.0.0.1:8878/dev/secciones/cuenta.html`. Para revisión desde teléfono,
usar el publicador existente desde una fuente limpia y guardada en Git:

```sh
python3 dev/secciones/publicar.py --seccion cuenta --publicar --salida /tmp/caoz-cuenta-publicacion
python3 dev/secciones/publicar.py --seccion cuenta --verificar https://aislados.caoz-tcg.pages.dev --salida /tmp/caoz-cuenta-publicacion
```

La carpeta debe ser nueva o vacía, fuera de los checkouts. Sólo cambia
`cuenta/` en `aislados`; conserva las otras secciones y las ramas publicadas
del juego. El laboratorio no sustituye la validación completa que corresponderá
después de que el usuario apruebe la integración a beta.

---

<details>
<summary>Registro histórico: primera propuesta de cuentas, aprobada e integrada en 257</summary>

Lo que sigue conserva la propuesta inicial y sus limitaciones de entonces.
Las referencias a build 254/255, invitado y backend pendiente son históricas;
la configuración y el flujo vigentes se describen arriba y en HANDOFF.

El usuario eligió **correo y código de acceso**. Esta primera revisión se
desarrolla en `feature/cuentas-jugadores`, desde `develop` / build 254.
Sigue el flujo acordado: sección aislada → revisión → integración en beta →
producción autorizada. No cambia las pantallas, el almacenamiento ni el servicio
de producción. No se ejecuta todavía la batería completa del juego.

## Lo que se puede probar

`https://aislados.caoz-tcg.pages.dev/cuenta/` presenta el registro con nombre y
correo, acceso por seis números, reenvío, caducidad, errores de conexión,
vinculación del avance del dispositivo, elección entre dos progresos, perfil,
salida e invitado. El buzón de prueba muestra el código y permite copiarlo al
campo sin confirmar automáticamente. Cada recarga reinicia la demostración.

El banner permanece visible: **sin correos ni progreso reales**. El servicio
es exclusivamente de memoria: no crea usuarios reales, no envía correo,
no consulta almacenamiento del jugador ni hace peticiones a una API. El perfil
guardado y los respaldos sólo existen durante esa visita. Los textos dentro
del componente representan el comportamiento previsto para la integración.

Escenarios: `?estado=nuevo` vincula un avance local; `vacio` crea una cuenta
sin progreso; `entrar` recupera una cuenta de ejemplo; `conflicto` compara dos
avances diferentes. «Escenarios» permite cambiarlos y simular falta de conexión.

## Componentes y contrato

- `caoz_tcg/cuenta-modelo.js`: estados, validación, operaciones pendientes,
  errores, vinculación y elección de progreso. No depende de DOM ni transporte.
- `caoz_tcg/cuenta-ui.js` y `cuenta.css`: interfaz compartida móvil/escritorio,
  preparada para montarse como un componente sin copiar sus vistas al juego.
- `dev/secciones/cuenta-demo.js`: servicio inyectado de memoria. Nunca se debe
  incluir en el paquete del juego ni reutilizar como autenticación del servidor.
- `cuenta-lab.js`, `cuenta-lab.css`, `cuenta.html`: controles y datos temporales.
- `cuenta-exportar.mjs`: lista cerrada de diez archivos, procedencia y hashes;
  conserva la política CSP común de las otras secciones.

`CAOZ_CUENTA_MODELO.crear({servicio,progresoLocal,reloj,resumir})` conserva el
payload completo de progreso en privado. `ver()` y `suscribir()` entregan copias
de un resumen para la interfaz; no recortan el payload que se guarda. Al integrar,
`resumir` deberá proyectar los contadores del snapshot real. El servicio expone:

| Operación | Resultado |
|---|---|
| `solicitarCodigo({correo,nombre,intencion})` | `{id,vence,reenvioEn}`; nunca el código en la API real. |
| `verificarCodigo({solicitud,codigo})` | `{sesion,progreso,revision}`; sesión establecida por el servidor. |
| `vincularProgreso({origen,operacion,revision,progreso,respaldoLocal})` | Snapshot completo y revisión confirmada. |
| `cerrarSesion()` | Revocación confirmada antes de limpiar el estado de cuenta. |

La demostración caduca códigos a los cinco minutos, permite reenvío tras
sesenta segundos y limita a cinco intentos. Reenviar invalida el anterior;
verificarlo lo consume una sola vez. El servidor real tendrá que imponer todas
esas condiciones: las guardas del navegador no proporcionan seguridad.

La vinculación usa un identificador único por operación. Si la respuesta se
pierde después de guardar, reintentar conserva ese identificador. Una revisión
desactualizada devuelve conflicto y conserva ambos avances. Nunca se suman
inventarios ni se toma el máximo de cada contador. Antes de sustituir el avance
en la cuenta por el del dispositivo, la interfaz pide confirmar la elección.

## Integración posterior: conservar el progreso completo

El guardado actual está separado en varios sitios. El adaptador futuro debe
capturarlos juntos y mantener una copia antes de vincularlos:

| Dato actual | Qué debe conservar |
|---|---|
| `caoz.campana.v1` | ID de campaña, protagonista, etapa, personaje, encuentro, victoria pendiente, Editor, deseo y recompensas pendientes. |
| `caoz.campana.v1.creador` | Borrador de miniatura y mazo; regenerar el retrato desde sus parámetros. |
| `caoz.campana.logros.v1` | Sellos por mazo y ganador, conservando los nombres históricos. |
| `caoz.coleccion.v1.<entorno>.<ruta>` | Desbloqueos, copias, acabado elegido, sobres por tipo, premios por elegir, contenido exacto de apertura pendiente y recibos. |
| Clave de colección + `.domo-pendientes` | Cola de premios pendientes de persistir. |
| `caoz_records_v1` | Récords existentes; no inventar eventos que nunca se registraron. |
| `caoz_nombre` | Nombre online; sus límites actuales difieren del nombre del personaje y de la cuenta. |

La raíz y `/movil.html` generan actualmente el sufijo `raiz`, mientras que la
ruta limpia `/movil` puede generar `movil`. La migración debe revisar las claves
conocidas del mismo origen. Otro dominio, navegador, PWA o teléfono no comparte
su almacenamiento: no se puede prometer recuperarlo antes de vincularlo desde
ese lugar. No importar fixtures, progreso beta, credenciales de estudios,
cachés, preferencias de audio ni permisos de instalación.

Precauciones del inventario:

- Las cartas de un sobre pendiente de mostrar ya están concedidas: conservar
  exactamente esas cinco cartas, sin sortear ni premiar de nuevo.
- `sobres()` incluye sellados y elecciones pendientes; no sumarlos dos veces.
- La Normal inicial implícita no es material consumible de canje; un acabado
  desbloqueado puede tener cero copias después de gastarlas.
- Capturar campaña, colección y recibos juntos impide repetir un premio al
  restaurar un final de campaña. Los identificadores nuevos deben ser únicos
  entre dispositivos, no contadores locales aislados.
- No fusionar con máximos: cinco Foil en un dispositivo y una Dorada fabricada
  con esas mismas Foil en otro no representan seis cartas disponibles.
- No borrar el avance local antes del acuse del servidor ni volver a importarlo
  automáticamente en una segunda cuenta después de cerrar sesión.

El formato sugerido es `{saveId,revision,updatedAt,deviceId,snapshotHash,snapshot}`,
con `updatedAt` del servidor. El snapshot reúne perfil, campaña, borrador,
sellos, colección, recibos y récords. Esto no incluye reanudar una partida a
mitad de turno. La primera integración debe resolver guardado/restauración de
progreso, sin prometer persistencia del estado de combate completo.

## Backend real pendiente

El Worker actual sólo autentica administradores de estudios con una clave
compartida y la cookie `__Host-caoz-sfx`; su enlace D1 es `SFX_DB`. No existe
identidad individual de jugadores ni proveedor de correo configurado en el
código inspeccionado. No reutilizar esa clave, cookie ni tablas de contenidos.

Propuesta: módulo `/api/cuenta/*`, base de jugadores independiente por entorno,
usuarios, desafíos de acceso, sesiones revocables, snapshots versionados,
respaldos y recibos de importación. La sesión opaca del jugador se enviará en
cookie `__Host-caoz-jugador`, `HttpOnly`, `Secure`, `SameSite`, con expiración;
el servidor deriva el usuario de la sesión, nunca de un ID elegido por el cliente.

Requisitos antes de conectar datos reales:

- Generación criptográfica del código en servidor, hash con secreto separado,
  caducidad, consumo atómico, límite de intentos y de envíos por correo/IP,
  respuestas que no revelen si una cuenta existe y protección frente a abuso.
- Validar `Origin`/CSRF, tamaño y esquema de payloads; mantener los tokens fuera
  de URLs y del almacenamiento accesible a JavaScript. Revocar sesiones al salir.
- Transacción de snapshot, respaldo y recibo de operación. Vincular idempotencia
  al usuario, entorno y hash de la solicitud; un ID repetido con otro payload
  debe rechazarse. Escritura condicionada por revisión, sin último escritor ciego.
- Actualizar `_routes.json` y excluir `/api/cuenta/*` de `sw.js`: la estrategia
  GET actual podría cachear la API. Responder `Cache-Control: no-store` y comprobar
  PWA, desconexión, dos dispositivos y actualización de una versión anterior.
- Elegir y configurar correo transaccional con dominio verificado y secretos en
  el servidor. No subir claves a Git ni asumir que tener Pages verifica el correo.
- Incorporar operaciones de inventario autorizadas por servidor para futuras
  recompensas, aperturas y canjes. Sin ello, guardar un JSON del cliente no impide
  manipular cartas ni valida por sí solo una victoria real.

Para uso offline se propone guardar avances de campaña y enviar los cambios
al reconectar. Aperturas y canjes deberían confirmar el gasto online; una
apertura ya confirmada puede terminar de mostrarse offline. Es una decisión
de integración pendiente, no una capacidad implementada en esta vista.

Cloudflare documenta su [servicio de correo](https://developers.cloudflare.com/email-service/)
y la [configuración de dominios](https://developers.cloudflare.com/email-service/configuration/domains/).
La elección de proveedor y el remitente siguen pendientes; esta revisión no
provisiona servicios, cambia DNS ni envía mensajes. Las verificaciones de
autenticación seguirán la [guía de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html).

## Validación y publicación acotadas

```sh
node dev/secciones/pruebas_cuenta_modelo.mjs
node dev/secciones/pruebas_cuenta_exportacion.mjs
node dev/secciones/pruebas_cuenta_ui.mjs --sabotaje
node dev/secciones/servidor.mjs
```

Local: `http://127.0.0.1:8878/dev/secciones/cuenta.html`. El publicador existente
ejecuta ambas pruebas antes de preparar el paquete. Desde una fuente limpia y
guardada en Git:

```sh
python3 dev/secciones/publicar.py --seccion cuenta --publicar --salida /tmp/caoz-cuenta-publicacion
python3 dev/secciones/publicar.py --seccion cuenta --verificar https://aislados.caoz-tcg.pages.dev --salida /tmp/caoz-cuenta-publicacion
```

La carpeta de salida debe ser nueva o vacía y estar fuera de los checkouts.
`pruebas_cuenta_ui.mjs` acepta `BASE_URL` para comprobar la sección pública y
`PLAYWRIGHT_MODULE` para indicar una instalación de Playwright. Comprueba en
navegador 1420×900, 390×844 y 320×568: registro, acceso,
invitado, códigos, conexión, vinculación, conflictos, foco y geometría, sin
accesos al almacenamiento real. El sabotaje local confirma que retirar la
restauración de foco vuelve a romper las flechas de las pestañas. La publicación
añade sólo `cuenta/` a la rama
`aislados`, preservando los árboles de Colección, El Rey y Sobres.

Publicación de esta propuesta: fuente `ab30e3e1513ba78577c43c8f69145dbe2e3b9a89`,
artefacto `4821e928e4c1aa3b137b4ffd499b038921af521b`. Diez archivos públicos
verificados byte a byte. Las otras tres secciones, sus cabeceras compartidas y
las referencias de las ramas del juego se conservaron.
La página pública pasó los51 casos de interfaz (17 por tamaño), sin excepciones,
peticiones fallidas ni accesos al progreso real. La propuesta seguía pendiente de
revisión del usuario antes de integrar correo y guardado reales en ese momento.

</details>
