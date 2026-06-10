# Caoz Con Todo — El Juego

Juego de tácticas 3D por turnos (estilo XCOM + dados de D&D) basado en la serie de YouTube
**Caoz Con Todo**. Cada episodio de la serie es un nivel del juego.

## Episodio 1 — «Los Rateros, Racistas y Románticos»

El nivel completo del primer episodio:

1. **Plaza de Water Deep** — Mohamed "el mago", Talesim en modo National Geographic,
   y Bartolomio reclutando con asco.
2. **Mansión de Aldrick Boss** — Bartolomio asigna la prueba del puente (50 oros en
   TOTAL, no por cabeza). Aún no son dignos de ver al amo.
3. **El puente** — Brock el ogro dormido y Brick («¡Croca groca!») cobrando 7 platas
   POR PERSONA. Se resuelve con el acertijo del punto verde en la esquina de la cocina
   (¿una uva? NO: un chícharo castigado) y el puente gentrificado de La Condechi.
4. **El cofre escondido** — un brillo bajo el puente, "cosas de chicas", todos fallan
   con estilo; Mohamed destruye la cerradura (minijuego de ganzúas, +60 platas).
5. **Aldrick Boss** — la hermana perdida, todas sus riquezas y el negocio del mercado
   de pescadores; la Brújula Dorada que abre UNA salida del Domo. Una. UNA.
6. **El campamento** — fogata nocturna donde el grupo se presenta (con sus frases del
   episodio) y nadie le cree a Rafaela que alguien los observa.
7. **La emboscada goblin** — amanecer con el Domo en el horizonte, rueda robada,
   ladrillos, combate táctico con gritos de batalla de cada héroe.
8. **El interrogatorio** — el goblin sin piernas revela que un encapuchado que olía a
   *pescado caro* pagó por retrasarlos... y el epílogo rumbo al pueblo fronterizo.

## El grupo

| Héroe | Clase | Lo suyo |
|---|---|---|
| Mohamed | Pícaro Humano | Acrobacias (atraviesa obstáculos), Ataque Furtivo +1d6 |
| Fender | Bardo Tiefling | Inspiración Bárdica (+1d4), Gato Bachatero (hipnotiza) |
| Adreida | Guerrera Semiorca | Hachazo 1d8+3 con HENDIDURA (corta a dos), hacha arrojadiza |
| Rafaela | Clériga Elfa de Rul | Manos Ardientes 3d6 en área, Bendición de Rul (cura 1d8) |
| Talesim | Mago Celestial | Rayo de Fuego 1d10, Misiles Mágicos 4d4 que nunca fallan |

## Cómo jugar

- Cada héroe tiene **2 puntos de acción**: mover (1 PA), correr (2 PA);
  atacar, habilidades y Guardia terminan su activación.
- Clic en un héroe (o teclas 1–5 / Tab), clic en casilla azul para mover,
  clic en un goblin para atacar. Botones de habilidad abajo al centro.
- **Cobertura**: arbustos = media (−20), carruaje / árboles / rocas = total (−40).
  Flanquea para conseguir críticos (y el Ataque Furtivo de Mohamed).
- Cámara: WASD/flechas mueve, Q/E o arrastrar con botón derecho rota, rueda hace zoom.

## Ejecutar

```sh
python3 -m http.server 8742 --directory caoz_con_todo
# abrir http://localhost:8742
```

Es una página estática (Three.js por CDN): se puede publicar en cualquier hosting
de archivos estáticos para jugarlo en línea.

## Episodio 2 — «Sin Miedo y Sin Piernas»

1. **Machete** — Rafaela estabiliza al goblin sin piernas (Spare the Dying); el grupo
   lo adopta como mochila. Confiesa: los mandó **Can**, líder de Townsfolk.
2. **Townsfolk de noche** — Disguise Self (campesinos genéricos), la cantina del
   acantilado y el orco portero que Adreida convence... siendo su hija perdida.
3. **El Coyote** — el pacto: cruzar gratis hoy, pagar EL DOBLE al salir (más toda
   la información del Domo y el artefacto).
4. **¡Escape de la cantina!** — combate con objetivo de EXTRACCIÓN: lleguen todos a
   la puerta sur mientras Can y sus goblins (tres hipnotizados por la canción de
   Fender) cierran el paso.
5. **El muro a las 5:00 a.m.** — cuerda, trampas invisibles, el gato mago, el bosque
   brillante... y el contrato vinculante del Domo. CONTINUARÁ.

## Próximos episodios

La estructura está pensada para crecer: `SCRIPT` (diálogos y escenas), `PARTY_DEF` /
`GOBLIN_DEF` (fichas con habilidades) y `startCombat()` / `startCombat2()` (mapas y
objetivos de combate) son los puntos a extender para el Episodio 3 (el interior del Domo).
