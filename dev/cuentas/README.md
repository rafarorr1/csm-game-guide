# Cuentas por correo y guardado de jugadores

La propuesta aislada de cuentas fue aprobada por el usuario, quien autorizó
integrarla y publicarla en producción. Esta carpeta contiene la migración y
pruebas del servidor. La demostración de `dev/secciones/cuenta-demo.js` sigue
separada: **nunca se publica como autenticación del juego**.

## Estado de la conexión — 2026-09-13

**La beta 256 está publicada.** El [PR 15](https://github.com/rafarorr1/csm-game-guide/pull/15)
se integró en `develop:a00f251`; el publicador terminó con código de salida 0 y
83 suites completas verdes. Artefactos: `gh-pages:e35a1f5` y `beta:de14d24`, con
bytes verificados en GitHub y Cloudflare. `main` y producción siguen en build 254.
La autorización del usuario para completar la publicación en producción permanece
vigente. El PR 13 documental es independiente.

En la interfaz real de beta 256, Extras → Mi cuenta abre Crear cuenta para un
visitante nuevo sin el aviso falso de sesión vencida. Las sesiones conocidas o
con vínculo previo siguen avisando si caducan y conservan sus datos. También se
incluyen la normalización de espacios exteriores de clave y remitente y la
identificación User-Agent requerida por Resend, ambas con validación de transporte.

El usuario creó una nueva clave de Resend con **Sending access limitado al
dominio `cuentas.caozcontodo.com`** y la guardó cifrada como `CUENTAS_RESEND_KEY`
en Preview y Production. También limitó la clave anterior. No queda pendiente
volver a pegar la clave ni aprobar la reducción de sus permisos. `CUENTAS_SECRET`
permanece intacto. No registrar valores secretos o destinatarios de prueba.

Se reintentó con éxito `beta:de14d24`, build 256, en el despliegue Cloudflare
`96460b15`, para recoger la nueva configuración. La consulta anónima de sesión
mantiene el `401` esperado. La nueva solicitud real de código sigue respondiendo
**`503 NO_DISPONIBLE`**, aunque ahora D1 registra **1 desafío, 0 entregados y
1 no entregado**; Resend muestra 0 solicitudes. No se ha confirmado recepción
de correo, acceso ni guardado real del progreso.

El fallo se reprodujo en **workerd 2026-09-11**, con compatibilidad **2026-09-05**:
`redirect: 'error'` no está soportado y lanza antes de acceder a la red. La rama
`fix/correo-workers` prepara **build 257**, todavía sin publicar, usando
`redirect: 'manual'` y rechazando toda respuesta con `ok` falso, incluidas las
redirecciones. Así se evita seguir otra dirección o reenviarle credenciales.
Falta completar la validación, publicar 257 en beta y comprobar la solicitud,
recepción y uso de un código real y el guardado del progreso antes de completar
la publicación autorizada a producción. **Beta continúa en 256 y producción
en 254.**

Las bases de jugadores son privadas y están separadas por entorno:

| Entorno | Identificador D1 | Estado verificado |
|---|---|---|
| Beta | `f1ce1e07-289d-483d-b881-4456adfefe91` | Seis tablas migradas; enlace `CUENTAS_DB` guardado en Pages Preview. |
| Producción | `abdce7af-3693-4707-a4f4-a3e14276183e` | Seis tablas migradas; enlace `CUENTAS_DB` guardado en Pages Production. |

Los registros DNS nuevos están guardados y comprobados. Resend mostró
`cuentas.caozcontodo.com`, identificador
`e7084484-caac-4bbb-89ba-c0cdeb3b39f2`, como **verified el 2026-09-13**.
Pages Preview y Production tienen `CUENTAS_ENTORNO`, el remitente del dominio
y **ambos secretos cifrados: `CUENTAS_RESEND_KEY` y `CUENTAS_SECRET`**. Su presencia
no acredita que el contenido guardado permita el envío.

### Antecedentes

El [PR 14](https://github.com/rafarorr1/csm-game-guide/pull/14) se integró en
`develop:a84f7a1`. La beta 255 pasó 83 suites y se publicó con artefactos
`gh-pages:32885f2` y `beta:68141f4`. Su primera solicitud real devolvió `503`, con
0 desafíos en ambas bases D1 y 0 solicitudes en Resend; la consulta anónima de
sesión devolvió `401` y verificar un UUID inexistente devolvió `400`, comprobando
el recorrido de HMAC y D1. El usuario había confirmado copiar la clave completa.
La referencia inicial `02a35b1` del PR 15 pasó 83 suites antes del ajuste User-Agent;
el publicador volvió a validar el código integrado y publicó una build nueva,
256, conservando la inmutabilidad de 255.

La comprobación inicial de beta 256, antes de renovar la clave, devolvió `503`
con recuento D1 0. La nueva clave y la limitación de permisos ya fueron guardadas
por el usuario; las antiguas solicitudes de pegado y aprobación están resueltas.
El fallo actual crea un desafío no entregado y corresponde al transporte de
Workers, según la reproducción descrita arriba.

Los registros históricos de preparación e infraestructura permanecen en
`../../caoz_tcg/HANDOFF.md`. Actualizar este estado después de cada comprobación
real; las pruebas con correo simulado no sustituyen la entrega a un destinatario
autorizado.

## Configuración privada del Worker

Cada entorno requiere su propia configuración:

| Variable o enlace | Uso |
|---|---|
| `CUENTAS_DB` | Enlace a la base D1 de jugadores de ese entorno. Aplicar `migracion.sql` antes de habilitar la API. |
| `CUENTAS_SECRET` | Secreto aleatorio de al menos 32 caracteres para HMAC de códigos, sesiones y límites. Guardarlo como secreto de Cloudflare. |
| `CUENTAS_ENTORNO` | Exactamente `beta` o `produccion`. También se comprueba en cada snapshot. |
| `CUENTAS_RESEND_KEY` | Clave privada de Resend con permiso de envío para el dominio correspondiente. Nunca va en HTML, almacenamiento del jugador ni Git. |
| `CUENTAS_REMITENTE` | Dirección de correo del remitente verificado, sin nombre ni corchetes. El módulo añade «Caoz Con Todo». |

El remitente debe estar verificado en Resend antes de habilitar cuentas para
jugadores. No basta con que el juego esté alojado en Cloudflare. Configurar sólo
los registros del subdominio de correo acordado, conservando los registros de
la web y del correo existentes. El registro del proveedor y la verificación DNS
son tareas de infraestructura; no se sustituyen por un código de demostración.

No reutilizar `SFX_DB`, la clave de los estudios ni `__Host-caoz-sfx`. Producción
y beta no comparten usuarios, sesiones ni progreso. `CUENTAS_SECRET` debe ser
distinto por entorno; rotarlo invalida las sesiones y códigos anteriores.

`cuenta-correo.js` llama únicamente a `https://api.resend.com/emails`, sin SDK.
Envía destinatario, asunto y texto con el código; no envía progreso, miniaturas,
deseos ni información del dispositivo. Un error, tiempo agotado o confirmación
inválida del proveedor produce un error opaco. Sin configuración, la API
responde `503 NO_DISPONIBLE`; no crea una sesión ficticia.

## API y contrato con el navegador

El Worker enruta `/api/cuenta/*` a `cuenta-servidor.js`. Todas las respuestas,
también los errores, llevan `Cache-Control: no-store, private`. El service worker
de la PWA debe excluir esta API por completo.

| Solicitud | Entrada | Resultado |
|---|---|---|
| `POST codigo` | `{correo,nombre,intencion}` | `{id,vence,reenvioEn}`. Nunca devuelve el código. |
| `POST verificar` | `{solicitud,codigo}` | `{sesion,progreso,revision}` y cookie de sesión. |
| `GET sesion` | Cookie | `{sesion,progreso,revision}` o `401 SESION`. No importa progreso en el dispositivo por sí sola. |
| `POST progreso` | `{origen,operacion,revision,progreso,respaldoLocal}` | `{progreso,revision}` confirmado o conflicto con la copia vigente. |
| `POST salir` | `{}` | Revoca esa sesión y elimina su cookie. |

`sesion` pública contiene sólo `{id,nombre,correo}`. La identidad autorizada se
obtiene de una cookie opaca de 256 bits: `__Host-caoz-jugador`, `Secure`,
`HttpOnly`, `SameSite=Lax`, `Path=/`, válida durante 30 días sin renovación
implícita. En D1 se guarda su HMAC, no el token utilizable del navegador.

Los POST exigen JSON y `Origin` igual al origen de la petición; se rechaza
`Sec-Fetch-Site: cross-site`. Además, **`progreso` y `salir` exigen la cabecera
`X-Caoz-Cuenta` con el ID de la sesión que el cliente cree estar utilizando**.
El servidor compara ese ID con el derivado de la cookie. La cabecera no
autentica: impide que un cambio de cuenta en otra pestaña haga subir la cola
anterior bajo la cookie nueva o cierre la cuenta equivocada.

Los códigos tienen seis dígitos criptográficamente aleatorios, caducan a los
cinco minutos y permiten cinco errores como máximo. Reenviar requiere 60
segundos e invalida el código anterior. Los límites de envío son tres solicitudes
por correo en 15 minutos y veinte por IP en una hora. Se aplican en transacciones
del servidor, incluidas solicitudes concurrentes. Verificar consume el código
y crea la sesión en una misma transacción. Reutilizarlo no crea otra sesión.

## Progreso completo, conflictos y respaldos

El formato es:

```json
{
  "formato": "caoz.progreso",
  "version": 1,
  "entorno": "produccion",
  "datos": {
    "campana": null,
    "borrador": null,
    "logros": null,
    "coleccion": null,
    "premiosDomo": null,
    "records": null,
    "nombre": ""
  }
}
```

Se conserva el JSON completo de los siete campos, incluidos los recibos de
premios, cantidades consumidas en canjes, sobres sellados y las cinco cartas
de una apertura ya sorteada. No se vuelven a sortear ni a conceder al restaurar.
No se suman snapshots ni se toma el máximo de cada contador. La cuenta conserva
el avance persistido; esto no implementa reanudar un combate a mitad de turno.

El servidor valida esquema, entorno, profundidad y tamaño: hasta 512 KiB por
snapshot y 1.1 MB por petición, que puede incluir también la copia de respaldo.
`campana.deseo` y `campana.borradorDeseo` se rechazan tanto en el progreso como
en el respaldo remoto. El cliente los omite al capturar sin alterar su original
local: el usuario había cancelado el registro de deseos.

Cada escritura lleva UUID de operación y revisión esperada. En una transacción
se conserva el respaldo, se actualiza sólo si coincide la revisión y se registra
el recibo de la operación. Los recibos guardan hash de solicitud y revisión,
sin duplicar el snapshot en cada autoguardado. Repetir la misma operación con
otro contenido se rechaza. Repetir un acuse perdido de la revisión vigente
devuelve la copia confirmada sin volver a escribir. Si hubo un guardado posterior,
devuelve `409 CONFLICTO` con la copia actual; nunca restaura una versión antigua.

El adaptador local conserva el progreso original y un diario durante la
importación. La cola del autoguardado debe escribirse antes de llamar a la red;
tras cerrar Safari o perder el acuse se repite el mismo UUID y contenido. Resolver
un conflicto exige escoger una copia completa. Cambiar o cerrar una cuenta debe
conservar el avance de su propietario y evitar volver a importarlo en otra.

## Información que se guarda y limpieza

| Tabla | Información |
|---|---|
| `cuenta_usuarios` | UUID, entorno, correo verificado, nombre y fecha de alta. |
| `cuenta_desafios` | Correo/nombre de la solicitud, HMAC de código, HMAC de correo/IP para límites, fechas, intentos y estado de consumo. No se guarda la IP en claro ni el código utilizable. |
| `cuenta_sesiones` | HMAC de sesión, propietario, entorno y fechas de creación/caducidad. |
| `cuenta_progreso` | Snapshot vigente, revisión y fecha de guardado. |
| `cuenta_respaldos` | Hasta diez pares de copia local/nube anteriores por usuario y entorno. |
| `cuenta_operaciones` | Hasta 256 recibos pequeños de idempotencia por usuario y entorno. |

Al solicitar un código se depuran los desafíos de más de 24 horas; al verificar
se eliminan sesiones caducadas. Es **limpieza oportunista al usar la API**, no
una tarea programada que prometa borrado a una hora exacta. La caducidad de
códigos y sesiones se comprueba aunque su fila todavía no se haya depurado.
Respaldos y recibos se acotan al guardar. La cuenta y su snapshot no tienen
caducidad automática. Esta entrega no añade todavía un endpoint de eliminación
de cuenta; borrar el progreso desde Extras y eliminar la cuenta son operaciones
distintas.

No se guardan contraseñas. El proveedor de correo recibe la dirección y el
código para efectuar el envío. Sus políticas de conservación son independientes
de estas tablas. No presentar este guardado como sistema antitrampa: todavía
recibe snapshots del cliente y **no valida victorias, sobres ni canjes con un
inventario autoritativo del servidor**.

## Validación y guardas de publicación

Desde la raíz del repositorio, con Node que incluya `node:sqlite`:

```sh
node dev/cuentas/pruebas_servidor.mjs --sabotaje
node caoz_tcg/pruebas_cuenta_correo.mjs
node caoz_tcg/pruebas_cuenta_progreso.mjs
node caoz_tcg/pruebas_cuenta_servicio.mjs
```

El servidor se prueba contra SQLite real mediante el contrato de D1, con correo
inyectado sólo en el proceso de pruebas. Incluye concurrencia de OTP y guardados,
límites, cookie, cambio de identidad entre pestañas, conflictos, recibos,
rollback ante fallo SQL, privacidad de deseos y almacenamiento acotado. Cinco
sabotajes retiran protecciones para comprobar que sus regresiones fallan.
Las pruebas de correo interceptan el transporte; no envían mensajes reales.

La regresión de Cloudflare se reproduce además con workerd oficial instalado
fuera del proyecto (comprobado con `2026-09-11`). No instala dependencias ni
permite tráfico externo: el proveedor y las redirecciones son Workers locales.

```sh
WORKERD_BIN=/ruta/al/binario/workerd node dev/cuentas/pruebas_correo_workerd.mjs --sabotaje
```

Sus nueve casos prueban el módulo de envío real con compatibilidad `2026-09-05`.
Rechaza 301/302/303/307/308 sin consultar el destino alternativo; los sabotajes
`error` y `follow` detectan, respectivamente, el envío roto y la redirección.

Antes de publicar deben pasar también las guardas completas del proyecto y
las pruebas de navegador móvil/escritorio, PWA y cambio entre cuentas. Verificar
el flujo real de código, guardado y restauración con un destinatario de prueba
autorizado después de configurar el proveedor. No publicar una API que devuelve
éxito sin correo real ni afirmar que el guardado está conectado porque el
prototipo de memoria funciona.
