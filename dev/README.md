# Desarrollo por secciones

## Ramas y destinos

| Rama | Función | Publica por sí sola |
|---|---|---|
| `main` | Fuente de la versión aprobada para producción | No |
| `develop` | Fuente integrada y validada para beta | No |
| `feature/*`, `fix/*`, `chore/*` | Un cambio acotado por rama/worktree | No |
| `gh-pages` | Paquete de producción en `tcg/` y espejo beta en `tcg-beta/` | GitHub Pages y Cloudflare producción |
| `beta` | Copia de `tcg-beta/` como `tcg/`, para Cloudflare Preview | Cloudflare beta |

Cloudflare: producción desde `gh-pages`, salida `tcg`; previews automáticos sólo
para la rama `beta`. No cambiar la fuente Cloudflare a `main` o `develop`.
GitHub Pages continúa desde `gh-pages:/`. Las bases de datos y los estudios no cambian.

## Punto de partida de la migración

Autorizada por Rafa el 2026-09-11. Producción permanece en build245, fuente
`560357d5bb56098e6ef9e7eecac57c92709bc324`; beta permanece en249, fuente
`1bb635216bda9f002fe205c6ddf48da5c68204f6`. `main` avanza hasta245 sin reescribir
historia. `develop` parte de249 y recibe sólo esta estructura, herramientas y guías.
Se guardan etiquetas `build-245` y `build-249` sobre esas fuentes publicadas.
La rama antigua `feature/aaa-combat-cards` queda conservada; no iniciar trabajo allí.

`main` conserva exactamente la fuente245, incluido el publicador antiguo. No usar
ese script histórico para nuevas entregas. La primera promoción autorizada desde
`develop` incorporará las guardas actuales con su inventario correcto. No copiar
el publicador249 aislado sobre245: incluye módulos que esa versión no tiene.

## 1. Crear un trabajo

Desde una copia actualizada de `develop`, en la raíz:

```sh
python3 dev/nueva_rama.py ajustar-coleccion
python3 dev/nueva_rama.py corregir-encuadre --tipo fix
```

Crea `feature/ajustar-coleccion` (o `fix/corregir-encuadre`) y una carpeta hermana
bajo `csm-game-guide-trabajos/`, siempre desde `origin/develop`. No cambia la rama
actual ni arrastra cambios locales. Rechaza nombres/carpetas ya existentes y
carpetas dentro de cualquier checkout registrado. No hace push ni publica.
`--solo-ver` muestra el destino sin crearlo. `--sin-actualizar` permite trabajar
sin red usando la referencia local conocida de `origin/develop`.

## 2. Revisar sólo la sección

Abrir la nueva carpeta y ejecutar:

```sh
node dev/secciones/servidor.mjs
```

Primera sección disponible: [Colección aislada por internet](https://caoz-coleccion-aislada.cuddly-bowl-3242.chatgpt.site/).
El enlace local 127.0.0.1 sólo funciona en el ordenador; para el teléfono entregar
la copia alojada y conservar su acceso privado.
Usa sus componentes, estilos y datos reales; no carga una partida ni escribe el
progreso del jugador. Tiene escenarios de sobres/acabados y vista móvil/escritorio.
Ver [sus límites y controles](secciones/README.md). Para otra sección, añadir una
entrada con dependencias mínimas, no un iframe del juego completo.

Cambiar el componente real en la rama temporal, hacer las comprobaciones acotadas
pertinentes y presentar el enlace. Esperar la aprobación de esa sección antes de
integrar o ejecutar la batería completa del juego. No duplicar la interfaz para
fabricar una maqueta que luego haya que rehacer.

## 3. Integrar y publicar beta

Tras la aprobación de la sección, abrir un PR hacia `develop`. Su descripción debe
incluir lo que cambia, el acceso revisado y las comprobaciones pertinentes. Resolver
conflictos e incorporar la base reciente en la rama de trabajo. Entonces ejecutar
las validaciones completas de integración:

```sh
cd caoz_tcg
./publicar.sh --solo-pruebas --completo
```

Si cambian archivos publicables, preparar una build nueva con los números de ambos
HTML, referencias de scripts y `sw.js` sincronizados; registrar el cambio. Los commits
de documentación/herramientas y los merges no consumen build. No modificar una build
ya publicada: el verificador compara los bytes del paquete con su destino.

Integrar el PR aprobado en `develop`, actualizar el checkout de esa rama y publicar:

```sh
./publicar.sh --beta --completo
```

Usar `--visible` si hace falta validar Chrome visible. El publicador vuelve a validar
la integración, exige árbol del juego limpio y el mismo commit antes de copiar, y
comprueba lo servido en GitHub/Cloudflare. Conservar el enlace directo y la build
verificados para revisión. No mover `main` como efecto secundario de una beta.

## 4. Promover la versión autorizada

Sólo después de la autorización de producción para esa beta: promover exactamente
el commit revisado a `main` mediante un PR de release. Si `develop` avanzó, crear la
rama de release desde el commit aprobado, no incluir cambios posteriores. Registrar
la build y el SHA en el PR. Actualizar el checkout de `main` y ejecutar:

```sh
cd caoz_tcg
./publicar.sh --produccion --completo
```

Verificar la versión servida en web y móvil. La promoción no requiere incrementar
la build si publica exactamente los bytes aprobados en beta. Las etiquetas de build
son inmutables; no moverlas. Un push de código a `main` no cambia la web por sí mismo.

No fusionar ni publicar automáticamente una versión que no ha sido autorizada.
No repetir una aprobación ya recibida para ese paso y versión.

## 5. Cerrar una tarea

Con el PR integrado, conservar la referencia de revisión y cerrar su servidor local.
Retirar el worktree y la rama temporal sólo después de comprobar que no hay cambios
sin guardar y que todos sus commits están integrados. No limpiar archivos ajenos ni
usar borrados forzados. La herramienta de creación no hace esta limpieza sola.

## Comprobaciones del flujo

```sh
python3 dev/pruebas_nueva_rama.py
node dev/secciones/pruebas.mjs
python3 caoz_tcg/pruebas_publicacion.py
```

Usan datos/repositorios temporales; no publican en la web. Incluyen aislamiento de
checkouts y almacenamiento, ramas/destinos, cambios durante validación y versiones
inmutables. Para un cambio sólo en estas herramientas, bastan estas comprobaciones:
no hace falta arrancar todo el juego ni generar una nueva beta.

La modularización continuará sección por sección: lógica/datos, interfaz y conexión
con el juego, siguiendo el ejemplo de la Colección. Conservar los scripts clásicos;
no migrar a otro framework ni reescribir el motor para adoptar este flujo.
