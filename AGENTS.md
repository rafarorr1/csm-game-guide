# Caoz Con Todo — repositorio del juego

El juego vive en **`caoz_tcg/`**. Leer `caoz_tcg/AGENTS.md` y `caoz_tcg/HANDOFF.md`
antes de modificarlo. **`dev/`** contiene herramientas y vistas aisladas de desarrollo;
no se publica con el juego. El resto de proyectos excluidos por `.gitignore` sigue fuera
del respaldo.

## Flujo vigente — 2026-09-11

- `main`: código de la última versión autorizada para producción.
- `develop`: cambios aprobados que se integran y validan para beta.
- `feature/*`, `fix/*`, `chore/*`: una tarea acotada, preferentemente en su propio worktree.
- Crear trabajos desde `origin/develop` con `python3 dev/nueva_rama.py nombre-del-cambio`.
- Para una sección: vista aislada → revisión del usuario → integración y pruebas → beta.
  Producción requiere autorización para la versión. No repetir aprobaciones ya recibidas.
- `gh-pages`, `beta` y `aislados` contienen archivos publicados; nunca desarrollar allí.
- Las revisiones de secciones se publican desde GitHub a Cloudflare en la rama `aislados`.
  Entregar su URL pública, sin enlaces ChatGPT/Sites ni login; 127.0.0.1 es sólo local.
- La antigua `feature/aaa-combat-cards` queda conservada como historial, no como rama general.

Comandos, transición inicial y pruebas en **`dev/README.md`**. No copiar el juego completo
para construir un prototipo: usar componentes reales y dependencias mínimas, con datos
separados del progreso del jugador. Modularizar de forma gradual al trabajar cada sección.
