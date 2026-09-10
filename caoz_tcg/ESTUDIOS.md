# Biblioteca única de cartas y sonidos · build235

## Uso

Los dos paneles viven en el dominio oficial: `/estudio` para cartas y `/sonidos`
para audio. Comparten la clave existente de producción y su sesión privada.
Los enlaces anteriores de beta redirigen a esos paneles.

1. Editar y **Guardar en el estudio** conserva un borrador en la nube.
2. **Publicar en beta** muestra la lista de cambios pendientes y los envía a beta.
3. **Publicar en producción** permite enviar los cambios guardados al juego oficial.

Cada botón publica sólo el tipo de biblioteca del panel. Las cartas conservan
sus tres acabados y encuadres; los sonidos incluyen archivo y volumen. Los botones
indican si hay cambios pendientes o si el destino está al día. Un archivo en vista
previa aún sin guardar no puede publicarse. Restaurar un original o retirar un
acabado cambia el borrador; también requiere publicar para llegar al juego.

## Almacenamiento y acceso

Producción conserva `SFX_DB` (su base actual). Los borradores usan las mismas
estructuras, en tablas con sufijo `_estudio`; nunca son el catálogo vivo.
La inicialización transaccional copia una sola vez los reemplazos existentes de
producción a las tablas privadas. No sobreescribe ediciones en accesos posteriores.
Antes de activar, comprobar que no haya diseños exclusivos de beta pendientes de
recuperar; los datos beta nunca se borran por inicializar el estudio.

Se necesita el binding **SFX_BETA_DB** sólo en Production, apuntando a la base
existente `caoz-sonidos-beta`. Preview conserva únicamente su propio `SFX_DB`.
Configurar **ESTUDIO_UNICO=1** en Production y Preview: cierra las antiguas rutas
que escribían directamente en los juegos y activa las redirecciones de los paneles.
No cambiar ni copiar `SFX_ADMIN_HASH` ni `SFX_SESSION_KEY` entre entornos.
La conexión y variables entran en vigor en el siguiente despliegue oficial.

Las rutas `/api/estudio/arte/*` y `/api/estudio/sfx/*` requieren autenticación de
producción incluso para leer imágenes o reproducir borradores. Devuelven `no-store`
y quedan fuera del service worker. La sesión sigue en `/api/sfx/sesion`.
Las APIs públicas del juego conservan su contrato y su propia base por entorno.

## Publicación

`GET /api/estudio/{arte|sfx}/estado` devuelve pendientes, IDs y una huella por
destino. `POST /api/estudio/{arte|sfx}/publicar/{beta|produccion}` exige esa huella
en `If-Match`. Si la biblioteca o el destino cambió, responde409 para revisar.

Los archivos se copian en tandas de hasta seis por petición. Mientras responde
`preparando:true`, el cliente repite la misma petición. Los catálogos vivos sólo
cambian cuando están todos los archivos: una transacción actualiza los registros,
la revisión de publicación y su fecha. Un fallo revierte todos los metadatos;
los archivos ya preparados permiten reintentar. Una guardia transaccional rechaza
la segunda publicación concurrente. Se conserva la referencia al archivo anterior.

La comparación de pendientes ignora nombres de archivo y números de revisión
cuando el contenido visible ya coincide. No borra registros beta ajenos a la
biblioteca. Para una carta existente en la biblioteca, publicar su estado incluye
retirar acabados que ya se hayan quitado de ese borrador.

## Validación y despliegue

`node pruebas_estudio.mjs` prueba el worker real con dos SQLite aislados: migración,
privacidad, borradores, dos destinos, herencia de acabados, restauración, volúmenes,
concurrencia, interrupciones, preparación por tandas y transacciones.
Sabotajes de destino, autenticación y guardia deben poner las pruebas en rojo.
Las suites anteriores de ilustraciones y audio también se mantienen.

`publicar.sh` incluye estas pruebas y los archivos compartidos
`estudio-publicacion.js/css`. La publicación conserva los juegos y sus originales.
Primero publicar el build en el dominio central de producción; después actualizar
beta al mismo build, para que sus redirecciones encuentren la interfaz nueva.
No hacer merge ni push a main. El estado de activación pendiente queda en HANDOFF.
