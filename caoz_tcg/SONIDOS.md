# El sonido del Domo

**Build 235:** el flujo vigente está en [ESTUDIOS.md](ESTUDIOS.md): estudio
único, guardado privado y botones separados para beta y producción. Los detalles
históricos de guardado directo por entorno que siguen corresponden a234.

Propuesta 01, build 212. Banco original de 37 efectos de fantasía: materiales
cercanos, preparación antes del impacto y espacio para que se entienda cada acción.
Los WAV se crearon para el proyecto mediante síntesis de resonadores, fricción,
percusión, cuerdas y reflexiones de sala. No son grabaciones extraídas de Baldur's Gate.

## Escuchar y cambiar

Abrir `sonidos.html` (también desde **Estudio de ilustraciones → Estudio de sonidos**).
El panel comparte la clave y la sesión con el estudio de ilustraciones del
mismo entorno. Esa clave la verifica el servidor; el antiguo control cliente
del editor de cartas fue retirado. La sesión dura ocho horas y se puede cerrar.

Cada entrada permite escuchar el efecto, abrir su archivo directamente y ajustar
su volumen. **Reemplazar sonido** admite los formatos que decodifique el navegador
(WAV y MP3 recomendados), hasta 8 MB y 12 segundos. Convierte a WAV mono/32 kHz/16 bits,
limita picos y suaviza los bordes. **Escuchar prueba** no publica nada;
**Guardar reemplazo** lo pone a disposición de los jugadores del entorno indicado.
Las partidas abiertas consultan cambios al regresar a la pestaña y cada minuto.

**Restaurar original** recupera el WAV y volumen del banco original. Los cambios
guardados están en D1 y sobreviven a nuevas publicaciones. Se conserva además el
archivo reemplazado inmediatamente anterior; los demás huérfanos se retiran
después de 24 horas. El panel avisa si otra sesión guardó antes, sin sobrescribirla.

## Activación en Cloudflare Pages

El despliegue del juego sigue siendo `./publicar.sh --beta`. `_worker.js` y
`_routes.json` viajan en esa publicación; `/api/sfx/*` y `/api/arte/*` ejecutan el backend.
Los archivos del juego conservan su alojamiento estático. No se despliega código
por un procedimiento alternativo.

Antes de activar el panel, crear una base D1 dedicada (por ejemplo
`caoz-sonidos-beta`) y vincularla como **SFX_DB** al entorno **Preview** del proyecto
`caoz-tcg`. Añadir estos dos secretos exclusivamente a ese entorno:

- **SFX_ADMIN_HASH**: SHA-256 hexadecimal de una clave aleatoria de al menos 24 bytes.
- **SFX_SESSION_KEY**: otra clave aleatoria independiente, de al menos 32 bytes.

El servidor crea las tablas `sonidos`, `audios` y `accesos` cuando recibe su primera
consulta. Las escrituras requieren cookie firmada `Secure; HttpOnly; SameSite=Strict`,
el mismo origen, un ID del catálogo y la revisión vigente. El login admite ocho
intentos por dirección cada 15 minutos. Sólo guarda una huella de la dirección;
los accesos vencidos se limpian al iniciar sesión correctamente.

Para producción crear **otra base** y **otras claves** y configurar **Production**;
no reutilizar la base beta. Publicar a producción requiere la autorización habitual.
No añadir secretos a HTML, JS, documentos ni commits. Cambiar `SFX_SESSION_KEY`
invalida todas las sesiones; cambiar `SFX_ADMIN_HASH` cambia la clave de entrada.

Mientras falten las vinculaciones, la API devuelve 503 y el estudio informa que
falta conectarlo. El juego sigue usando sus sonidos originales. GitHub Pages y
un servidor estático local sólo reproducen originales, porque no ejecutan D1.

## Mapa de integración

| Familia | Momento |
|---|---|
| Interfaz | Hover, confirmar, volver y barrido dorado |
| Cartas | Robo, entrada de unidad y objeto |
| Combate | Salida, impacto, contraataque y golpe letal |
| Magia | Hechizo según familia, curación, buff y habilidad |
| Rituales | Dado en movimiento/resultado, moneda, VS y cambio de turno |
| Campaña | Apoyos de la miniatura, impacto de derribo y apertura de niebla |
| Finales | Victoria, derrota, ascensión, fuego y deseo concedido |

El contacto de cartas lo dirige `polish-aaa.js`; la cinemática, volado y menús
están en `final-core.js`; los movimientos y deseo, en sus módulos de campaña.
`audio-domo.js` enlaza los otros hooks de pantalla, conservando su resultado y
promesa. Los eventos online usan esas mismas funciones; nunca se envía el sonido
por los relevos ni se toca `motor.js`.

El mezclador desbloquea Web Audio al tocar o usar el teclado, reintenta tras
suspensión, impide más de ocho voces y corta las fuentes al ocultar la página.
Los eventos descargados con más de 180 ms de retraso se omiten para evitar golpes
tardíos. Si un reemplazo falla, intenta el original. `fast`, `silent` y `auto`
permanecen silenciosos. El silencio y volumen maestro se guardan por dispositivo.

El SW precarga los originales como assets opcionales. Las rutas privadas y de
sesión nunca pasan por la caché. Los WAV remotos se identifican por SHA-256; una
edición genera otra URL, por lo que no reutiliza la copia anterior.

## Validación y autoría

`python3 verificar_sonidos.py` valida WAV, duración, hashes, bordes y margen de
mezcla. `node pruebas_sonidos.mjs` usa SQLite en memoria (Node 22.13 o posterior)
para probar el backend real sin servicios externos. `?test=sonidos` comprueba el
mezclador y las familias, y forma parte de las guardas habituales. La publicación
compara también los 37 archivos de audio byte a byte.

`herramientas/crear_sfx.py` reproduce el banco con una semilla fija. Esta herramienta
de autoría necesita NumPy; no se carga ni se publica como dependencia del juego.
Los WAV ya generados no requieren Python ni ninguna librería para reproducirse.


Build 211 añade leader_hit (reacción al perder Alma), card_hover (hover o toque
sobre cartas de la mano) y victory_slam (220 ms después de comenzar la caída del
sello; inmediato con movimiento reducido). El motivo victory sigue al inicio
como fanfarria independiente. Saltar o cerrar el final cancela el impacto pendiente.
Los tres IDs se admiten en el estudio privado y el backend; los reemplazos
existentes se conservan. Suite sonidosMomentos cubre ambos clientes y silencio.


Build 212: card_hover conserva un único archivo. El mezclador elige entre siete
alturas de −1 a +1 semitonos sin repetición consecutiva, aplica ±10% de volumen
sobre una intensidad entre .82 y 1 según la velocidad reciente del mouse, y
usa .883 en toque/teclado. El volumen del estudio sigue siendo la referencia,
con ganancia final limitada a 1 y el volumen maestro aplicado después.
No se modifica el archivo ni se simulan grabaciones distintas. La reproducción
sin variación conserva pitch y volumen base. Los sonidos de Finales no cambian.

El estudio de ilustraciones comparte la sesión y la base con tablas separadas.
Ver `ILUSTRACIONES.md` para imágenes, encuadres y recuperación de borradores.
