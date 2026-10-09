# Bosque de Tomsage — dirección de arte

El tutorial usa una paleta húmeda y desaturada que prolonga la madera, la piedra y la forja de las casas de Caoz ARPG. El camino debe leerse con más claridad que el sotobosque; las ramas no pueden ocultar a Adreida ni los avisos de combate.

| Elemento real del bosque | Tratamiento |
| --- | --- |
| Pinos, ramas de conífera y agujas | Concepto de Scenario; geometría compartida artesanal y ramas del atlas, sin conos sólidos. |
| Robles, copas y ramas de hoja ancha | Roble 3D de Scenario/Trellis2 reducido de 95.842 a 5.900 triángulos; seis instancias cercanas. Árboles secundarios con ramas del atlas, sin bolas sólidas. |
| Troncos, ramas, raíces y madera caída | Corteza continua de Scenario sobre geometría compartida con silueta irregular. |
| Rocas, pared del hoyo y taludes rocosos | Material de roca erosionada con musgo de Scenario. |
| Helechos, matorrales y cobertura de emboscadas | Atlas de follaje de Scenario, recorte alfa y planos agrupados; sin transparencias mezcladas. |
| Suelo, hojarasca, márgenes y sendero | Material continuo de tierra húmeda de Scenario; variantes de tinte y escala para separar el camino. |
| Postes de los faroles y barrera de raíces | Corteza compartida; geometría de juego ajustada a la colisión. |
| Faroles | Reutilización del farol hueco de Scenario ya aprobado para las casas; luz emisiva moderada. |
| Portón y entrada a la ciudad | Piedra y madera del kit, forja mate y faroles existentes; geometría funcional de dos hojas. |

Los materiales nuevos se generan a 1024 px; las normales y mapas de superficie son aproximaciones derivadas localmente del albedo, no mapas físicamente medidos. Scenario PATINA requiere otro plan y no se cambia la suscripción. La procedencia registra cada modelo, activo y coste real.

El roble usa un atlas de color de 1024 px. Trellis2 entregó normales de vértice pero no un mapa normal; por eso `roble-normal.webp` es plano. La geometría se normaliza a altura 1, base Y=0 y centro XZ=0. `preparar-roble.py` produce los datos compactos y el atlas desde el GLB de `hornear-roble.py`. Ese script reduce, reconstruye UV y hornea un albedo corregido a marrón/oliva, ya que el proveedor dejó el follaje gris claro. `optimizar-roble.py` conserva la prueba inicial de presupuesto; su versión de 1.950 triángulos se descartó.

Se generaron siete activos en Scenario, con 173 CU cotizadas para las generaciones completadas: tres materiales, un atlas, dos conceptos de árboles y el roble 3D. Tripo rechazó la generación de los árboles por el límite del plan; Trellis2 permitió completar el roble a menor coste. El pino usa el concepto y el atlas de Scenario sobre geometría artesanal, sin fingir que existe una segunda malla generada.

Presupuesto: texturas compartidas; sin luces con sombras nuevas; follaje mediante `InstancedMesh`, `alphaTest` y escritura de profundidad; árboles detallados sólo en el borde cercano. La meta visual es un acabado de mayor calidad y lectura clara, sin afirmar que una generación aislada constituye calidad AAA.

Revisión de dirección de arte (2026-10-09): **aprobado como primera pasada de Alpha para el bosque y los encuentros**. Se inspeccionaron capturas de la cámara real de juego: sendero, parry detenido, emboscada, tronco, brecha y entrada a la ciudad. Los doce mapas y seis robles cargaron sin errores. Se corrigieron las copas que cubrían el combate y el HUD, el follaje blanco del roble y la superficie azul que asomaba detrás del terreno. La versión de 5.900 triángulos conserva una silueta asimétrica y color oliva/marrón compatible con el resto del bosque. La revisión puntual de entrada también pasó después de ocultar el dintel que tapaba a Adreida; se restaura al terminar el tutorial.

Límites de esta aprobación: el suelo todavía puede ganar una franja central menos ruidosa; las hojas y raíces del roble no son para primerísimos planos; las normales de suelo/corteza/roca son aproximadas; la muralla conserva su modelado anterior y puede recibir más detalle en otra pasada. Esta revisión no certifica acabado AAA ni un framerate específico. Evidencia y criterio por elemento en `revision-arte.json`.
