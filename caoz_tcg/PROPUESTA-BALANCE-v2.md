# Propuesta de balance v2 — solo composición de mazos

**Estado: propuesta, sin aplicar.** Medida con `balance.html` sobre 1250 partidas por
variante. Ninguna carta cambia lo que hace: solo entran y salen copias de las listas.
Todos los mazos siguen con **40 cartas** y **máximo 3 copias** por carta.

## Resultado medido

| Mazo | Antes | Después | |
|---|---|---|---|
| Adreida | 83,1 % | **72,2 %** | −11 |
| Rafaela | 54,6 % | 59,2 % | +5 |
| Mohamed | 35,5 % | **44,4 %** | +9 |
| Fender | 39,0 % | 38,0 % | −1 |
| Talesin | 37,8 % | 36,2 % | −2 |
| **Brecha** | **47,6** | **36,0** | −12 |

Mejora clara, pero **no llega al objetivo**: Adreida sigue muy por encima.

## Los cambios

### Adreida (−11) — quitarle la masa de cuerpos grandes y el equipo que los fabrica

| Fuera | | Dentro | |
|---|---|---|---|
| Mazo de Brock | ×2 | Machete (Glip) | ×2 |
| Arco Dorado de Juan | ×1 | El Conserje | ×2 |
| Trol de la Mano Larga | ×2 | Bartolomeo | ×1 |
| Juan Gabriel | ×1 | Augusto Bale | ×1 |
| Eman 69 | ×1 | Auxilio | ×1 |
| Talia Boss | ×1 | Armadura Mágica | ×1 |
| Edbor | ×1 | Zancada Larga | ×1 |
| Contrahechizo | ×1 | Saeta Guía | ×1 |

Pasa de **10 cuerpos de 4+ ATQ a 3**. El Mazo de Brock sale porque da +3 ATQ: convertía
cualquier cuerpo pequeño en uno de 4+ y le devolvía el Provocar de *Intimidante*, así que
quitarle gigantes sin quitarle el equipo no servía de nada.

### Mohamed (+9) — darle respuesta a las mesas llenas

| Fuera | | Dentro | |
|---|---|---|---|
| Gema del Conserje | ×1 | **Pergamino de Bola de Fuego** | ×1 |
| Copia de Jabón | ×1 | **Nube de Dagas** | ×2 |
| Disfrazarse | ×1 | Rayo de Escarcha | ×1 |
| El Conserje | ×1 | | |

Bola de Fuego (4 daño a todos los Personajes rivales) y Nube de Dagas están **fuera de todo
mazo** hoy. Son la respuesta que a nadie le sobraba contra Adreida. Es el cambio que más
rinde de toda la propuesta.

### Talesin (−2) — abaratar un mazo que no llega a jugar lo suyo

| Fuera | | Dentro | |
|---|---|---|---|
| Tal, el Dragón Negro (10 PD) | ×1 | Rayo de Escarcha | ×2 |
| El Mago del Domo (8 PD) | ×1 | Nube de Dagas | ×2 |
| Lucy Fernando (6 PD) | ×1 | Proyectil Mágico | ×1 |
| Púas Plateadas | ×2 | Rayo Abrasador | ×1 |
| Contrahechizo | ×1 | Disipar Magia | ×1 |
| Contrato del Notario | ×1 | El Conserje | ×1 |
| Las Montañas de Tal | ×1 | | |

Su coste medio era 3,08, el más caro con diferencia, y las partidas duran 10 turnos: Tal
(10 PD) es prácticamente injugable.

### Fender (−1) — más cuerpos, menos cartas que se quedan en la mano

| Fuera | | Dentro | |
|---|---|---|---|
| Palabra de Curación | ×2 | Rayo de Escarcha | ×3 |
| Calentar Metal | ×1 | Adolfo y Remus | ×1 |
| Hongos del Bosque | ×1 | Eric | ×1 |
| Bob Carly | ×2 | Zancada Larga | ×1 |

### Rafaela (+5) — casi nada

| Fuera | | Dentro | |
|---|---|---|---|
| Palabra de Curación | ×1 | Saeta Guía | ×1 |

## Por qué no basta con esto

Se probaron seis palancas distintas. Adreida no baja de ~70 % con ninguna:

| Palanca | Adreida queda en |
|---|---|
| Esta propuesta de mazos | 72,2 % |
| Propuesta + *Intimidante* solo a Paladines | 70,9 % |
| Propuesta + *Golpe Directo* sin anular el contraataque | 69,8 % |
| Quitarle *Intimidante* entera (sin tocar mazos) | 62,5 % |
| Quitar solo el «sin contraataque» (sin tocar mazos) | 83,3 % — nada |
| Mejorar el bot para que priorice quitar cuerpos grandes | 83,8 % — nada |

Y el experimento que lo explica: **Fender jugando el mazo de Adreida** sube a 52,9 %, y
**Adreida jugando el mazo de Fender** baja a 53,4 %. Cada mitad vale unos +14 puntos por
separado, pero juntas valen +44. No hay una carta rota: hay una acumulación de ventajas
pequeñas que se refuerzan.

**Para cerrar la brecha del todo habrá que tocar estadísticas o costes**, que es justo lo que
quedó para la siguiente fase.

## Cómo leer estos números

Los juega el bot del juego, en los dos lados. Eso hace justa la comparación entre mazos,
pero mide lo bien que le va a cada uno **en manos de este bot**. Tres avisos concretos:

- Las cartas **Rápidas** (Contrahechizo, Púas Plateadas, Palabra de Curación) no se juegan
  nunca porque el bot no las usa. Salen de las listas por eso, no porque sean malas: en
  manos de una persona pueden ser buenas.
- Fender y Talesin dependen de encadenar cosas, que es lo que peor hace un bot. Sus números
  bajos pueden estar exagerados.
- Mohamed sube 9 puntos con dos cartas simples y potentes. El bot premia eso.
