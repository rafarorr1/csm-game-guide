/* ==========================================================================
   CAOZ CON TODO — TCG · EL MOTOR
   Cartas, Líderes, mazos, reglas, IA, red, guías y el guion del tutorial: todo
   lo que NO toca la pantalla. Habla con ella sólo por nombre —render(), log(),
   ask(), roll(), fx*()— y por eso puede haber más de una pantalla: index.html
   trae la de escritorio y movil.html traerá la del teléfono, las dos sobre
   este mismo archivo. Ninguna función de aquí puede mirar ni cambiar la
   página; si una lo necesita, es que le falta un gancho.
   Se cargan como scripts clásicos y comparten el ámbito global: lo que aquí es
   una función o un `let` de nivel superior, la pantalla lo ve tal cual. La
   regla del orden: motor.js va ANTES, y nada de aquí se ejecuta al cargar más
   allá de declarar (las cartas se registran con C(), que es declarar).
   ========================================================================== */
'use strict';

const buildTxt = ()=>`build ${BUILD.n} · ${BUILD.fecha}`;

/* ==========================================================================
   LAS ILUSTRACIONES
   Las imágenes viven en art/<id>.webp y las prepara estudio.html, que además
   guarda de cada una su encuadre —qué parte se ve cuando se recorta— en
   art/encuadres.json. Ese archivo hace de índice: si un id no está, esa carta
   todavía no tiene ilustración y se queda con su emoji.
   Todo esto es OPCIONAL: sin la carpeta art/ el juego funciona igual que hasta
   ahora. Así se pueden ir metiendo ilustraciones de una en una sin que nada se
   rompa por el camino.
   ========================================================================== */

let ARTE = {};                       // id -> encuadre vertical (0-100)

async function cargarArte(){
  // Con doble clic (file://) el navegador no deja pedir archivos del disco:
  // ni se intenta, para no llenar la consola de errores.
  if(location.protocol === 'file:') return;
  try{
    const r = await fetch('art/encuadres.json', {cache:'no-cache'});
    if(!r.ok) return;                // no hay ilustraciones todavía: emojis
    ARTE = await r.json();
  }catch(e){}                        // tampoco pasa nada: emojis
}

/* Convierte una carta ya montada en carta ILUSTRADA: la imagen pasa a ser el
   fondo completo y tribu, texto y cifras se agrupan en un pie con velo, que es
   donde se leen. Sin ilustración la carta se queda como estaba, con su ventana
   de arte y el emoji: las dos formas conviven mientras se van dibujando.

   Este montaje viene de estudio.html, que lo tenía resuelto antes de que el
   juego supiera leer imágenes. Se adopta tal cual en vez de reinventarlo: así
   lo que ves en el estudio es exactamente lo que verás en la mesa. */
/* TEXTO QUE SE ENCOGE PARA CABER
   Los nombres de tribu no miden lo mismo: "ELFO · DISCÍPULO" entra de sobra y
   "HUMANO · PALADÍN · TOMSAGE" no, así que se cortaba con puntos suspensivos y
   perdías justo el dato. En vez de recortar, la letra se encoge lo justo.

   Se mide UNA vez y se calcula el factor de golpe, en vez de ir bajando de
   punto en punto: cada medición obliga al navegador a recalcular la página, y
   con diez cartas en pantalla eso se nota. Hay un mínimo por debajo del cual no
   baja: mejor recortar que dejarlo ilegible. */

function encuadreDe(v){
  if(v == null) return null;
  if(typeof v === 'number') return {x:50, y:v, z:100};
  return {x: v.x ?? 50, y: v.y ?? 50, z: v.z ?? 100};
}

/* Mete el dibujo al fondo del nodo y deja el encuadre en variables CSS, que es
   lo que leen .dibujo y el retrato del Líder. */

const sleep = ms => new Promise(r=>setTimeout(r,ms));

const rnd = n => Math.floor(Math.random()*n);

const shuffle = a => { for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];} return a; };

const cap = s => s.charAt(0).toUpperCase()+s.slice(1);

const SUBNAME = {engano:'Engaño', fe:'Fe', cancion:'Canción', fuego:'Fuego',
                 contrato:'Contrato', rapido:'Rápido'};

/* ==========================================================================
   1. LÍDERES
   ========================================================================== */

const LEADERS = {
mohamed:{ n:'Mohamed', ep:'El Mago Pitero', art:'🧙‍♂️', arch:'Control · Engaño · Llaves',
  pasiva:'<b>Disfraz de Mago:</b> tus Hechizos de Engaño cuestan 1 PD menos (mínimo 1).',
  hab:'<b>Manos Largas (2 PD):</b> mira la carta superior del mazo rival. Si es un Objeto, a tu mano; si no, a sus Alcantarillas.',
  habCost:2, habName:'Manos Largas',
  lore:'Pícaro humano. Se disfraza de mago para robar. Odia la magia porque es injusta.',
  habReq:(g,s)=>P(1-s).deck.length>0,
  hab_do:async(g,s)=>{
    const d=P(1-s).deck; if(!d.length) return;
    const c=d.shift();
    const aMano = CARDS[c].t==='objeto';
    netFx('revela',{id:c, mano:aMano, side:s});
    await revelarCarta(c, aMano, s);        // se ve la carta y a dónde va
    if(aMano){ P(s).hand.push(c); log(`<b>Manos Largas</b>: Mohamed roba ${CARDS[c].n} del mazo rival.`);}
    else { P(1-s).grave.push(c); log(`<b>Manos Largas</b>: ${CARDS[c].n} va a las Alcantarillas rivales.`,'sys'); }
    render();
  }},
fender:{ n:'Fender', ep:'El Bardo Honesto', art:'🎸', arch:'Aggro · Canciones · Tempo',
  pasiva:'<b>Inspiración:</b> cada vez que juegas un Hechizo de Canción, un aliado gana +1 ATQ <b>permanente</b>.',
  hab:'<b>Sube el Volumen (2 PD):</b> todos tus Personajes ganan +1 ATQ hasta el final del turno.',
  habCost:2, habName:'Sube el Volumen',
  lore:'Tiefling carismático. Canta, baila y se gana la vida con música.',
  habReq:(g,s)=>P(s).field.length>0,
  hab_do:async(g,s)=>{ P(s).field.forEach(u=>{u.tA++;}); log('<b>Sube el Volumen</b>: +1 ATQ a todo tu campo.'); }},
/* Su epíteto era «De Frente», que es el nombre de su MAZO, no de ella: era la
   única de los seis que no se describía a sí misma, y encima repetía lo que ya
   dice la ficha del mazo dos líneas más abajo. El mazo se sigue llamando así. */
adreida:{ n:'Adreida', ep:'La Guerrera Semiorca', art:'⚔️', arch:'Midrange · Provocar · Combate',
  pasiva:'<b>Intimidante:</b> tus Personajes con 4 o más ATQ tienen <b>Provocar</b>.',
  hab:'<b>Golpe Directo (2 PD):</b> un aliado gana +2 ATQ y no recibe daño de contraataque este turno.',
  habCost:2, habName:'Golpe Directo', habTg:{k:'unidadAliada',min:1,max:1},
  hab2:{n:'Maratón de K-dramas (0 PD)', cost:0,
        d:'Si no atacaste este turno, roba 1 carta en tu Fase Final.'},
  lore:'Guerrera semiorca. Intimida y prefiere resolver las cosas peleando. Ama los K-dramas.',
  habReq:(g,s)=>P(s).field.length>0,
  hab_do:async(g,s,ts)=>{ const u=ts[0][0]; u.tA+=2; u.noCounter=true;
    log(`<b>Golpe Directo</b>: ${u.card.n} +2 ATQ y sin contraataque.`); }},
gero:{ n:'Gero', ep:'El Dungeon Master', art:'🎲', arch:'Caos · Tiradas · NPCs',
  pasiva:'<b>El dado decide:</b> al inicio de tu turno se tira un d20. Con <b>15 o más</b> ganas <b>2 PD</b>; con <b>10 o menos</b> pierdes <b>1 Alma</b>.',
  hab:'<b>Improvisar (2 PD):</b> mira la carta superior de tu mazo; si no te sirve, mándala a las Alcantarillas.',
  habCost:2, habName:'Improvisar',
  lore:'El Dungeon Master. No lleva un aventurero: lleva la mesa entera. Los NPC son suyos, y el dado también.',
  habReq:(g,s)=>P(s).deck.length>0,
  hab_do:async(g,s)=>{
    const p=P(s); if(!p.deck.length) return;
    const c=p.deck[0];
    const tirar = await ask(s,`Lo siguiente que te toca es <b>${CARDS[c].n}</b>. ¿Lo dejas o lo tiras?`,
      ['Lo dejo arriba','A las Alcantarillas'],(g2,s2)=>aiScore(c,s2)<14?1:0);
    if(tirar===1){ p.deck.shift(); p.grave.push(c);
      log(`<b>Improvisar</b>: ${CARDS[c].n} no llegó a pasar nunca.`,'sys'); }
    else log('<b>Improvisar</b>: Gero deja el guion como estaba.','sys');
    render();
  }},
rafaela:{ n:'Rafaela', ep:'Devota de Rul', art:'✨', arch:'Enjambre · Fe · Curación',
  pasiva:'<b>Rebaño de Rul:</b> cada vez que un Discípulo entra a tu campo, restaura 2 PV a un aliado o 2 Alma a ti.',
  hab:'<b>Estornudo de Rul (2 PD):</b> 1 daño a un Personaje y cura 1 PV a otro.',
  habCost:2, habName:'Estornudo de Rul',
  habTg:[{k:'unidad',min:1,max:1,label:'objetivo del estornudo'},{k:'unidad',min:0,max:1,label:'aliado a curar'}],
  lore:'Clériga elfa de Rul, un dragón que estornuda fuego. Busca a sus doce discípulos perdidos.',
  habReq:(g,s)=>P(0).field.length+P(1).field.length>0,
  hab_do:async(g,s,ts)=>{ log('<b>Estornudo de Rul</b>: ¡achús!');
    if(ts[0][0]) await dmgU(ts[0][0],1,{src:'leader'});
    if(ts[1]&&ts[1][0]&&ts[1][0].alive) healU(ts[1][0],1); }},
talesin:{ n:'Talesyn', ep:'El Heredero Celestial', art:'😇', arch:'Sacrificio · Rampa · Ascensión',
  pasiva:'<b>Digno de Ascender:</b> cada vez que muere un aliado ganas 1 Ficha de Gracia. Con 5, <b>asciendes</b>: +5 Alma y tus Celestiales ganan +2/+2 permanentes. <b>Después de ascender, cada Personaje que entre a tu campo nace Celestial y con +2/+2.</b>',
  hab:'<b>Luz de Kenya (3 PD):</b> un aliado gana +1/+1 permanentes y la tribu Celestial.',
  habCost:3, habName:'Luz de Kenya', habTg:{k:'unidadAliada',min:1,max:1},
  lore:'Hijo del solar Kenya. Bajó en cuerpo humano para demostrar que es digno de ascender.',
  habReq:(g,s)=>P(s).field.length>0,
  hab_do:async(g,s,ts)=>{ const u=ts[0][0]; u.pA++; u.pH++; if(!u.tribes.includes('Celestial'))u.tribes.push('Celestial');
    log(`<b>Luz de Kenya</b>: ${u.card.n} +1/+1 y ahora es Celestial.`); }},
};

/* ==========================================================================
   2. CARTAS
   t: personaje | hechizo | trampa | objeto | lugar
   c=costo  a=ataque  h=vida  tr=tribus  r=rareza(0 común,1 rara,2 legendaria)
   ========================================================================== */

const CARDS = {};

const C = (id,o)=>{ o.id=id; CARDS[id]=o; return o; };

/* ---------------------- PERSONAJES ---------------------- */

C('augusto',{n:'Augusto Bale',t:'personaje',c:3,a:2,h:4,tr:['Humano','Tomsage'],r:0,art:'🛡️',
 x:'<b>Al entrar:</b> los demás Tomsage aliados ganan +1/+1. <b>Veterano:</b> tus Trampas cuestan 1 menos.',
 enter:async(g,s,u)=>{ let k=0; P(s).field.forEach(o=>{ if(o!==u&&o.tribes.includes('Tomsage')){o.pA++;o.pH++;k++;} });
   if(k) log(`Augusto entrena a ${k} Tomsage (+1/+1).`); }});

C('lucius',{n:'Lucius Bale',t:'personaje',c:4,a:4,h:4,tr:['Humano','Paladín','Tomsage'],r:2,art:'🗡️',
 x:'<b>Al entrar:</b> ganas 1 PD este turno. <b>El mejor de Tomsage:</b> si es tu único Personaje, gana +2/+2.',
 enter:async(g,s,u)=>{ P(s).pd++; log('Lucius Bale inspira: +1 PD.'); },
 aura:(g,s,u)=>{ if(P(s).field.length===1){ u.aA+=2; u.aH+=2; } }});

C('machete',{n:'Machete (Glip)',t:'personaje',c:1,a:0,h:2,tr:['Goblin'],r:0,art:'🎒',
 x:'<b>Mochila:</b> puede llevar hasta 2 Objetos. <b>Banco de Puntos:</b> en tu Fase Final guarda hasta 2 PD sin usar.',
 objSlots:2, bank:true});

C('petunia',{n:'Petunia',t:'personaje',c:2,a:1,h:3,tr:['Bestia','Vaca'],r:2,art:'🐄',
 x:'<b>Montura — al entrar:</b> un aliado gana <b>Prisa</b>. <b>Al morir — Ascensión:</b> vuelve como Petunia Sagrada 3/5 con Vuelo (una vez por partida).',
 enterTg:{k:'unidadAliada',min:0,max:1,label:'aliado que recibe Prisa'},
 enter:async(g,s,u,ts)=>{ const t=ts&&ts[0]&&ts[0][0]; if(t){ t.sick=false; addKey(t,'prisa'); log(`Petunia da Prisa a ${t.card.n}.`);} },
 die:async(g,s,u)=>{ if(P(s).petuniaUsed) return; P(s).petuniaUsed=true;
   await summonToken(s,'tok_petunia',{msg:'🐄✨ ¡Petunia asciende!'}); }});

C('bob',{n:'Bob Carly',t:'personaje',c:3,a:1,h:6,tr:['Bestia','Caracol'],r:0,art:'🐌',
 x:'<b>Transporte:</b> tus Personajes de Costo 3 o menos tienen <b>Prisa</b>. <b>Relajado:</b> Bob no puede atacar.',
 noAttack:true,
 aura:(g,s,u)=>{ P(s).field.forEach(o=>{ if(o.card.c<=3) o.aKeys.add('prisa'); }); }});

C('brickbrock',{n:'Brick y Brock',t:'personaje',c:3,a:3,h:4,tr:['Goblin','Ogro'],r:0,art:'🌉',
 x:'<b>Peaje:</b> los Personajes rivales solo pueden atacar si su controlador paga 1 PD. <b>Acertijo:</b> si el rival juega un Hechizo de Engaño, vuelven a la mano.',
 toll:true});

/* Las Llaves del Domo sólo sirven para una cosa: el requisito del Pergamino. Es
   la única línea del juego que las mira. El Conserje las reparte, así que en un
   mazo sin Pergamino —De Frente llevaba tres, Los Doce Discípulos uno— su
   habilidad no hacía absolutamente nada y la carta mentía.
   El primer arreglo fue una excepción dentro de la carta: «o 1 PD si tu Líder
   no usa Llaves». Dejaba de mentir, pero a costa de que el Conserje llevara
   encima una cláusula que en su propio mazo nunca se lee.
   Ahora el reparto es otro: el Conserje vuelve a ser una carta de Llaves a
   secas y vive sólo donde hay Pergamino (Mohamed y Talesin). Los mazos sin
   Pergamino llevan en su lugar una carta propia que da el PD directamente.
   Mismo cuerpo, mismo efecto, ningún texto de más — el banco lo confirma: son
   las mismas cartas con otro nombre, y el balance no se mueve.
   La inmunidad a Hechizos viene del Conserje, que era ciego. Al ponerles tema
   se quedó, pero con su propio motivo: al chaval nadie le gasta un Hechizo, y
   a Julia no se la puede señalar porque nadie sabe dónde está. Es la misma
   línea de código; lo que cambia es por qué. */

C('conserje',{n:'El Conserje (Viejo Micket)',t:'personaje',c:1,a:0,h:1,tr:['Kobold'],r:0,art:'🧹',
 x:'<b>Al morir:</b> su controlador gana <b>1 Llave del Domo</b>. <i>Ciego:</i> no puede ser objetivo de Hechizos rivales.',
 spellProof:true,
 die:async(g,s,u)=>{ gainKey(s,1,'El Conserje deja caer una llave'); }});

C('ninolanza',{n:'El Niño de la Lanza',t:'personaje',c:1,a:0,h:1,tr:['Humano'],r:0,art:'🔱',
 x:'<b>Al morir:</b> su controlador gana <b>1 PD</b>. <i>Novato:</i> no puede ser objetivo de Hechizos rivales — nadie gasta magia en un chaval.',
 spellProof:true,
 die:async(g,s,u)=>{ P(s).pd++; log('🔱 El chaval cae y suelta la lanza: +1 PD.','good'); render(); }});

C('julia',{n:'Julia',t:'personaje',c:1,a:0,h:1,tr:['Humano'],r:0,art:'🕯️',
 x:'<b>Al morir:</b> su controlador gana <b>1 PD</b>. <i>Perdida:</i> no puede ser objetivo de Hechizos rivales — nadie sabe dónde está.',
 spellProof:true,
 die:async(g,s,u)=>{ P(s).pd++; log('🕯️ Julia se pierde otra vez: +1 PD.','good'); render(); }});

/* El Rey no gana por daño: gana por reunir la corte. Es la segunda ruta
   alternativa del juego después del Pergamino, y la única que se gana
   juntando gente en vez de destruirla.
   El número es tres y no cuatro por una medición, no por gusto: con «El Rey y
   la mesa llena» la corte se reunió CERO veces en 951 turnos con él vivo. La
   mesa sí se llena —Gero llega a cinco en el 12 % de sus turnos—, pero El Rey
   cuesta 7 PD y para cuando cae ya se han intercambiado cuerpos. Con tres, la
   ruta vive. */

C('rey',{n:'El Rey',t:'personaje',c:7,a:3,h:8,tr:['Humano','Noble'],r:2,art:'👑',
 x:'<b>Corte reunida:</b> al inicio de tu turno, si controlas otros <b>3 Personajes</b> además de El Rey, <b>ganas la partida</b>.'});

C('talia',{n:'Talia Boss',t:'personaje',c:5,a:5,h:4,tr:['Humana','Paladín','Casa Boss'],r:2,art:'👑',
 x:'<b>Cazamagos:</b> +3 ATQ al atacar a un Mago o Dragón. <b>Detener el juego:</b> el rival no puede jugar el Pergamino.',
 hunter:true, blockScroll:true});

C('aldrick',{n:'Aldrick Boss',t:'personaje',c:4,a:2,h:3,tr:['Humano','Noble','Casa Boss'],r:1,art:'📜',
 x:'<b>Contratar — al entrar:</b> busca un Paladín en tu mazo y ponlo en tu mano. <b>Recompensa:</b> cuando Talia Boss entre bajo tu control, roba 2.',
 enter:async(g,s,u)=>{ await search(s,c=>CARDS[c].tr&&CARDS[c].tr.includes('Paladín'),'Paladín'); }});

C('bartolomeo',{n:'Bartolomeo',t:'personaje',c:2,a:1,h:2,tr:['Humano','Sirviente','Casa Boss'],r:0,art:'🤵',
 x:'<b>Al entrar:</b> roba 1 carta. <b>Pomposo:</b> tus Nobles cuestan 1 PD menos.',
 enter:async(g,s,u)=>{ await draw(s,1); }});

C('eric',{n:'Eric',t:'personaje',c:3,a:3,h:3,tr:['Humano','Paladín','Casa Boss'],r:0,art:'🛡️',
 x:'<b>Sacrificio:</b> cuando un aliado vaya a recibir daño letal, puedes destruir a Eric en su lugar (el daño se anula).',
 guard:true});

C('horton',{n:'Sir Horton',t:'personaje',c:4,a:4,h:3,tr:['Humano','Paladín'],r:1,art:'🐴',
 x:'<b>Arrogante:</b> debe atacar cada turno si puede. <b>Esporas:</b> al morir, un Personaje rival queda <b>Infectado</b>.',
 mustAttack:true,
 die:async(g,s,u)=>{ const t=bestEnemy(1-s); if(t){ infect(t); log(`Esporas de Sir Horton: ${t.card.n} queda Infectado.`,'dmg'); } }});

C('edbor',{n:'Edbor',t:'personaje',c:5,a:5,h:4,tr:['Humano','Paladín','Oathbreaker'],r:1,art:'🗡️',
 x:'<b>Votos rotos — al entrar:</b> puedes destruir otro Paladín aliado; si lo haces ganas 1 Llave. <b>Sin honor:</b> ignora Provocar.',
 keys:['sinhonor'],
 enterTg:{k:'unidadAliada',min:0,max:1,label:'Paladín aliado a sacrificar',f:(u,g,s,self)=>u!==self&&u.tribes.includes('Paladín')},
 enter:async(g,s,u,ts)=>{ const t=ts&&ts[0]&&ts[0][0];
   if(t){ log(`Edbor rompe sus votos y destruye a ${t.card.n}.`,'dmg'); await destroy(t); gainKey(s,1,'Votos rotos'); } }});

C('juangabriel',{n:'Juan Gabriel',t:'personaje',c:6,a:5,h:6,tr:['Humano','Valoria','Arquero'],r:2,art:'🏹',
 x:'<b>Arco Dorado:</b> Arquero. <b>Alcalde:</b> los demás Valoria aliados ganan +0/+2. <b>Ganar tiempo:</b> el Pergamino rival no cuenta turnos.',
 keys:['arquero'], freezeScroll:true,
 aura:(g,s,u)=>{ P(s).field.forEach(o=>{ if(o!==u&&o.tribes.includes('Valoria')) o.aH+=2; }); }});

C('minus',{n:'Minus',t:'personaje',c:3,a:2,h:5,tr:['Minotauro','Valoria'],r:0,art:'🐮',
 x:'<b>Tienda de Objetos (2 PD, 1×turno):</b> busca un Objeto en tu mazo. <b>Miope:</b> al atacar, d20; con 10 o menos ataca a un rival al azar.',
 act:{cost:2,n:'Tienda de Objetos',do:async(g,s,u)=>{ await search(s,c=>CARDS[c].t==='objeto','Objeto'); }},
 myopic:true});

C('aidman',{n:'Aidman',t:'personaje',c:4,a:4,h:3,tr:['Humano','Cazarrecompensas'],r:1,art:'🎲',
 x:'<b>Ludópata:</b> al atacar tira d20 — 15+ doble daño; 5 o menos se hace el daño a sí mismo. <b>Deudas:</b> al entrar pierdes 1 Alma; al morir ganas 2 PD.',
 gambler:true,
 enter:async(g,s,u)=>{ await dmgFace(s,1,{src:'deudas'}); log('Deudas de Aidman: pierdes 1 Alma.','dmg'); },
 die:async(g,s,u)=>{ P(s).pd+=2; log('Aidman cobra sus deudas: +2 PD.'); }});

C('adolfo',{n:'Adolfo y Remus',t:'personaje',c:2,a:2,h:2,tr:['Elfo','Discípulo'],r:0,art:'👬',
 x:'<b>Radicalizables:</b> al inicio de tu turno, si el rival controla un Dragón, se pasan al campo rival.',
 onStart:async(g,s,u)=>{ if(P(1-s).field.some(o=>o.tribes.includes('Dragón')) && P(1-s).field.length<5){
   moveUnit(u,s,1-s); log('¡Adolfo y Remus se radicalizan y cambian de bando!','dmg'); } }});

C('titaus',{n:'Titaus',t:'personaje',c:3,a:2,h:3,tr:['Elfa','Discípulo'],r:0,art:'📖',
 x:'<b>Inteligente — al entrar:</b> mira las 3 cartas superiores de tu mazo y pon una en tu mano. <b>Sirve a Tal:</b> si controlas un Dragón, +2/+2.',
 enter:async(g,s,u)=>{ await dig(s,3); },
 aura:(g,s,u)=>{ if(P(s).field.some(o=>o.tribes.includes('Dragón'))){ u.aA+=2; u.aH+=2; } }});

C('matildus',{n:'Matildus',t:'personaje',c:1,a:1,h:1,tr:['Elfo','Discípulo'],r:0,art:'🍄',
 x:'<b>Amanita muscaria — al morir:</b> hace 2 daño al Personaje que lo mató.',
 die:async(g,s,u)=>{ if(u.killer&&u.killer.alive){ log(`Matildus explota en la cara de ${u.killer.card.n}.`,'dmg');
   await dmgU(u.killer,2,{src:'matildus'}); } }});

C('discipulo',{n:'Discípulo de Rul',t:'personaje',c:1,a:1,h:2,tr:['Elfo','Discípulo'],r:0,art:'🙏',
 x:'<b>Fe ciega:</b> gana +1/+0 por cada otro Discípulo aliado.',
 aura:(g,s,u)=>{ const n=P(s).field.filter(o=>o!==u&&o.tribes.includes('Discípulo')).length; u.aA+=n; }});

C('tal',{n:'Tal, el Dragón Negro',t:'personaje',c:10,a:9,h:9,tr:['Dragón'],r:2,art:'🐉',
 x:'<b>Vuelo. Aliento de Ácido — al entrar:</b> 3 daño a todos los Personajes rivales. <b>Poseer (3 PD):</b> revive un rival muerto este turno como 2/2 en tu campo. <b>Ganador de la temporada:</b> puedes jugar el Pergamino sin Llaves.',
 keys:['vuelo'], scrollFree:true,
 enter:async(g,s,u)=>{ log('🐉 <b>Aliento de Ácido</b>: 3 daño a todo el campo rival.','dmg');
   for(const o of [...P(1-s).field]) await dmgU(o,3,{src:'tal'}); },
 act:{cost:3,n:'Poseer',req:(g,s)=>g.diedThisTurn.some(d=>d.side===1-s),do:async(g,s,u)=>{
   const d=g.diedThisTurn.find(d=>d.side===1-s); if(!d) return;
   const idx=g.diedThisTurn.indexOf(d); g.diedThisTurn.splice(idx,1);
   await summonToken(s,'tok_poseido',{msg:`Tal posee el cadáver de ${CARDS[d.id].n}.`}); }}});

C('rantiago',{n:'Rantiago, el Mirrey',t:'personaje',c:3,a:2,h:2,tr:['Dragón','Mirrey'],r:0,art:'🕶️',
 x:'<b>Rehén:</b> el Tal rival no puede atacar a tu Alma. <b>Fiesta de hongos — al entrar:</b> elige un Personaje y tira d20 — 1-10 <b>Aturdido</b>; 11-20 gana +2 ATQ permanentes.',
 hostage:true,
 enterTg:{k:'unidad',min:0,max:1,label:'invitado a la fiesta'},
 enter:async(g,s,u,ts)=>{ const t=ts&&ts[0]&&ts[0][0]; if(!t) return;
   const r=await roll('Fiesta de hongos', null, {necesita:'11 o más', min:11,
     siOk:'+2 ATQ permanentes', siMal:'Se pasa de hongos y queda Aturdido'});
   if(r<=10){ stun(t); log(`${t.card.n} se pasa de hongos: <b>Aturdido</b>.`,'dmg'); }
   else { t.pA+=2; log(`${t.card.n} se pone loco: +2 ATQ permanentes.`); } }});

C('trol',{n:'Trol de la Mano Larga',t:'personaje',c:5,a:6,h:5,tr:['Trol'],r:1,art:'👹',
 x:'<b>Cobrar piso:</b> al inicio de tu turno el rival pierde 1 PD máximo ese turno. <b>Collar de Agua:</b> inmune al daño de Fuego. <b>Regeneración:</b> recupera 2 PV al inicio de tu turno.',
 keys:['regeneracion'], fireProof:true,
 onStart:async(g,s,u)=>{ P(1-s).pdTax=(P(1-s).pdTax||0)+1; log('El Trol cobra piso: el rival tendrá 1 PD menos.','sys'); }});

C('lucy',{n:'Lucy Fernando (Lucifer)',t:'personaje',c:6,a:5,h:5,tr:['Diablo','Infernal'],r:2,art:'😈',
 x:'<b>Cláusula:</b> no puede atacar salvo que controles un <b>Contrato</b>. <b>Custodio de la Llave — al entrar:</b> el rival elige perder 4 Alma o darte 1 Llave. <i>Inmune a Aturdido.</i>',
 clause:true, stunProof:true,
 enter:async(g,s,u)=>{ const c=await ask(1-s,'Lucy Fernando te presenta el contrato.',
     ['Perder 4 Alma','Darle 1 Llave del Domo'],(g2,s2)=>P(s2).alma>7?1:0);
   if(c===0){ await dmgFace(1-s,4,{src:'lucifer'}); log('El rival paga con Alma: −4.','dmg'); }
   else { gainKey(s,1,'Custodio de la Llave'); } }});

C('magodomo',{n:'El Mago del Domo',t:'personaje',c:8,a:4,h:8,tr:['Humano','Mago'],r:2,art:'🔮',
 x:'<b>Nexo:</b> cada vez que muere cualquier Personaje ganas 1 Alma. <b>Sacrificio de Sangre (3 PD):</b> destruye un aliado y gana 1 Llave. <b>Vínculo:</b> si muere, pierdes 3 Alma.',
 nexus:true,
 act:{cost:3,n:'Sacrificio de Sangre',tg:{k:'unidadAliada',min:1,max:1},
   req:(g,s)=>P(s).field.length>0,
   do:async(g,s,u,ts)=>{ const t=ts[0][0]; log(`Sacrificio de Sangre: ${t.card.n}.`,'dmg');
     await destroy(t); gainKey(s,1,'Sacrificio de Sangre'); }},
 die:async(g,s,u)=>{ log('Vínculo roto: su controlador pierde 3 Alma.','dmg'); await dmgFace(s,3,{src:'vinculo'}); }});

/* ---- FICHAS ---- */

C('tok_petunia',{n:'Petunia Sagrada',t:'personaje',c:2,a:3,h:5,tr:['Bestia','Vaca','Celestial'],r:2,art:'🐄',
 x:'<b>Vuelo.</b> Ficha. Petunia ha ascendido.', keys:['vuelo'], token:true});

C('tok_ilusion',{n:'Ilusión',t:'personaje',c:1,a:0,h:1,tr:['Ilusión'],r:0,art:'👻',
 x:'<b>Provocar.</b> Ficha. Si un Personaje la ataca, no hace daño y la Ilusión desaparece.',
 keys:['provocar'], token:true, illusion:true});

C('tok_poseido',{n:'Poseído',t:'personaje',c:2,a:2,h:2,tr:['Poseído'],r:0,art:'🧟',
 x:'Ficha sin habilidades.', token:true});

C('tok_dragon',{n:'Dragón Celestial Morado',t:'personaje',c:5,a:7,h:7,tr:['Dragón','Celestial'],r:1,art:'🐲',
 x:'<b>Vuelo.</b> Forma temporal otorgada por Rulchete.', keys:['vuelo'], token:true});

/* ---------------------- HECHIZOS ---------------------- */

C('rulchete',{n:'Rulchete, la Polimorfia Verdadera',t:'hechizo',c:5,sub:['fe'],r:1,art:'🐲',
 x:'Transforma un aliado de Costo 2 o menos en un <b>Dragón Celestial Morado 7/7</b> con Vuelo hasta el final de tu siguiente turno.',
 tg:[{k:'unidadAliada',min:1,max:1,f:u=>u.card.c<=2}],
 req:(g,s)=>P(s).field.some(u=>u.card.c<=2),
 cast:async(g,s,ts)=>{ const u=ts[0][0]; u.poly={card:u.card,until:g.turnNo+2};
   u.card=CARDS.tok_dragon; u.tribes=[...CARDS.tok_dragon.tr]; u.dmg=0;
   log(`¡${u.poly.card.n} se convierte en un Dragón Celestial Morado 7/7!`); }});

C('cuerda',{n:'Cuerda Dimensional',t:'hechizo',c:2,r:0,art:'🪢',
 x:'Retira hasta 3 aliados del campo hasta el inicio de tu siguiente turno. Al volver recuperan 2 PV.',
 tg:[{k:'unidadAliada',min:1,max:3}],
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s,ts)=>{ for(const u of ts[0]){ P(s).field.splice(P(s).field.indexOf(u),1);
   P(s).limbo.push({u,ret:g.turnNo+2}); } log(`${ts[0].length} aliado(s) suben por la cuerda.`); }});

C('copiajabon',{n:'Copia de Jabón',t:'hechizo',c:3,sub:['engano'],r:0,art:'🧼',
 x:'Elige un Objeto que controle el rival. Crea una copia exacta en tu mano.',
 req:(g,s)=>allObjects(1-s).length>0,
 cast:async(g,s)=>{ const list=allObjects(1-s); if(!list.length) return;
   const o=await pickFrom(s,list,'Objeto rival a copiar');
   if(o){ P(s).hand.push(o.id); log(`Copia de Jabón: obtienes ${CARDS[o.id].n}.`); } }});

C('acertijo',{n:'El Acertijo del Chícharo Castigado',t:'hechizo',c:2,sub:['engano'],r:0,art:'🫛',
 x:'Elige un Personaje rival. Su controlador tira d20: 11+ no pasa nada; 10 o menos vuelve a su mano. Goblin y Ogro siempre fallan.',
 tg:[{k:'unidadEnemiga',min:1,max:1}],
 req:(g,s)=>P(1-s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0];
   const dumb=u.tribes.includes('Goblin')||u.tribes.includes('Ogro');
   const r = dumb?1:await roll('Acertijo del Chícharo', null, {necesita:'11 o más', min:11,
     siOk:'Resuelve el acertijo y se queda', siMal:'No lo resuelve y vuelve a la mano'});
   if(dumb) log(`${u.card.n} ni lo intenta (Goblin/Ogro).`,'sys');
   if(r<=10){ log(`${u.card.n} no resuelve el acertijo y vuelve a la mano.`,'dmg'); bounce(u); }
   else log(`${u.card.n} resuelve el acertijo. No pasa nada.`,'sys'); }});

C('leche',{n:'Leche de Petunia',t:'hechizo',c:2,sub:['fe'],r:0,art:'🥛',
 x:'Restaura 2 PV a todos tus Personajes (4 si controlas a Petunia).',
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s)=>{ const n=P(s).field.some(u=>u.card.id==='petunia')?4:2;
   P(s).field.forEach(u=>healU(u,n)); log(`Leche de Petunia: +${n} PV a todo tu campo.`,'heal'); }});

C('campanafe',{n:'Campaña de la Fe',t:'hechizo',c:4,sub:['engano'],r:1,art:'📣',
 x:'Elige un Discípulo o Elfo rival. d20: 8+ pasa a tu control. Si controlas un Dragón, pasa automáticamente.',
 tg:[{k:'unidadEnemiga',min:1,max:1,f:u=>u.tribes.includes('Discípulo')||u.tribes.includes('Elfo')}],
 req:(g,s)=>P(1-s).field.some(u=>u.tribes.includes('Discípulo')||u.tribes.includes('Elfo')),
 cast:async(g,s,ts)=>{ const u=ts[0][0];
   const auto=P(s).field.some(o=>o.tribes.includes('Dragón'));
   const r = auto?20:await roll('Campaña de la Fe', null, {necesita:'8 o más', min:8,
     siOk:'Se convierte a tu causa', siMal:'La campaña no convence a nadie'});
   if(r>=8){ if(P(s).field.length<5){ moveUnit(u,1-s,s); log(`${u.card.n} se convierte a tu causa.`);} 
             else log('Tu campo está lleno; la conversión falla.','sys'); }
   else log('La campaña no convence a nadie.','sys'); }});

C('hongos',{n:'Hongos del Bosque',t:'hechizo',c:1,r:0,art:'🍄',
 x:'d20 — 1-5: muere un aliado. 6-14: roba 1. 15-19: roba 2. 20: roba 3 y tus Personajes +1/+1 este turno.',
 cast:async(g,s)=>{ const r=await roll('Hongos del Bosque', null, {necesita:'6 o más', min:6,
     siOk:'Robas cartas (más cuanto más alto)', siMal:'Mal viaje: muere tu peor aliado'});
   if(r<=5){ const u=worstAlly(s); if(u){ log(`Mal viaje: ${u.card.n} muere.`,'dmg'); await destroy(u);} else log('Mal viaje, pero no hay a quién matar.','sys'); }
   else if(r<=14) await draw(s,1);
   else if(r<=19) await draw(s,2);
   else { await draw(s,3); P(s).field.forEach(u=>{u.tA++;u.tH++;}); log('¡Viaje cósmico! +1/+1 a todo tu campo.'); } }});

C('alientoacido',{n:'Aliento de Ácido',t:'hechizo',c:4,r:1,art:'🟢',
 x:'2 daño a todos los Personajes rivales (4 si controlas un Dragón).',
 cast:async(g,s)=>{ const n=P(s).field.some(u=>u.tribes.includes('Dragón'))?4:2;
   log(`Aliento de Ácido: ${n} daño a todo el campo rival.`,'dmg');
   for(const u of [...P(1-s).field]) await dmgU(u,n,{src:'hechizo'}); }});

C('cantaberna',{n:'Canción de Taberna',t:'hechizo',c:1,sub:['cancion'],r:0,art:'🍺',
 x:'Un aliado gana +2/+0 hasta el final del turno. Roba 1 carta.',
 tg:[{k:'unidadAliada',min:1,max:1}],
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s,ts)=>{ ts[0][0].tA+=2; log(`${ts[0][0].card.n} se anima: +2 ATQ.`); await draw(s,1); }});

C('balada',{n:'Balada de Valoria',t:'hechizo',c:3,sub:['cancion'],r:0,art:'🎶',
 x:'Todos tus Personajes ganan +1/+1 hasta el final del turno y <b>Prisa</b>.',
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s)=>{ P(s).field.forEach(u=>{u.tA++;u.tH++;u.sick=false;addKey(u,'prisa');});
   log('¡Balada de Valoria! Todo tu campo +1/+1 y Prisa.'); }});

C('sangrefria',{n:'Golpe a Sangre Fría',t:'hechizo',c:3,sub:['engano'],r:0,art:'🔪',
 x:'Destruye un Personaje rival de Costo 2 o menos. No activa su habilidad Al morir.',
 tg:[{k:'unidadEnemiga',min:1,max:1,f:u=>u.card.c<=2}],
 req:(g,s)=>P(1-s).field.some(u=>u.card.c<=2),
 cast:async(g,s,ts)=>{ const u=ts[0][0]; log(`Golpe a Sangre Fría: ${u.card.n} muere sin decir nada.`,'dmg');
   await destroy(u,{silent:true}); }});

C('bendicion',{n:'Bendición de Rul',t:'hechizo',c:2,sub:['fe'],r:0,art:'🌟',
 x:'Un aliado gana +1/+3 permanentes. Si es Discípulo, además roba 1.',
 tg:[{k:'unidadAliada',min:1,max:1}],
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0]; u.pA++; u.pH+=3;
   log(`Bendición de Rul sobre ${u.card.n}: +1/+3.`,'heal');
   if(u.tribes.includes('Discípulo')) await draw(s,1); }});

C('modificar',{n:'Modificar las Reglas',t:'hechizo',c:5,sub:['contrato'],r:1,art:'📋',
 x:'Elige: anula todas las Trampas rivales; <b>o</b> roba 3 y descarta 1; <b>o</b> un Infernal aliado pierde su Cláusula.',
 cast:async(g,s)=>{ const c=await ask(s,'Modificar las Reglas — elige una cláusula:',
    ['Anular todas las Trampas rivales','Robar 3 y descartar 1','Quitar la Cláusula a un Infernal aliado'],
    (g2,s2)=>P(1-s2).traps.length?0:1);
   if(c===0){ const n=P(1-s).traps.length; P(1-s).traps.forEach(t=>P(1-s).grave.push(t.id));
     P(1-s).traps=[]; log(`Se anulan ${n} Trampa(s) rivales.`,'dmg'); }
   else if(c===1){ await draw(s,3); await discardChoose(s,1); }
   else { const u=P(s).field.find(o=>o.tribes.includes('Infernal')); if(u){ u.noClause=true;
     log(`${u.card.n} queda libre de su Cláusula.`);} else log('No hay Infernal aliado.','sys'); } }});

/* ---- Grimorio: daño ---- */

C('bolafuego',{n:'Pergamino de Bola de Fuego',t:'hechizo',c:5,sub:['fuego'],r:1,art:'🔥',
 x:'4 daño a todos los Personajes rivales. Cuesta 2 PD menos si controlas a Augusto o Lucius Bale.',
 cast:async(g,s)=>{ log('💥 <b>BOLA DE FUEGO</b>: 4 daño a todo el campo rival.','dmg');
   for(const u of [...P(1-s).field]) await dmgU(u,4,{fire:true,src:'hechizo'}); }});

C('manosardientes',{n:'Manos Ardientes',t:'hechizo',c:2,sub:['fuego'],r:0,art:'🔥',
 x:'2 daño a hasta dos Personajes rivales de Costo 3 o menos.',
 tg:[{k:'unidadEnemiga',min:1,max:2,f:u=>u.card.c<=3}],
 req:(g,s)=>P(1-s).field.some(u=>u.card.c<=3),
 cast:async(g,s,ts)=>{ for(const u of ts[0]) await dmgU(u,2,{fire:true,src:'hechizo'}); }});

C('rayoabrasador',{n:'Rayo Abrasador',t:'hechizo',c:3,sub:['fuego'],r:0,art:'☄️',
 x:'Tres rayos de 1 daño. Repártelos entre Personajes rivales y el Alma rival.',
 tg:[{k:'objetivoEnemigo',min:3,max:3,rep:true}],
 cast:async(g,s,ts)=>{ for(const t of ts[0]){
   if(t==='face') await dmgFace(1-s,1,{fire:true,src:'hechizo'});
   else await dmgU(t,1,{fire:true,src:'hechizo'}); } }});

C('saeta',{n:'Saeta Guía',t:'hechizo',c:2,sub:['fe'],r:0,art:'💫',
 x:'3 daño radiante a un Personaje rival. El siguiente ataque aliado contra él no recibe contraataque.',
 tg:[{k:'unidadEnemiga',min:1,max:1}],
 req:(g,s)=>P(1-s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0]; u.marked=true; await dmgU(u,3,{src:'hechizo'}); }});

C('escarcha',{n:'Rayo de Escarcha',t:'hechizo',c:1,r:0,art:'❄️',
 x:'1 daño a un Personaje rival. Pierde Prisa y tiene −1 ATQ hasta el final del turno rival.',
 tg:[{k:'unidadEnemiga',min:1,max:1}],
 req:(g,s)=>P(1-s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0]; debuff(u,-1,0); u.keysOwn.delete('prisa');
   await dmgU(u,1,{src:'hechizo'}); }});

C('proyectil',{n:'Proyectil Mágico',t:'hechizo',c:2,r:0,art:'🔷',
 x:'3 daño repartidos entre Personajes rivales. <b>Impacta sin fallar:</b> no puede ser anulado.',
 tg:[{k:'unidadEnemiga',min:3,max:3,rep:true}],
 req:(g,s)=>P(1-s).field.length>0,
 uncounterable:true,
 cast:async(g,s,ts)=>{ for(const u of ts[0]) if(u.alive) await dmgU(u,1,{src:'hechizo',unstoppable:true}); }});

C('nubedagas',{n:'Nube de Dagas',t:'hechizo',c:3,r:1,art:'🗡️',
 x:'Queda en el campo hasta el inicio de tu tercer turno. Cada Personaje rival que <b>entre</b> al campo recibe 2 daño.',
 cast:async(g,s)=>{ P(s).clouds.push({until:g.turnNo+6}); log('Una nube de dagas flota sobre el campo rival.'); }});

C('burla',{n:'Burla Viciosa',t:'hechizo',c:1,sub:['cancion'],r:0,art:'🤬',
 x:'1 daño a un Personaje rival y −2 ATQ hasta el final del turno rival.',
 tg:[{k:'unidadEnemiga',min:1,max:1}],
 req:(g,s)=>P(1-s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0]; debuff(u,-2,0);
   log(`"Vicius smokery" — ${u.card.n} −2 ATQ.`); await dmgU(u,1,{src:'hechizo'}); }});

/* ---- Grimorio: control ---- */

C('calentarmetal',{n:'Calentar Metal',t:'hechizo',c:3,sub:['fuego','cancion'],r:0,art:'♨️',
 x:'Un Personaje rival con Objeto o de tribu Paladín recibe 2 daño ahora y 2 al inicio de su próximo turno. Su controlador puede pagar 2 PD para destruir el Objeto y detenerlo.',
 tg:[{k:'unidadEnemiga',min:1,max:1,f:u=>u.objs.length>0||u.tribes.includes('Paladín')}],
 req:(g,s)=>P(1-s).field.some(u=>u.objs.length>0||u.tribes.includes('Paladín')),
 cast:async(g,s,ts)=>{ const u=ts[0][0]; await dmgU(u,2,{fire:true,src:'hechizo'});
   if(!u.alive) return; u.hotMetal=true;
   if(u.objs.length){ const c=await ask(1-s,`¿Pagar 2 PD para destruir ${CARDS[u.objs[0]].n} y detener el calor?`,
       ['Pagar 2 PD','Aguantar el calor'],(g2,s2)=>P(s2).pd>=2?0:1);
     if(c===0&&P(1-s).pd>=2){ P(1-s).pd-=2; const o=u.objs.shift(); P(1-s).grave.push(o);
       u.hotMetal=false; log(`${CARDS[o].n} se destruye para detener el calor.`,'sys'); } } }});

C('ceguera',{n:'Ceguera/Sordera',t:'hechizo',c:2,sub:['fe'],r:0,art:'🙈',
 x:'Un Personaje rival no puede atacar hasta el final de su próximo turno y pierde Vuelo. Si es Dragón, d20 11+ resiste.',
 tg:[{k:'unidadEnemiga',min:1,max:1}],
 req:(g,s)=>P(1-s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0];
   if(u.tribes.includes('Dragón')){ const r=await roll('Resistencia del Dragón', null,
     {necesita:'11 o más', min:11, siOk:'El Dragón resiste la ceguera',
      siMal:'No resiste: queda ciego y Aturdido'});
     if(r>=11){ log(`${u.card.n} resiste la ceguera.`,'sys'); return; } }
   stun(u); u.blind=true; log(`${u.card.n} queda ciego y sordo.`,'dmg'); }});

C('luzhadas',{n:'Luz de Hadas',t:'hechizo',c:2,r:0,art:'🧚',
 x:'Hasta el final del turno los rivales pierden Sigilo y Vuelo, y tus ataques contra ellos hacen +1 daño.',
 cast:async(g,s)=>{ P(1-s).field.forEach(u=>{u.revealed=true;u.noFly=true;}); P(s).fairy=true;
   log('Luz de Hadas: nadie se esconde.'); }});

C('mensaje',{n:'Mensaje',t:'hechizo',c:1,sub:['engano'],r:0,art:'✉️',
 x:'Mira las Trampas colocadas del rival. Roba 1 carta.',
 cast:async(g,s)=>{ const t=P(1-s).traps; t.forEach(x=>x.revealed=true);
   log(t.length?`Espías: ${t.map(x=>CARDS[x.id].n).join(', ')}.`:'El rival no tiene Trampas.','sys',true);
   await draw(s,1); }});

C('disipar',{n:'Disipar Magia',t:'hechizo',c:2,r:1,art:'🌀',
 x:'Elige: destruye un Objeto o Reliquia rival; <b>o</b> quita todos los estados a un aliado; <b>o</b> devuelve un Personaje robado o poseído.',
 cast:async(g,s)=>{ const c=await ask(s,'Disipar Magia — elige un efecto:',
     ['Destruir un Objeto/Reliquia rival','Limpiar los estados de un aliado','Devolver un Personaje robado'],
     (g2,s2)=>allObjects(1-s2).length?0:1);
   if(c===0){ const list=allObjects(1-s); if(!list.length){ log('Nada que disipar.','sys'); return; }
     const o=await pickFrom(s,list,'Objeto a destruir'); if(o) await destroyObject(1-s,o); }
   else if(c===1){ const list=P(s).field.filter(u=>u.stunned||u.infected||u.possessed);
     const u=list[0]||P(s).field[0]; if(u){ u.stunned=0;u.infected=false;u.possessed=false;u.blind=false;
       log(`${u.card.n} queda limpio de estados.`,'heal'); } }
   else { const u=P(s).field.find(x=>x.stolen)||P(1-s).field.find(x=>x.stolen&&x.owner===s);
     if(u){ moveUnit(u,u.side,u.owner); u.stolen=false; log(`${u.card.n} vuelve con su dueño.`); }
     else log('No hay nadie robado.','sys'); } }});

C('contrahechizo',{n:'Contrahechizo',t:'hechizo',c:3,sub:['rapido'],r:1,art:'🚫',
 x:'<b>Rápido.</b> Anula un Hechizo rival. Si costaba 5 o más, roba 1.',
 fast:true, counter:true,
 castCounter:async(g,s,ev)=>{ ev.countered=true; log(`<b>Contrahechizo</b> anula ${CARDS[ev.cardId].n}.`,'dmg');
   if(CARDS[ev.cardId].c>=5) await draw(s,1); }});

C('puas',{n:'Púas Plateadas',t:'hechizo',c:2,sub:['rapido'],r:0,art:'🪡',
 x:'<b>Rápido.</b> Cuando el rival tire un d20, obligalo a repetir y quedarse con el peor. Roba 1 carta.',
 fast:true, reroll:true,
 castReroll:async(g,s,ev)=>{ ev.reroll=true; log('<b>Púas Plateadas</b>: repite la tirada con el peor resultado.','roll');
   await draw(s,1); }});

/* ---- Grimorio: ilusión ---- */

C('ilusion',{n:'Ilusión Menor',t:'hechizo',c:1,sub:['engano'],r:0,art:'👻',
 x:'Crea una Ficha <b>Ilusión 0/1</b> con Provocar. Cuando un Personaje la ataca, no hace daño y la Ilusión desaparece.',
 req:(g,s)=>P(s).field.length<5,
 cast:async(g,s)=>{ await summonToken(s,'tok_ilusion',{msg:'Una ilusión distrae al rival.'}); }});

C('disfrazarse',{n:'Disfrazarse',t:'hechizo',c:2,sub:['engano'],r:0,art:'🎭',
 x:'Un aliado gana <b>Sigilo</b> y copia una tribu de cualquier Personaje. Las Trampas rivales no pueden responder a sus ataques este turno.',
 tg:[{k:'unidadAliada',min:1,max:1}],
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0]; addKey(u,'sigilo'); u.trapProof=true;
   const pool=[...P(0).field,...P(1).field].filter(o=>o!==u);
   if(pool.length){ const t=pool[rnd(pool.length)].tribes[0]; if(!u.tribes.includes(t)) u.tribes.push(t);
     log(`${u.card.n} se disfraza de ${t}.`); } else log(`${u.card.n} se camufla.`); }});

C('zancada',{n:'Zancada Larga',t:'hechizo',c:1,r:0,art:'👟',
 x:'Un aliado gana <b>Prisa</b> e ignora <b>Provocar</b> este turno.',
 tg:[{k:'unidadAliada',min:1,max:1}],
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0]; u.sick=false; addKey(u,'prisa'); u.tIgnoreTaunt=true;
   log(`${u.card.n} da una zancada larga.`); }});

/* ---- Grimorio: soporte ---- */

C('pasoatronador',{n:'Paso Atronador',t:'hechizo',c:3,sub:['cancion'],r:0,art:'⚡',
 x:'Devuelve a tu mano un aliado (y opcionalmente otro de Costo 2 o menos). Luego 2 daño a un Personaje rival. Si devolviste a Machete, roba 1.',
 tg:[{k:'unidadAliada',min:1,max:2},{k:'unidadEnemiga',min:0,max:1}],
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s,ts)=>{ let m=false; for(const u of ts[0]){ if(u.card.id==='machete')m=true; bounce(u); }
   if(ts[1]&&ts[1][0]) await dmgU(ts[1][0],2,{src:'hechizo'});
   if(m) await draw(s,1); }});

C('espiritus',{n:'Espíritus Guardianes',t:'hechizo',c:4,sub:['fe'],r:1,art:'🐉',
 x:'Hasta el inicio de tu siguiente turno, cada Personaje rival que declare un ataque recibe 2 daño antes del combate y tiene −1 ATQ.',
 cast:async(g,s)=>{ P(s).spirits=g.turnNo+2; log('Dragoncitos estornudones patrullan tu campo.'); }});

C('auxilio',{n:'Auxilio',t:'hechizo',c:2,sub:['fe'],r:0,art:'🤲',
 x:'Hasta tres aliados ganan +0/+2 permanentes.',
 tg:[{k:'unidadAliada',min:1,max:3}],
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s,ts)=>{ ts[0].forEach(u=>{u.pH+=2;}); log(`Auxilio: +0/+2 a ${ts[0].length} aliado(s).`,'heal'); }});

C('armadura',{n:'Armadura Mágica',t:'hechizo',c:1,r:0,art:'🥋',
 x:'Un aliado sin Objeto gana +0/+3 permanentes. Cuenta como su Objeto equipado.',
 tg:[{k:'unidadAliada',min:1,max:1,f:u=>u.objs.length===0}],
 req:(g,s)=>P(s).field.some(u=>u.objs.length===0),
 cast:async(g,s,ts)=>{ const u=ts[0][0]; u.pH+=3; u.objs.push('armadura');
   log(`${u.card.n} viste armadura mágica: +0/+3.`,'heal'); }});

C('armamagica',{n:'Arma Mágica',t:'hechizo',c:2,r:0,art:'⚒️',
 x:'Un Objeto de Equipo aliado otorga +1/+1 adicional permanente. Si su portador muere, el Objeto vuelve a tu mano.',
 tg:[{k:'unidadAliada',min:1,max:1,f:u=>u.objs.some(o=>CARDS[o]&&CARDS[o].equip)}],
 req:(g,s)=>P(s).field.some(u=>u.objs.some(o=>CARDS[o]&&CARDS[o].equip)),
 cast:async(g,s,ts)=>{ const u=ts[0][0]; u.pA++; u.pH++; u.armaMagica=true;
   log(`El arma de ${u.card.n} brilla: +1/+1.`); }});

C('palabracuracion',{n:'Palabra de Curación',t:'hechizo',c:1,sub:['cancion','rapido'],r:0,art:'💚',
 x:'<b>Rápido.</b> Restaura 3 PV a un aliado o 3 Alma a ti.',
 fast:true, heal:true,
 tg:[{k:'unidadAliada',min:0,max:1}],
 cast:async(g,s,ts)=>{ const u=ts&&ts[0]&&ts[0][0];
   if(u){ healU(u,3); } else { P(s).alma=Math.min(30,P(s).alma+3); log('Palabra de Curación: +3 Alma.','heal'); } }});

C('taumaturgia',{n:'Taumaturgia',t:'hechizo',c:1,sub:['fe'],r:0,art:'🕯️',
 x:'Tus Discípulos ganan +1/+0 hasta el final del turno. Si controlas 3 o más, roba 1 carta.',
 cast:async(g,s)=>{ const d=P(s).field.filter(u=>u.tribes.includes('Discípulo'));
   d.forEach(u=>u.tA++); log(`Taumaturgia: ${d.length} Discípulo(s) +1 ATQ.`);
   if(d.length>=3) await draw(s,1); }});

/* ---------------------- TRAMPAS ---------------------- */

C('tasha',{n:'Risa Incontrolable de Tasha',t:'trampa',c:2,r:0,art:'🤣',
 x:'<b>Cuando un Personaje rival declara un ataque:</b> el ataque se cancela y queda <b>Aturdido</b>.',
 on:'ataque', can:(g,s,ev)=>true,
 fire:async(g,s,ev)=>{ ev.cancel=true; stun(ev.att);
   log(`El chiste del aeropuerto deja a ${ev.att.card.n} <b>Aturdido</b>.`,'dmg'); }});

C('destello',{n:'Destello Protector',t:'trampa',c:2,r:0,art:'🔆',
 x:'<b>Cuando el rival saca 15+ en un d20 o va a hacer daño letal a un aliado:</b> obliga a repetir con el peor resultado, o reduce ese daño a la mitad.',
 on:'letal', can:(g,s,ev)=>true,
 fire:async(g,s,ev)=>{ ev.halve=true; log('<b>Destello Protector</b>: el daño se reduce a la mitad.','heal'); }});

C('gemaconserje',{n:'Gema del Conserje',t:'trampa',c:3,r:1,art:'💎',
 x:'<b>Cuando un aliado muere por un ataque directo:</b> el atacante queda <b>Poseído</b> — pierde la mitad de su ATQ y todas sus habilidades.',
 on:'muerteAliadaCombate', can:(g,s,ev)=>ev.att&&ev.att.alive,
 fire:async(g,s,ev)=>{ possess(ev.att); log(`${ev.att.card.n} escucha voces: <b>Poseído</b>.`,'dmg'); }});

C('colapso',{n:'Colapso de Paja',t:'trampa',c:3,r:1,art:'🔥',
 x:'<b>Cuando un Personaje rival de Costo 4 o más ataca:</b> 4 daño de fuego, su ataque se cancela y queda <b>Aturdido</b>.',
 on:'ataque', can:(g,s,ev)=>ev.att.card.c>=4,
 fire:async(g,s,ev)=>{ ev.cancel=true; log('¡La escalera de paja se quema!','dmg');
   await dmgU(ev.att,4,{fire:true,src:'trampa'}); if(ev.att.alive) stun(ev.att); }});

C('notario',{n:'Contrato del Notario Infernal',t:'trampa',c:4,sub:['contrato'],r:1,art:'🖋️',
 x:'<b>Cuando el rival juega un Hechizo de Costo 3+ o usa su Habilidad de Líder:</b> se anula. Ambos descartan 1 al azar. Cuenta como <b>Contrato</b>.',
 contract:true,
 on:'hechizoOHabilidad', can:(g,s,ev)=>ev.kind==='lider'||CARDS[ev.cardId].c>=3,
 fire:async(g,s,ev)=>{ ev.countered=true; log('El Notario Infernal anula la jugada.','dmg');
   await discardRandom(0,1); await discardRandom(1,1); }});

C('peaje',{n:'Peaje del Puente',t:'trampa',c:1,r:0,art:'🪙',
 x:'<b>Cuando el rival ataca a tu Alma:</b> paga 1 PD o el ataque se cancela. Si paga, tú ganas 1 PD en tu siguiente turno.',
 on:'ataqueAlma', can:(g,s,ev)=>true,
 fire:async(g,s,ev)=>{ const f=1-s;
   if(P(f).pd>=1){ const c=await ask(f,'Peaje del Puente: ¿pagar 1 PD para continuar el ataque?',
       ['Pagar 1 PD','Cancelar el ataque'],()=>0);
     if(c===0){ P(f).pd--; P(s).pdBonus=(P(s).pdBonus||0)+1; log('El rival paga el peaje. Ganarás 1 PD.','sys'); return; } }
   ev.cancel=true; log('Sin peaje no se pasa: ataque cancelado.','sys'); }});

C('esporas',{n:'Esporas del Demonio',t:'trampa',c:2,r:0,art:'🦠',
 x:'<b>Cuando un aliado muere:</b> todos los Personajes rivales quedan <b>Infectados</b>.',
 on:'muerteAliada', can:(g,s,ev)=>P(1-s).field.length>0,
 fire:async(g,s,ev)=>{ P(1-s).field.forEach(u=>infect(u));
   log('Esporas del Demonio: todo el campo rival queda Infectado.','dmg'); }});

/* El requisito de controlar un Dragón la dejaba muerta: el único Dragón de peso
   del mazo de Talesin cuesta 10 PD, así que la condición no se cumplía nunca y
   el banco la marcaba tanda tras tanda como trampa que jamás salta. Sin él hace
   lo que promete —que tus muertos vuelvan un turno más—, que es justo el plan de
   Talesin. Medido: +1,3 a Talesin y ninguna trampa muerta en el juego. */

C('talcadaver',{n:'Tal Habla por el Cadáver',t:'trampa',c:3,r:1,art:'🐉',
 x:'<b>Cuando un aliado muere:</b> vuelve al campo con 1 PV y +2 ATQ hasta el final del turno rival. Después muere de nuevo.',
 on:'muerteAliada', can:(g,s,ev)=>P(s).field.length<5&&!ev.token,
 fire:async(g,s,ev)=>{ const u=mkUnit(ev.cardId,s); u.dmg=Math.max(0,statHp(u)-1); u.pA+=2; u.doomed=true;
   P(s).field.push(u); recalc(); log(`Tal habla por el cadáver de ${u.card.n}.`); }});

/* ---------------------- OBJETOS ---------------------- */

C('collar',{n:'Collar Mágico de Agua',t:'objeto',c:2,r:0,art:'📿',equip:true,mod:{a:0,h:3},
 x:'<b>Equipo.</b> +0/+3 e inmunidad al daño de Fuego.', grants:{fireProof:true}});

C('arco',{n:'Arco Dorado de Juan',t:'objeto',c:3,r:0,art:'🏹',equip:true,mod:{a:2,h:0},
 x:'<b>Equipo.</b> +2 ATQ y <b>Arquero</b>.', gkeys:['arquero']});

C('mazo',{n:'Mazo de Brock',t:'objeto',c:2,r:0,art:'🔨',equip:true,mod:{a:3,h:0},
 x:'<b>Equipo.</b> +3 ATQ. Pierde Sigilo y Vuelo (pesa demasiado).', strips:['sigilo','vuelo']});

C('sombrero',{n:'Sombrero de Brick',t:'objeto',c:1,r:0,art:'🎩',equip:true,mod:{a:0,h:0},
 x:'<b>Equipo.</b> Gana <b>Sigilo</b> hasta que ataque.', gkeys:['sigilo']});

C('jabon',{n:'Barra de Jabón',t:'objeto',c:1,r:0,art:'🧼',equip:true,mod:{a:0,h:0},
 x:'<b>Equipo.</b> No puede ser objetivo de Hechizos de Engaño. Si muere, recuperas Copia de Jabón de las Alcantarillas.',
 grants:{enganoProof:true},
 onHolderDie:async(g,s,u)=>{ const i=P(s).grave.indexOf('copiajabon');
   if(i>=0){ P(s).grave.splice(i,1); P(s).hand.push('copiajabon');
     log('La Barra de Jabón devuelve Copia de Jabón a tu mano.');
     fxNotice('🧼 La Barra de Jabón recupera Copia de Jabón','var(--c-objeto)'); } }});

C('puntosrobados',{n:'Puntos Robados',t:'objeto',c:2,r:0,art:'💰',relic:true,
 x:'<b>Reliquia.</b> Gana 1 contador cada vez que muere un Personaje rival. Sacrifícala: ganas PD igual a los contadores (máx 4).',
 relicAct:{n:'Cobrar',cost:0,do:async(g,s,r)=>{ const n=Math.min(4,r.counters||0);
   P(s).pd+=n; log(`Puntos Robados: +${n} PD.`); sacRelic(s,r); }}});

C('llavemago',{n:'Llave del Mago',t:'objeto',c:3,r:2,art:'🗝️',relic:true,keyRelic:true,
 x:'<b>Reliquia.</b> Cuenta como 1 <b>Llave del Domo</b>. Si un rival fuera a robarla, se destruye en su lugar.'});

C('pergamino',{n:'Pergamino de Deseo Ilimitado',t:'objeto',c:7,r:2,art:'📜',relic:true,scroll:true,
 x:'<b>Reliquia.</b> Solo con <b>2+ Llaves</b> (o controlando a Tal). Al inicio de tu <b>segundo</b> turno con él en el campo, <b>ganas la partida</b>. Si lo pierdes, pierdes todas tus Llaves.',
 req:(g,s)=>(keys(s)>=2||P(s).field.some(u=>u.card.id==='tal')) && !P(1-s).field.some(u=>u.card.blockScroll)});

/* ---------------------- LUGARES ---------------------- */

C('tomsage',{n:'Tomsage bajo asedio',t:'lugar',c:2,r:0,art:'🏰',
 x:'Trol, Ogro y Goblin ganan +1/+1. Al inicio de cada turno, el jugador activo pierde 1 PD máximo.',
 aura:(g)=>{ [0,1].forEach(s=>P(s).field.forEach(u=>{
   if(u.tribes.some(t=>['Trol','Ogro','Goblin'].includes(t))){u.aA++;u.aH++;} })); },
 onAnyStart:async(g,s)=>{ P(s).pd=Math.max(0,P(s).pd-1); log('Tomsage bajo asedio: −1 PD.','sys'); }});

C('antro',{n:'Antro Juan',t:'lugar',c:2,r:0,art:'🍻',
 x:'En la Fase Final, cada jugador puede pagar 2 PD para robar 1 carta. Los Valoria tienen +0/+1.',
 aura:(g)=>{ [0,1].forEach(s=>P(s).field.forEach(u=>{ if(u.tribes.includes('Valoria')) u.aH++; })); },
 endPhase:true});

C('puente',{n:'El Puente de Brick y Brock',t:'lugar',c:1,r:0,art:'🌉',
 x:'Ningún Personaje puede atacar al Alma salvo que su controlador tire d20 y saque 8+.',
 riddleBridge:true});

C('montanas',{n:'Las Montañas de Tal',t:'lugar',c:3,r:1,art:'⛰️',
 x:'Los Dragones cuestan 2 PD menos. Al inicio de cada turno, el jugador activo tira d20: con 1-3, Aidman aparece en el campo rival.',
 dragonDiscount:true,
 onAnyStart:async(g,s)=>{ const r=await roll('Las Montañas de Tal', null,
     {necesita:'4 o más para que no pase nada', min:4,
      siOk:'No aparece nadie', siMal:'¡Aidman aparece en el campo rival!'});
   if(r<=3 && P(1-s).field.length<5 && !P(1-s).field.some(u=>u.card.id==='aidman')){
     const u=mkUnit('aidman',1-s); P(1-s).field.push(u); recalc();
     log('¡Aidman aparece en el campo rival buscando trabajo!','sys'); } }});

C('domo',{n:'El Domo',t:'lugar',c:4,r:1,art:'🔴',
 x:'Cada vez que un Personaje muere, su controlador pierde 1 Alma y el otro gana 1 PD. Las Llaves del Domo se ganan al doble.',
 domeDeath:true, doubleKeys:true});

/* ==========================================================================
   2b. EL CAJÓN — cartas nuevas, todavía fuera de los mazos
   --------------------------------------------------------------------------
   Salen de los episodios y están hechas con el mismo vocabulario que el resto:
   nada aquí necesita reglas nuevas, sólo piezas que el motor ya sabe resolver
   —Aturdido, Infectado, Poseído, Prisa, Sigilo, Arquero, fichas, daño de fuego.

   Llevan set:'cajon' y NO están en ningún mazo: se ven en «Ver todas las
   cartas» y se prueban ahí antes de decidir dónde entran. Cuando una se gane su
   sitio, basta con meterla en la lista de un mazo.
   ========================================================================== */

/* ---- fichas del cajón ---- */

C('tok_rulchete',{n:'Rulchete',t:'personaje',c:2,a:0,h:6,tr:['Dragón','Goblin'],r:0,art:'🐲',set:'cajon',
 x:'<b>Provocar.</b> Ficha. Un dragón morado de bajo presupuesto: no pega, pero aguanta.',
 keys:['provocar'], token:true});

/* ---- hechizos ---- */

C('gatobachatero',{n:'El Gato Bachatero',t:'hechizo',c:3,sub:['engano'],r:0,art:'🐈',set:'cajon',
 x:'Los Personajes rivales de Costo 2 o menos quedan <b>Aturdidos</b>: se quedan mirando el baile.',
 req:(g,s)=>P(1-s).field.some(u=>u.card.c<=2),
 cast:async(g,s)=>{ let k=0;
   for(const u of P(1-s).field) if(u.alive && u.card.c<=2){ stun(u); k++; }
   log(`🐈 El gato baila bachata: ${k} rival${k===1?'':'es'} <b>Aturdido${k===1?'':'s'}</b>.`,'dmg'); }});

C('fetichemino',{n:'Fetiche de Minotauro',t:'hechizo',c:2,r:0,art:'🥛',set:'cajon',
 x:'Un Personaje rival <b>Bestia</b> o <b>Minotauro</b> queda <b>Aturdido</b> y tú robas 1 carta.',
 tg:[{k:'unidadEnemiga',min:1,max:1,f:u=>u.tribes.includes('Bestia')||u.tribes.includes('Minotauro')}],
 req:(g,s)=>P(1-s).field.some(u=>u.tribes.includes('Bestia')||u.tribes.includes('Minotauro')),
 cast:async(g,s,ts)=>{ const u=ts[0][0]; stun(u);
   log(`${u.card.n} suelta la guardia por una cubeta de leche.`,'dmg'); await draw(s,1); }});

C('brujula',{n:'Brújula «She vale el doble»',t:'hechizo',c:2,r:0,art:'🧭',
 x:'2 daño a un Personaje rival. Si eso lo mata, robas 2 cartas: valía el doble.',
 tg:[{k:'unidadEnemiga',min:1,max:1}],
 req:(g,s)=>P(1-s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0];
   await dmgU(u,2,{src:'hechizo'});
   if(!u.alive){ log('La brújula tenía razón: <b>valía el doble</b>. Robas 2.','good'); await draw(s,2); } }});

C('viajehongos',{n:'Viaje de Hongos de Rantiago',t:'hechizo',c:2,r:0,art:'🍄',set:'cajon',
 x:'Un aliado gana <b>+2/+2 permanentes</b> pero queda <b>Aturdido</b>: se siente gigante e intangible.',
 tg:[{k:'unidadAliada',min:1,max:1}],
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0]; u.pA+=2; u.pH+=2; stun(u); recalc();
   log(`${u.card.n} se siente <b>gigante</b> (+2/+2) y no vuelve en sí este turno.`); }});

C('humobob',{n:'El Humo de Bob Carly',t:'hechizo',c:3,r:0,art:'💨',set:'cajon',
 x:'Todos tus Personajes curan 2 PV y ganan <b>Sigilo</b> hasta que ataquen.',
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s)=>{ for(const u of P(s).field) if(u.alive){ healU(u,2); addKey(u,'sigilo'); }
   log('💨 Sándalo por toda la planicie: tu campo cura 2 y se esconde.','heal'); }});

C('propaganda',{n:'Propaganda Electoral',t:'hechizo',c:4,sub:['engano'],r:1,art:'📢',set:'cajon',
 x:'Todos los Personajes rivales de tribu <b>Elfo</b> o <b>Elfa</b> quedan <b>Poseídos</b>: pierden la mitad de su ATQ y sus habilidades.',
 req:(g,s)=>P(1-s).field.some(u=>u.tribes.includes('Elfo')||u.tribes.includes('Elfa')),
 cast:async(g,s)=>{ let k=0;
   for(const u of P(1-s).field) if(u.alive && (u.tribes.includes('Elfo')||u.tribes.includes('Elfa'))){ possess(u); k++; }
   log(`📢 «Vota por el candidato de la fe»: ${k} elfo${k===1?'':'s'} radicalizado${k===1?'':'s'}.`,'dmg'); }});

C('ballesta',{n:'Ballesta de Triple Disparo',t:'hechizo',c:3,r:0,art:'🏹',set:'cajon',
 x:'1 daño a tres Personajes rivales distintos.',
 req:(g,s)=>P(1-s).field.length>0,
 cast:async(g,s)=>{ log('🏹 Tres tiros seguidos.','dmg');
   for(const u of [...P(1-s).field].slice(0,3)) if(u.alive) await dmgU(u,1,{src:'hechizo'}); }});

C('lanzallamas',{n:'Lanzallamas de Desodorante',t:'hechizo',c:2,sub:['fuego'],r:0,art:'🧯',set:'cajon',
 x:'3 daño de <b>Fuego</b> a un Personaje rival. El fuego le impide regenerar este turno.',
 tg:[{k:'unidadEnemiga',min:1,max:1}],
 req:(g,s)=>P(1-s).field.length>0,
 cast:async(g,s,ts)=>{ log('🧯 Desodorante y encendedor: fuego improvisado.','dmg');
   await dmgU(ts[0][0],3,{fire:true,src:'hechizo'}); }});

C('lifestealer',{n:'Espada Life Stealer',t:'hechizo',c:3,r:1,art:'🗡️',set:'cajon',
 x:'Un aliado gana <b>+2/+0 permanentes</b> y tú ganas <b>3 Alma</b>: la hoja devuelve lo que quita.',
 tg:[{k:'unidadAliada',min:1,max:1}],
 req:(g,s)=>P(s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0]; u.pA+=2; recalc();
   P(s).alma+=3; log(`${u.card.n} empuña la Life Stealer: +2 ATQ y 3 Alma para ti.`,'heal'); }});

C('lecheslact',{n:'El Vaso de Leche Deslactosada',t:'hechizo',c:1,sub:['fe'],r:0,art:'🥛',set:'cajon',
 x:'Un Personaje se calma: queda <b>Aturdido</b>. Si es tuyo, además cura 3 PV.',
 tg:[{k:'unidad',min:1,max:1}],
 req:(g,s)=>P(0).field.length+P(1).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0]; stun(u);
   if(u.side===s){ healU(u,3); log(`${u.card.n} se toma su leche y se relaja (+3 PV).`,'heal'); }
   else log(`${u.card.n} baja la guardia: hasta los psicópatas toman leche.`,'dmg'); }});

C('rulchetebajo',{n:'Rulchete de Bajo Presupuesto',t:'hechizo',c:3,sub:['fe'],r:0,art:'🐲',
 x:'Invoca a <b>Rulchete</b> 0/6 con <b>Provocar</b>: un dragón morado que sólo sirve para ponerse delante.',
 req:(g,s)=>P(s).field.length<5,
 cast:async(g,s)=>{ await summonToken(s,'tok_rulchete',{msg:'🐲 ¡Rulchete se interpone!'}); }});

C('esporashorton',{n:'Esporas de Sir Horton',t:'hechizo',c:3,r:1,art:'🍄',set:'cajon',
 x:'Un Personaje rival queda <b>Infectado</b> y <b>Poseído</b>: ve cosas y ya no distingue a los suyos.',
 tg:[{k:'unidadEnemiga',min:1,max:1}],
 req:(g,s)=>P(1-s).field.length>0,
 cast:async(g,s,ts)=>{ const u=ts[0][0]; infect(u); possess(u); recalc();
   log(`A ${u.card.n} le brotan hongos en los ojos.`,'dmg'); }});

/* ---- objetos ---- */

C('lentesmachete',{n:'Los Lentes de Machete',t:'objeto',c:2,r:1,art:'👓',set:'cajon',equip:true,mod:{a:1,h:0},
 x:'<b>Equipo.</b> +1 ATQ y <b>Arquero</b>: golpea sin recibir contraataque. Es lo único que quedó de él.',
 gkeys:['arquero']});

C('espadaluz',{n:'Espada de Luz Celestial',t:'objeto',c:3,r:1,art:'⚔️',set:'cajon',equip:true,mod:{a:3,h:0},
 x:'<b>Equipo.</b> +3 ATQ e inmunidad a los Hechizos de <b>Engaño</b>: la luz no se deja embaucar.',
 grants:{enganoProof:true}});

C('brazosagua',{n:'Brazos de Agua de Barril',t:'objeto',c:3,r:0,art:'🌊',set:'cajon',equip:true,mod:{a:1,h:2},
 x:'<b>Equipo.</b> +1/+2, <b>Arquero</b> e inmunidad al daño de <b>Fuego</b>.',
 gkeys:['arquero'], grants:{fireProof:true}});

C('ipadkid',{n:'El iPad Kid Silenciado',t:'objeto',c:1,r:0,art:'🎧',set:'cajon',equip:true,mod:{a:0,h:3},
 x:'<b>Equipo.</b> +0/+3 e inmune a los Hechizos de <b>Engaño</b>: con los auriculares puestos no se entera de nada.',
 grants:{enganoProof:true}});

C('espadaboveda',{n:'Espada Común de la Bóveda',t:'objeto',c:1,r:0,art:'🗡️',set:'cajon',equip:true,mod:{a:1,h:0},
 x:'<b>Equipo.</b> +1 ATQ. Una espada pitera del catálogo de la bóveda, pero es lo que había.'});

/* ---- trampas ---- */

C('eclipse',{n:'El Eclipse Arrugado',t:'trampa',c:2,r:0,art:'🌑',set:'cajon',
 x:'<b>Cuando ataca un Personaje rival con Objetos:</b> se le destruye todo el equipo y queda al descubierto.',
 on:'ataque', can:(g,s,ev)=>ev.att&&ev.att.objs.length>0,
 fire:async(g,s,ev)=>{ const u=ev.att;
   log(`El eclipse pilla a ${u.card.n} sin ropa: su equipo se destruye.`,'dmg');
   for(const id of [...u.objs]) await destroyObject(1-s,{id,unit:u});
   u.noFly=true; recalc(); }});

C('afterparty',{n:'Invitación al After Party',t:'trampa',c:3,r:1,art:'🎉',set:'cajon',
 x:'<b>Cuando ataca un Personaje rival de Costo 4 o más:</b> el ataque se cancela y vuelve a la mano de su dueño.',
 on:'ataque', can:(g,s,ev)=>ev.att&&ev.att.card.c>=4,
 fire:async(g,s,ev)=>{ ev.cancel=true;
   log(`${ev.att.card.n} se va al after con las reptilukis.`,'sys'); bounce(ev.att); }});

C('ciclope',{n:'Juguetes para el Cíclope',t:'trampa',c:2,r:0,art:'👁️',
 x:'<b>Cuando un Personaje rival ataca:</b> el ataque se cancela y aparecen 2 <b>Ilusiones</b> de señuelo.',
 on:'ataque', can:(g,s,ev)=>true,
 fire:async(g,s,ev)=>{ ev.cancel=true;
   log('«Son juguetes interactivos, míralos»: el ataque se pierde.','sys');
   for(let i=0;i<2;i++) if(P(s).field.length<5) await summonToken(s,'tok_ilusion'); }});

C('ladrillos',{n:'Ladrillos de Edo Mex',t:'trampa',c:1,r:0,art:'🧱',set:'cajon',
 x:'<b>Cuando ataca un Personaje rival con Prisa o Vuelo:</b> el ataque se cancela y queda <b>Aturdido</b>. Sin llantas no va a ningún lado.',
 on:'ataque', can:(g,s,ev)=>ev.att&&(ev.att.keys.has('prisa')||ev.att.keys.has('vuelo')),
 fire:async(g,s,ev)=>{ ev.cancel=true; stun(ev.att);
   log(`${ev.att.card.n} amanece sobre ladrillos: sin llantas.`,'dmg'); }});

C('lutorafaela',{n:'Luto Dramático de Rafaela',t:'trampa',c:2,r:0,art:'😭',set:'cajon',
 x:'<b>Cuando muere un aliado:</b> tus Personajes ganan <b>+2 ATQ</b> hasta el final del turno.',
 on:'muerteAliada', can:(g,s,ev)=>true,
 fire:async(g,s,ev)=>{ let k=0; P(s).field.forEach(u=>{ if(u.alive){ u.tA+=2; k++; } }); recalc();
   log(`El llanto de Rafaela enciende a ${k} aliado${k===1?'':'s'} (+2 ATQ).`,'good'); }});

/* ---- NPCs del Domo ----
   Personajes que aparecen en los episodios y que no tenían carta. El Cajón
   estaba lleno de Hechizos, Objetos y Trampas y no tenía ni un solo cuerpo:
   24 cartas y ningún Personaje. Un mazo del Dungeon Master —que reparte NPCs,
   no aventureros— no se puede armar sin ellos. */

C('tok_goblincamino',{n:'Goblin de Camino',t:'personaje',c:1,a:1,h:1,tr:['Goblin'],r:0,art:'🪓',
 x:'<b>Provocar.</b> Ficha. Uno de los goblins que Can pone en el camino.',
 keys:['provocar'], token:true});

C('can',{n:'Can, el de los Goblins',t:'personaje',c:4,a:2,h:4,tr:['Humano'],r:1,art:'🛻',
 x:'<b>Interceptar — al entrar:</b> invoca dos <b>Goblins de Camino</b> 1/1 con <b>Provocar</b>.',
 enter:async(g,s,u)=>{ for(let i=0;i<2;i++) await summonToken(s,'tok_goblincamino',
   {msg:'🪓 Can pone un goblin en el camino.'}); }});

C('spiderman',{n:'Spider-Man',t:'personaje',c:3,a:2,h:4,tr:['Bestia','Araña'],r:1,art:'🕷️',
 x:'<b>Disfraz — al entrar:</b> un Personaje rival queda <b>Aturdido</b> del susto. Mientras controles <b>Antro Juan</b>, +2/+2.',
 enterTg:{k:'unidadEnemiga',min:0,max:1,label:'quien se lleva el susto'},
 enter:async(g,s,u,ts)=>{ const t=ts&&ts[0]&&ts[0][0]; if(!t) return;
   stun(t); log(`${t.card.n} descubre que el bartender es una araña: <b>Aturdido</b>.`,'dmg'); },
 aura:(g,s,u)=>{ if(G.place && G.place.id==='antro' && G.place.side===s){ u.aA+=2; u.aH+=2; } }});

C('hermanotrol',{n:'El Hermano del Trol',t:'personaje',c:5,a:5,h:6,tr:['Trol'],r:1,art:'🪨',
 x:'<b>Regeneración:</b> recupera 2 PV al inicio de tu turno. Inmune al daño de <b>Fuego</b>. <b>Al entrar:</b> busca el <b>Collar Mágico de Agua</b> en tu mazo.',
 keys:['regeneracion'], fireProof:true,
 enter:async(g,s,u)=>{ await search(s,c=>c==='collar','Collar Mágico de Agua'); }});

C('rambo',{n:'Rambo',t:'personaje',c:1,a:3,h:1,tr:['Goblin'],r:0,art:'🎽',
 x:'<b>Prisa.</b> Debe atacar si puede. <b>Al final del turno, muere:</b> entró solo al campo de batalla.',
 keys:['prisa'], mustAttack:true,
 enter:async(g,s,u)=>{ u.doomed=G.turnNo; }});

C('coyote',{n:'El Coyote',t:'personaje',c:3,a:2,h:3,tr:['Humano'],r:1,art:'🌵',
 x:'<b>Cruzar la frontera (2 PD):</b> un aliado ignora <b>Provocar</b> hasta el final del turno. Por un trato de negocios, claro.',
 act:{cost:2,n:'Cruzar la frontera',tg:{k:'unidadAliada',min:1,max:1},
   req:(g,s)=>P(s).field.length>0,
   do:async(g,s,u,ts)=>{ const t=ts[0][0]; t.tIgnoreTaunt=true;
     log(`El Coyote cruza a ${t.card.n} por debajo: ignora Provocar este turno.`); }}});

C('correcaminos',{n:'El Correcaminos',t:'personaje',c:2,a:2,h:2,tr:['Bestia'],r:1,art:'🏃',
 x:'<b>Prisa.</b> Debe atacar si puede. Si <b>El Coyote</b> está en <i>cualquier</i> campo, gana <b>+2 ATQ</b>.',
 keys:['prisa'], mustAttack:true,
 aura:(g,s,u)=>{ if([...P(0).field,...P(1).field].some(o=>o.card.id==='coyote')) u.aA+=2; }});

C('lanzallave',{n:'Lanzamiento de Llave Desesperado',t:'trampa',c:2,r:1,art:'🗝️',set:'cajon',
 x:'<b>Cuando muere un aliado:</b> alcanza la llave y escapa del Domo — su carta vuelve a tu mano.',
 on:'muerteAliada', can:(g,s,ev)=>ev.cardId && !ev.token,
 fire:async(g,s,ev)=>{ P(s).hand.push(ev.cardId);
   log(`${CARDS[ev.cardId].n} atrapa la llave al vuelo y escapa del Domo: vuelve a tu mano.`,'good');
   render(); }});

/* ==========================================================================
   3. MAZOS PRECONSTRUIDOS (40 cartas)
   ========================================================================== */

const DECKS = {
mohamed:{ n:'El Mago Pitero', d:'Control · Engaño · Llaves',
  plan:'Haz que atacarte sea caro, limpia con Golpe a Sangre Fría y junta 2 Llaves para el Pergamino.',
  list:[['conserje',2],['machete',2],['brickbrock',3],['bartolomeo',2],['minus',2],['rantiago',1],
        ['trol',1],['lucy',1],['magodomo',1],['ilusion',3],['mensaje',2],['sangrefria',3],
        ['acertijo',2],['disipar',2],['peaje',2],['notario',1],['tasha',1],['sombrero',1],
        ['jabon',1],['llavemago',1],['pergamino',1],['puente',1],['bolafuego',1],['nubedagas',2],
        ['escarcha',1]]},
fender:{ n:'Gira Mundial', d:'Aggro · Canciones · Tempo',
  plan:'Llena el campo turnos 1-3, dale Prisa con Bob Carly y remata con Balada + Sube el Volumen.',
  list:[['discipulo',3],['matildus',3],['machete',1],['bartolomeo',3],['adolfo',3],['petunia',1],
        ['titaus',1],['eric',3],['cantaberna',3],['burla',3],['balada',3],['zancada',3],
        ['pasoatronador',1],['tasha',2],['destello',1],['sombrero',1],['mazo',1],['antro',1],
        ['escarcha',3]]},
adreida:{ n:'De Frente', d:'Midrange · Paladines · Provocar',
  plan:'Juega en curva cuerpos de 4+ ATQ que con Intimidante ganan Provocar, y fuerza intercambios favorables.',
  list:[['machete',3],['bartolomeo',3],['augusto',3],['eric',1],['brickbrock',1],['lucius',1],['horton',1],['aldrick',1],['auxilio',3],['armadura',3],['zancada',3],['saeta',3],['modificar',1],['destello',2],['colapso',2],['esporas',1],['collar',3],['tomsage',1],['ninolanza',3],['mazo',1]]},
gero:{ n:'La Mesa del DM', d:'Caos · Tiradas · NPCs',
  plan:'Llena la mesa de NPCs y aguanta: con El Rey y otros tres en pie, la campaña termina.',
  list:[['brickbrock',3],['minus',3],['aidman',3],['can',3],['rambo',3],['correcaminos',2],
        ['coyote',2],['spiderman',2],['bob',2],['rantiago',2],['hermanotrol',2],['machete',2],
        ['lucy',1],['juangabriel',1],['rey',1],
        ['rulchetebajo',2],['acertijo',2],['brujula',2],['ciclope',1],['peaje',1]]},
rafaela:{ n:'Los Doce Discípulos', d:'Enjambre · Fe · Aguante',
  plan:'Cada Discípulo que entra cura 2. Aguanta, escala el enjambre y cierra con Rulchete.',
  list:[['discipulo',3],['matildus',3],['machete',2],['adolfo',2],['titaus',3],['julia',1],
        ['petunia',1],['minus',1],['juangabriel',1],['taumaturgia',3],['bendicion',2],['leche',2],
        ['manosardientes',2],['saeta',3],['auxilio',1],['espiritus',2],['ceguera',1],['rulchete',1],
        ['destello',2],['esporas',1],['collar',1],['jabon',1],['antro',1]]},
talesin:{ n:'Ascensión', d:'Sacrificio · Rampa · Tal',
  plan:'Todo en este mazo quiere morir. Junta 5 Fichas de Gracia, asciende y baja a Tal en el turno 7.',
  list:[['conserje',3],['matildus',3],['machete',1],['petunia',1],['eric',3],['bob',1],
        ['rantiago',1],['horton',1],['aidman',1],['edbor',1],['rayoabrasador',2],['proyectil',2],
        ['alientoacido',2],['disipar',2],['cuerda',1],['hongos',1],['esporas',2],['talcadaver',2],
        ['puntosrobados',2],['llavemago',1],['pergamino',1],['domo',1],['escarcha',2],['nubedagas',1],
        ['tal',1],['montanas',1]]},
};

function buildDeck(id){ const out=[]; DECKS[id].list.forEach(([c,n])=>{ for(let i=0;i<n;i++) out.push(c); }); return out; }

/* ==========================================================================
   4. ESTADO Y MOTOR
   ========================================================================== */

let G = null;

let UID = 1;

const P = s => G.pl[s];

const ME = 0, FOE = 1;

function newPlayer(side, leaderId){
  return { side, leaderId, L:LEADERS[leaderId],
    deck:shuffle(buildDeck(leaderId)), hand:[], field:[], traps:[], grave:[], relics:[],
    alma:20, pd:0, pdMax:0, banked:0, llaves:0, pdTax:0, pdBonus:0,
    leaderUsed:false, attacked:false, petuniaUsed:false, gracia:0, ascended:false,
    scrollTurns:0, limbo:[], clouds:[], spirits:0, fairy:false, kdrama:false,
    manoRehecha:false };
}

function newGame(myLeader, foeLeader, opts={}){
  G = { pl:[newPlayer(0,myLeader), newPlayer(1,foeLeader)],
        active:0, turnNo:0, phase:'inicio', over:false, log:[],
        place:null, diedThisTurn:[], busy:false, fast:false, tutorial:!!opts.tutorial,
        firstDraw:true };
  return G;
}

function statBase(u,k){ return u.card[k]||0; }

function statHp(u){ return u.maxHp; }

function keys(s){ return P(s).llaves + P(s).relics.filter(r=>CARDS[r.id].keyRelic).length; }

function hasKey(u,k){ return u.keys.has(k); }

function addKey(u,k){ u.keysOwn.add(k); recalc(); }

function hasTribe(u,t){ return u.tribes.includes(t); }

function allObjects(s){
  const out=[];
  P(s).field.forEach(u=>u.objs.forEach(o=>{ if(CARDS[o]) out.push({id:o,unit:u}); }));
  P(s).relics.forEach(r=>out.push({id:r.id,relic:r}));
  return out;
}

/* ---------- creación de unidades ---------- */
/* LA HERENCIA DE TALESIN.
   Su Ascensión pedía cinco muertos y premiaba a los vivos: para cuando llega, le
   quedan 0,96 Personajes en mesa y 0,24 Celestiales, así que el +2/+2 no
   alcanzaba a nadie 78 veces de cada 100. Medido sobre 150 partidas suyas.

   El arreglo no es darle más ni antes —con 3 Fichas de regalo se quedaba igual—
   sino que el premio no se acabe: lo que baje después de ascender también lo
   cobra. Va aquí, en mkUnit, porque es el sitio por el que pasa toda unidad que
   nace, venga de la mano, de una ficha o de una Trampa. Sube a Talesin de 41,0 a
   45,5 sobre 6000 partidas. */

function heredarAscension(u, side){
  const p = P(side);
  if(!p || p.leaderId!=='talesin' || !p.ascended) return u;
  if(!u.tribes.includes('Celestial')) u.tribes.push('Celestial');
  u.pA += 2; u.pH += 2;
  return u;
}

function mkUnit(cardId, side){
  const c = CARDS[cardId];
  const u = { uid:UID++, card:c, side, owner:side, tribes:[...(c.tr||[])],
    dmg:0, pA:0, pH:0, tA:0, tH:0, nA:0, nH:0, nUntil:-1, aA:0, aH:0,
    keysOwn:new Set(c.keys||[]), aKeys:new Set(), keys:new Set(),
    objs:[], alive:true, sick:true, attacked:false, attackedEver:false,
    stunned:0, infected:false, possessed:false, tookFire:false,
    atk:c.a||0, maxHp:c.h||1, actUsed:false, marked:false, noCounter:false,
    hotMetal:false, doomed:false, stolen:false, blind:false, revealed:false,
    noFly:false, trapProof:false, tIgnoreTaunt:false, noClause:false, killer:null };
  return heredarAscension(u, side);
}

/* ---------- recálculo de estadísticas y auras ---------- */
/* El umbral de Intimidante (Adreida). Es una variable y no un 4 suelto para
   que el banco de balance pueda medir qué cuesta moverlo: es la única pieza
   del mazo de Adreida cuyo recorte la baja. */

let INTIMIDANTE_MIN = 4;

function recalc(){
  if(!G) return;
  const all=[...P(0).field, ...P(1).field];
  all.forEach(u=>{ u.aA=0; u.aH=0; u.aKeys=new Set(); });

  // auras de lugar
  if(G.place && CARDS[G.place.id].aura) CARDS[G.place.id].aura(G);
  // auras de personajes
  all.forEach(u=>{ if(u.card.aura && !u.possessed) u.card.aura(G,u.side,u); });
  // pasiva de líder: Adreida (Intimidante) se aplica tras calcular ATQ, abajo

  all.forEach(u=>{
    let a=(u.card.a||0)+u.pA+u.tA+u.nA+u.aA;
    let h=(u.card.h||0)+u.pH+u.tH+u.nH+u.aH;
    u.objs.forEach(o=>{ const oc=CARDS[o]; if(oc&&oc.mod){ a+=oc.mod.a||0; h+=oc.mod.h||0; } });
    if(u.possessed) a=Math.floor(a/2);
    u.atk=Math.max(0,a); u.maxHp=Math.max(1,h);
    // keywords
    const k=new Set([...u.keysOwn, ...u.aKeys]);
    if(!u.possessed){
      u.objs.forEach(o=>{ const oc=CARDS[o]; if(oc&&oc.gkeys) oc.gkeys.forEach(x=>k.add(x)); });
      u.objs.forEach(o=>{ const oc=CARDS[o]; if(oc&&oc.strips) oc.strips.forEach(x=>k.delete(x)); });
    } else { k.clear(); }
    if(u.attackedEver) k.delete('sigilo');
    if(u.noFly) k.delete('vuelo');
    // Intimidante (Adreida)
    if(P(u.side).leaderId==='adreida' && u.atk>=INTIMIDANTE_MIN) k.add('provocar');
    u.keys=k;
  });
}

function grant(u,g){ // ¿algún objeto le da esta propiedad?
  if(u.card[g]) return true;
  return u.objs.some(o=>CARDS[o]&&CARDS[o].grants&&CARDS[o].grants[g]);
}

/* ---------- costos ---------- */

function costOf(cardId, s){
  const c=CARDS[cardId]; let cost=c.c;
  const p=P(s);
  if(c.t==='hechizo' && c.sub && c.sub.includes('engano') && p.leaderId==='mohamed') cost-=1;
  if(c.t==='trampa' && p.field.some(u=>u.card.id==='augusto')) cost-=1;
  if(c.t==='personaje' && c.tr && c.tr.includes('Noble') && p.field.some(u=>u.card.id==='bartolomeo')) cost-=1;
  if(c.id==='bolafuego' && p.field.some(u=>['augusto','lucius'].includes(u.card.id))) cost-=2;
  if(c.t==='personaje' && c.tr && c.tr.includes('Dragón') && G.place && CARDS[G.place.id].dragonDiscount) cost-=2;
  return Math.max(c.t==='hechizo'&&c.sub&&c.sub.includes('engano')?1:0, Math.max(0,cost));
}

/* ---------- daño y curación ---------- */

async function dmgU(u, n, opt={}){
  if(!u||!u.alive||n<=0||G.over) return 0;
  if(opt.fire){
    if(grant(u,'fireProof')){ log(`${u.card.n} es inmune al Fuego (Collar de Agua).`,'sys');
      const src=u.objs.find(o=>CARDS[o]&&CARDS[o].grants&&CARDS[o].grants.fireProof);
      fxObj(u, src||'collar', 'Inmune al Fuego'); await nap(700); return 0; }
    u.tookFire=true;
  }
  if(!opt.unstoppable && u.dmg+n >= u.maxHp){
    const ev={u,n,side:u.side,isRoll:false};
    await trapWindow(u.side,'letal',ev);
    if(ev.halve) n=Math.max(1,Math.floor(n/2));
    if(u.dmg+n >= u.maxHp){
      const eric=P(u.side).field.find(o=>o.card.guard&&o!==u&&o.alive&&!o.possessed);
      if(eric){
        const c=await ask(u.side,`${u.card.n} va a morir. ¿Eric se sacrifica en su lugar?`,
          ['Sí, Eric se interpone','No, que muera'],(g,s)=>(u.atk+u.maxHp>6?0:1));
        if(c===0){ log(`🛡️ Eric se interpone y salva a ${u.card.n}.`,'heal'); await destroy(eric); return 0; }
      }
    }
  }
  u.dmg+=n;
  if(opt.att) u.killer=opt.att;
  const golpe={inf:opt.src==='infeccion', fuego:!!opt.fire, letal:u.dmg>=u.maxHp};
  netFx('hit',{uid:u.uid,n,...golpe});
  log(`${u.card.n} recibe ${n} daño (${Math.max(0,u.maxHp-u.dmg)}/${u.maxHp}).`,'dmg');
  render();
  await fxHit(u, n, golpe);
  await checkDeaths();
  return n;
}

function healU(u,n){
  if(!u||!u.alive) return;
  const before=u.dmg; u.dmg=Math.max(0,u.dmg-n);
  if(before!==u.dmg){ log(`${u.card.n} recupera ${before-u.dmg} PV.`,'heal'); render();
    netFx('heal',{uid:u.uid,n:before-u.dmg}); fxHeal(u,before-u.dmg); }
}

async function dmgFace(s,n,opt={}){
  if(G.over) return;
  P(s).alma-=n;
  log(`<b>${P(s).L.n}</b> pierde ${n} Alma → ${Math.max(0,P(s).alma)}.`,'dmg');
  render();
  netFx('face',{side:(s===FOE?0:1),n});
  await fxFace(s,n);
  if(P(s).alma<=0) endGame(1-s, 'El Mago del Domo reclama el alma de '+P(s).L.n+'.');
}

/* ---------- muerte ---------- */

async function checkDeaths(){
  let guard=0;
  while(guard++<60 && !G.over){
    recalc();
    let u=null;
    for(const s of [0,1]){ const f=P(s).field.find(x=>x.alive&&x.dmg>=x.maxHp); if(f){u=f;break;} }
    if(!u) break;
    await killUnit(u);
  }
  recalc(); render();
}

async function destroy(u,opt={}){
  if(!u||!u.alive) return;
  await killUnit(u,opt);
  await checkDeaths();
}

async function killUnit(u, opt={}){
  if(!u.alive) return;
  const s=u.side;
  await fxDeath(u);                       // se anima mientras sigue en el campo
  const idx=P(s).field.indexOf(u); if(idx>=0) P(s).field.splice(idx,1);
  u.alive=false;
  G.diedThisTurn.push({id:u.card.id, side:s});
  log(`💀 <b>${u.card.n}</b> va a las Alcantarillas.`,'dmg');
  if(G.tutorial){ render(); await tutBeat('muerte',{u,side:s}); }

  // objetos equipados
  for(const o of u.objs){
    const oc=CARDS[o]; if(!oc) continue;
    if(u.armaMagica && oc.equip){ P(u.owner).hand.push(o); log(`${oc.n} vuelve a la mano (Arma Mágica).`,'sys');
      fxNotice('⚒️ '+oc.n+' vuelve a tu mano','var(--c-objeto)'); }
    else P(u.owner).grave.push(o);
    if(oc.onHolderDie) await oc.onHolderDie(G,u.owner,u);
  }
  u.objs=[];
  if(!u.card.token) P(u.owner).grave.push(u.card.id);

  // Nexo del Mago del Domo (ambos lados)
  for(const side of [0,1]) for(const m of P(side).field)
    if(m.card.nexus && m.alive && !m.possessed){ P(side).alma++; log(`Nexo: ${P(side).L.n} gana 1 Alma.`,'heal'); }
  // Puntos Robados del rival
  P(1-s).relics.forEach(r=>{ if(CARDS[r.id].id==='puntosrobados'){ r.counters=(r.counters||0)+1;
    render(); fxStat(1-s,'.stat.relic'); fxNotice('💰 Puntos Robados: '+r.counters,'var(--c-objeto)'); } });
  // Lugar El Domo
  if(G.place && CARDS[G.place.id].domeDeath){
    P(s).alma--; P(1-s).pd++;
    log('El Domo cobra: −1 Alma para su controlador, +1 PD para el rival.','sys');
    if(P(s).alma<=0){ endGame(1-s,'El Domo devora a '+P(s).L.n+'.'); return; }
  }
  // Talesin: Ficha de Gracia
  if(P(s).leaderId==='talesin' && !P(s).ascended){
    P(s).gracia++;
    log(`✨ Ficha de Gracia ${P(s).gracia}/5.`);
    if(P(s).gracia>=5){
      P(s).ascended=true; P(s).alma+=5;
      P(s).field.forEach(o=>{ if(o.tribes.includes('Celestial')){o.pA+=2;o.pH+=2;} });
      toast('😇 ¡TALESIN ASCIENDE!');
      log('<b>Talesyn asciende</b>: +5 Alma, Celestiales +2/+2, y a partir de ahora lo que baje nace Celestial con +2/+2.','heal');
    }
  }
  // trampas de muerte
  const ev={cardId:u.card.id, att:u.killer, token:!!u.card.token};
  await trapWindow(s,'muerteAliada',ev);
  if(u.killer) await trapWindow(s,'muerteAliadaCombate',ev);
  // habilidad Al morir
  if(!opt.silent && u.card.die && !u.possessed) await u.card.die(G,s,u);
  recalc();
}

/* ---------- estados ---------- */

function debuff(u,a,h){ u.nA+=a; u.nH+=h; u.nUntil=G.turnNo+1; recalc(); }

function stun(u){ if(!u||!u.alive) return; if(u.card.stunProof){log(`${u.card.n} es inmune a Aturdido.`,'sys');return;} u.stunned=2; }

function infect(u){ if(u&&u.alive) u.infected=true; }

function possess(u){ if(u&&u.alive){ u.possessed=true; recalc(); } }

function bounce(u){
  if(!u||!u.alive) return;
  const i=P(u.side).field.indexOf(u); if(i>=0) P(u.side).field.splice(i,1);
  u.alive=false;
  u.objs.forEach(o=>{ if(CARDS[o]) P(u.owner).grave.push(o); });
  if(u.card.token){ log(`${u.card.n} se desvanece.`,'sys'); }
  else { P(u.owner).hand.push(u.card.id); log(`${u.card.n} vuelve a la mano.`,'sys'); }
  recalc();
}

function moveUnit(u, from, to){
  const i=P(from).field.indexOf(u); if(i>=0) P(from).field.splice(i,1);
  if(P(to).field.length>=5){ P(from).field.splice(Math.max(0,i),0,u); return false; }
  u.side=to; u.stolen=(u.owner!==to); u.sick=true; P(to).field.push(u); recalc(); return true;
}

/* ---------- robo / mazo ---------- */

async function draw(s,n=1){
  for(let i=0;i<n;i++){
    if(!P(s).deck.length){
      log(`<b>${P(s).L.n}</b> no puede robar: el Domo lo exprime (−2 Alma).`,'dmg');
      await dmgFace(s,2,{src:'fatiga'}); continue;
    }
    const c=P(s).deck.shift(); P(s).hand.push(c);
    render(); fxDraw(s);
    if(s===ME) log(`Robas <b>${CARDS[c].n}</b>.`,null,true);
    else log(`${P(s).L.n} roba una carta.`,'sys');
  }
  render();
}

async function search(s,pred,label){
  const idx=P(s).deck.findIndex(pred);
  if(idx<0){ log(`No hay ningún ${label} en el mazo.`,'sys'); return null; }
  if(s===ME){
    const opts=P(s).deck.filter(pred);
    const c=await pickCard(s,[...new Set(opts)],`Busca un ${label} en tu mazo`);
    const i=P(s).deck.indexOf(c); P(s).deck.splice(i,1); P(s).hand.push(c);
    shuffle(P(s).deck); log(`Buscas <b>${CARDS[c].n}</b>.`,null,true); return c;
  }
  const c=P(s).deck.splice(idx,1)[0]; P(s).hand.push(c); shuffle(P(s).deck);
  log(`${P(s).L.n} busca un ${label}.`,'sys'); return c;
}

async function dig(s,n){
  const top=P(s).deck.slice(0,n);
  if(!top.length){ log('El mazo está vacío.','sys'); return; }
  let c;
  if(s===ME) c=await pickCard(s,top,'Elige una carta para tu mano');
  else c=top.sort((a,b)=>CARDS[b].c-CARDS[a].c)[0];
  const i=P(s).deck.indexOf(c); P(s).deck.splice(i,1); P(s).hand.push(c);
  log(s===ME?`Tomas <b>${CARDS[c].n}</b>.`:`${P(s).L.n} filtra su mazo.`,'sys',s===ME);
}

async function discardRandom(s,n=1){
  for(let i=0;i<n;i++){
    if(!P(s).hand.length) continue;
    const j=rnd(P(s).hand.length); const c=P(s).hand.splice(j,1)[0];
    P(s).grave.push(c); log(`${P(s).L.n} descarta ${CARDS[c].n}.`,'sys');
  }
  render();
}

async function discardChoose(s,n=1){
  for(let i=0;i<n;i++){
    if(!P(s).hand.length) return;
    if(s===ME){ const c=await pickCard(s,P(s).hand,'Descarta una carta');
      const j=P(s).hand.indexOf(c); P(s).hand.splice(j,1); P(s).grave.push(c);
      log(`Descartas ${CARDS[c].n}.`,'sys'); }
    else await discardRandom(s,1);
  }
  render();
}

async function summonToken(s,tokenId,opt={}){
  if(P(s).field.length>=5){ log('El campo está lleno; la ficha no entra.','sys'); return null; }
  const u=mkUnit(tokenId,s); P(s).field.push(u); recalc();
  if(opt.msg) log(opt.msg);
  await cloudCheck(u);
  render(); fxAterriza(u); return u;
}

function sacRelic(s,r){ const i=P(s).relics.indexOf(r); if(i>=0) P(s).relics.splice(i,1);
  P(s).grave.push(r.id); recalc(); render(); }

async function destroyObject(s,o){
  if(o.relic){ log(`${CARDS[o.id].n} es destruida.`,'dmg');
    if(CARDS[o.id].scroll){ P(s).llaves=0; log(`${P(s).L.n} pierde todas sus Llaves.`,'dmg'); }
    sacRelic(s,o.relic); }
  else { const i=o.unit.objs.indexOf(o.id); if(i>=0) o.unit.objs.splice(i,1);
    P(s).grave.push(o.id); log(`${CARDS[o.id].n} se destruye.`,'dmg'); }
  recalc(); render();
}

function gainKey(s,n,why){
  if(G.place && CARDS[G.place.id].doubleKeys) n*=2;
  P(s).llaves+=n;
  log(`🗝️ <b>${P(s).L.n}</b> gana ${n} Llave(s) del Domo (${why}). Total: ${keys(s)}.`);
  render(); fxStat(s,'.stat.key'); fxNumber(s===ME?'face0':'face1','🗝️ +'+n,'buff');
}

async function cloudCheck(u){ // Nube de Dagas del rival
  const foe=1-u.side;
  if(P(foe).clouds.some(c=>c.until>=G.turnNo)){
    log('La Nube de Dagas corta a quien entra.','dmg');
    await dmgU(u,2,{src:'nube'});
  }
}

/* ---------- d20 ---------- */
/* meta.sola: la tirada la hace el juego, no el jugador — sale, se resuelve y se
   cierra sin pedir clic. Es para lo que ocurre TODOS los turnos por sí solo,
   como la pasiva de Gero: pedir un clic ahí son diez clics por partida en algo
   que no decides. Además bloqueaba el tutorial desde el primer paso, porque el
   cartel del dado se abría encima y esperaba para siempre. */

async function roll(label, side, meta){
  side = (side==null? G.active : side);
  const mio = (side===ME) && !(meta && meta.sola);
  let r = 1+rnd(20);
  if(NET.host&&side===FOE){ netFx('dice',{v:r,label,meta:metaPlana(meta)});
    await Promise.all([rollDice(r,label,false,meta), netAsk({kind:'roll',value:r,label,fallback:1})]); }
  else { if(NET.host) netFx('dice',{v:r,label,meta:metaPlana(meta)});
         await rollDice(r,label,mio,meta); }
  const ev={isRoll:true,value:r,side};
  if(r>=15) await trapWindow(1-side,'letal',ev);
  if(!ev.reroll) await fastWindow(1-side,{kind:'d20',ev});
  if(ev.reroll){
    const r2=1+rnd(20);
    await rollDice(r2,'Te obligan a repetir — manda el peor',side===ME);
    log(`Repetición: ${r} y ${r2} → se queda con ${Math.min(r,r2)}.`,'roll');
    r=Math.min(r,r2);
  }
  log(`🎲 <b>${label}</b>: ${r}${r===20?' — ¡CRÍTICO!':r===1?' — ¡PIFIA!':''}`,'roll');
  if(G.tutorial) await tutBeat('dado',{r,side});
  if(r===1){ log('Pifia: pierdes 1 Alma.','dmg'); await dmgFace(side,1,{src:'pifia'}); }
  return r;
}

/* La descripción de la tirada lleva una función (¿acierta o no?), que no cabe
   en un mensaje de red: viaja el umbral y el rival reconstruye la comparación. */

function metaPlana(m){
  if(!m) return null;
  return {necesita:m.necesita, min:m.min??null, max:m.max??null, siOk:m.siOk, siMal:m.siMal};
}

function metaViva(m){
  if(!m) return null;
  return {...m, ok:v => (m.min!=null ? v>=m.min : true) && (m.max!=null ? v<=m.max : true)};
}

/* ---------- ventana de Trampas ---------- */

async function trapWindow(side, event, ev){
  if(G.over) return;
  const list=P(side).traps;
  for(let i=0;i<list.length;i++){
    const t=list[i], c=CARDS[t.id];
    if(c.on!==event) continue;
    if(c.can && !c.can(G,side,ev)) continue;
    list.splice(i,1);
    P(side).grave.push(t.id);
    log(`🪤 <b>${c.n}</b> se activa.`);
    render(); netFx('trap',{id:t.id,side}); await fxTrap(t.id,side); await nap(120);
    await c.fire(G,side,ev);
    render();
    if(G.tutorial) await tutBeat('trampa',{id:t.id,side});
    return; // solo una Trampa por evento
  }
}

/* ---------- ventana de Hechizos Rápidos ---------- */

function fastCandidates(side, kind){
  return P(side).hand.filter(id=>{
    const c=CARDS[id]; if(!c.fast) return false;
    if(costOf(id,side)>P(side).pd) return false;
    if(c.counter) return kind==='hechizo';
    if(c.reroll)  return kind==='d20';
    return kind==='ataque'||kind==='hechizo';
  });
}

async function fastWindow(side, ctx){
  if(G.over||G.active===side) return;
  const cands=fastCandidates(side,ctx.kind);
  if(!cands.length) return;
  if(NET.host&&side===FOE){
    const c=await netAsk({kind:'pick',ids:cands,title:'⚡ Respuesta rápida',cancellable:true,fallback:null});
    if(!c||!P(side).hand.includes(c)) return;
    P(side).pd-=costOf(c,side); P(side).hand.splice(P(side).hand.indexOf(c),1); P(side).grave.push(c);
    log(`⚡ ${P(side).L.n} responde con <b>${CARDS[c].n}</b>.`);
    const card=CARDS[c];
    if(card.counter) await card.castCounter(G,side,ctx.ev);
    else if(card.reroll) await card.castReroll(G,side,ctx.ev);
    render(); return;
  }
  if(side!==ME||G.auto){ await aiFast(side,ctx,cands); return; }
  const c=await pickCard(side,cands,'⚡ Respuesta rápida — ¿jugar un Hechizo Rápido?',true);
  if(!c) return;
  P(side).pd-=costOf(c,side);
  const i=P(side).hand.indexOf(c); P(side).hand.splice(i,1); P(side).grave.push(c);
  log(`⚡ Juegas <b>${CARDS[c].n}</b> como respuesta.`);
  const card=CARDS[c];
  if(card.counter) await card.castCounter(G,side,ctx.ev);
  else if(card.reroll) await card.castReroll(G,side,ctx.ev);
  else { const ts=await resolveTargets(side,card,null); if(ts) await card.cast(G,side,ts); }
  render();
}

async function aiFast(side,ctx,cands){
  const c=cands[0]; const card=CARDS[c];
  let use=false;
  if(card.counter && ctx.ev && CARDS[ctx.ev.cardId] && CARDS[ctx.ev.cardId].c>=4) use=true;
  if(card.reroll && ctx.ev && ctx.ev.value>=15) use=true;
  if(card.heal && ctx.kind==='ataque') use=false;
  if(!use) return;
  P(side).pd-=costOf(c,side);
  P(side).hand.splice(P(side).hand.indexOf(c),1); P(side).grave.push(c);
  log(`⚡ ${P(side).L.n} responde con <b>${card.n}</b>.`);
  await nap(450);
  if(card.counter) await card.castCounter(G,side,ctx.ev);
  else if(card.reroll) await card.castReroll(G,side,ctx.ev);
  render();
}

/* ==========================================================================
   5. FLUJO DE TURNO
   ========================================================================== */
/* ---------------------------------------------------------------------------
   EL VOLADO
   Antes quien empezaba salía de un rnd() invisible y sólo lo contaba una línea
   del registro. Ahora eliges lado, se lanza la moneda y ves si te toca. Nada
   cambia en las reglas: sigue siendo 50/50.
   Devuelve quién empieza (0 = tú). Si no se puede preguntar —partidas
   automáticas, tutorial, online— quien llama pasa el resultado por su cuenta.
   ------------------------------------------------------------------------ */

async function setupMatch(myLeader, foeLeader, opts={}){
  newGame(myLeader, foeLeader, opts);
  G.fast=!!opts.fast; G.auto=!!opts.auto; G.silent=!!opts.silent;
  G.online=!!opts.online; G.logSent=0; G.fxq=[];
  const first = opts.first!=null ? opts.first : (rnd(2));
  G.second = 1-first;
  log(`<b>${P(first).L.n}</b> gana la tirada de inicio y empieza.`,'sys');
  for(const s of [0,1]){ await drawSilent(s,5); }
  await drawSilent(G.second,1); // el segundo roba 1 extra
  G.turnNo=0; G.active=1-first;
  render();
  await startTurn(first);
}

async function drawSilent(s,n){ for(let i=0;i<n;i++){ if(P(s).deck.length) P(s).hand.push(P(s).deck.shift()); } }

/* ============ MANO NUEVA ============
   Si en tu primer turno no puedes jugar absolutamente nada, puedes devolver la
   mano al mazo, barajarlo y robar otra del mismo tamaño.

   Por qué existe: con 1 PD el primer turno, una mano sin nada de Costo 1 no es
   una mano difícil, es un turno perdido de regalo, y eso lo decide el barajado
   antes de que juegues. Esto no da ventaja —sólo se ofrece cuando ya no podías
   hacer nada—, sólo quita partidas decididas por el reparto.

   Condiciones, todas a la vez: es tu primer turno, no la has usado todavía, y
   ninguna carta de tu mano es jugable ahora mismo (coste, sitio en el campo y
   objetivos incluidos: canPlay ya lo mira todo). Una sola vez por jugador, y la
   segunda mano es la que hay, salga como salga. Vale para los dos lados; la CPU
   la toma siempre que le toca. */

function puedeRehacerMano(s){
  const p = P(s);
  if(p.manoRehecha || G.tutorial || G.over) return false;
  if(G.turnNo > 2) return false;                 // turno 1 y 2 son los primeros
  if(!p.hand.length || !p.deck.length) return false;
  return !p.hand.some(id => canPlay(s, id));     // de verdad no puedes nada
}

/* La mano, carta a carta desde el mazo. No cambia nada del estado: es
   únicamente para poder mirar lo que tienes antes de decidir. */

async function repartirALaVista(s){
  const n = P(s).hand.length;
  for(let i = 0; i < n; i++){ fxDraw(s); await nap(FXON() ? 110 : 0); }
  await nap(FXON() ? 620 : 0);                   // que aterrice la última
}

async function startTurn(s){
  if(G.over) return;
  G.active=s; G.turnNo++; G.diedThisTurn=[]; G.phase='puntos';
  const p=P(s);
  p.leaderUsed=false; p.attacked=false; p.kdrama=false; p.fairy=false;
  P(1-s).fairy=false;

  // Cuerda Dimensional: regresan
  p.limbo = p.limbo.filter(x=>{
    if(x.ret<=G.turnNo && p.field.length<5){ x.u.dmg=Math.max(0,x.u.dmg-2); x.u.sick=false;
      p.field.push(x.u); log(`${x.u.card.n} baja de la cuerda (+2 PV).`,'heal'); return false; }
    return true;
  });

  // Fase de Puntos
  p.pdMax=Math.min(10,p.pdMax+1);
  let pd=Math.max(0,p.pdMax-(p.pdTax||0))+p.banked+(p.pdBonus||0);
  if(G.turnNo===2 && s===G.second) pd+=1;
  p.pd=pd; p.banked=0; p.pdTax=0; p.pdBonus=0;

  p.field.forEach(u=>{
    u.attacked=false; u.actUsed=false; u.marked=false; u.noCounter=false;
    u.tIgnoreTaunt=false; u.trapProof=false; u.revealed=false; u.noFly=false;
    if(u.stunned>0) u.stunned--;
    u.sick=false;
  });
  recalc();
  log(`<b>— Turno ${Math.ceil(G.turnNo/2)} de ${p.L.n} —</b> (${p.pd}/${p.pdMax} PD)`,'sys');


  /* EL REY — corte reunida. Se mira aquí, con el campo ya asentado. */
  if(!G.over && p.field.some(u=>u.alive && u.card.id==='rey')
     && p.field.filter(u=>u.alive).length>=4){
    endGame(s, `${p.L.n} reúne la corte al completo: la campaña termina aquí.`);
    return;
  }
  render();
  netFx('banner',{side:(s===FOE?0:1)});
  await fxBanner(s);
  fxStat(s,'.stat.pd');

  /* GERO — El dado decide.
     Va DESPUÉS del cartel de «Turno de…» a propósito: el dado es lo primero que
     pasa en el turno, no el anuncio de que el turno empieza. Puesto antes, el
     d20 aparecía sobre la pantalla del turno anterior y parecía que lo tiraba
     el rival.
     Los tamaños no son simétricos y tampoco es un descuido: los PD se
     desperdician —si no tienes qué jugar, el punto de más se evapora— y el Alma
     siempre se cobra. Medido, un ±2 «simétrico» le quitaba 5,6 puntos de
     victorias, y subir el premio a +4 PD lo dejaba PEOR que +2 porque no le da
     tiempo a gastarlos. Con +3 se iba al 55 % y por encima de todos menos
     Adreida; con +2 el juego entero se queda en 15,5 de brecha. */
  if(p.leaderId==='gero' && !G.over && tutPasivaLista()){
    const d = await roll('El dado decide', s, {sola:true, necesita:'15 o más',
      min:15, siOk:'+2 PD este turno', siMal:'−1 Alma si sale 10 o menos'});
    if(d>=15){ p.pd+=2; log('🎲 <b>El dado decide</b>: 15+. Gero improvisa a lo grande: <b>+2 PD</b>.','good'); }
    else if(d<=10){ log('🎲 <b>El dado decide</b>: 10 o menos. Sale mal: <b>−1 Alma</b>.','dmg');
      await dmgFace(s,1,{src:'dado'}); }
    else log('🎲 <b>El dado decide</b>: ni fu ni fa. Sigue el guion.','sys');
    if(G.over) return;
    render(); fxStat(s,'.stat.pd');
  }

  // Lugar
  if(G.place && CARDS[G.place.id].onAnyStart) await CARDS[G.place.id].onAnyStart(G,s);
  // habilidades "al inicio de tu turno"
  for(const u of [...p.field]) if(u.alive && u.card.onStart && !u.possessed) await u.card.onStart(G,s,u);
  // Infectado
  for(const u of [...p.field]) if(u.alive && u.infected){ log(`${u.card.n} está Infectado.`,'dmg'); await dmgU(u,1,{src:'infeccion'}); }
  // Regeneración
  for(const u of p.field) if(u.alive && u.keys.has('regeneracion')){
    if(u.tookFire) log(`${u.card.n} no regenera: le quemaron.`,'sys');
    else healU(u,2);
  }
  p.field.forEach(u=>u.tookFire=false);
  // Calentar Metal
  for(const u of [...p.field]) if(u.alive && u.hotMetal){ u.hotMetal=false;
    log(`El metal de ${u.card.n} sigue ardiendo.`,'dmg'); await dmgU(u,2,{fire:true,src:'hechizo'}); }
  // Pergamino de Deseo Ilimitado
  const scroll=p.relics.find(r=>CARDS[r.id].scroll);
  if(scroll){
    if(P(1-s).field.some(u=>u.card.freezeScroll)) log('Juan Gabriel congela el contador del Pergamino.','sys');
    else { p.scrollTurns++; log(`📜 El Pergamino brilla (${p.scrollTurns}/2).`);
      render(); fxStat(s,'.stat.relic');
      fxNotice('📜 Pergamino de Deseo Ilimitado — '+p.scrollTurns+'/2','var(--gold)'); await nap(900);
      if(p.scrollTurns>=2){ endGame(s,`${p.L.n} formula su Deseo Ilimitado. El Domo obedece.`); return; } }
  }
  if(G.over) return;
  // Fase de Robo
  G.phase='robo';
  await draw(s,1);
  if(G.over) return;
  G.phase='principal';
  render();
  relojArranca();                                 // 1:30 para jugar tu turno
  await ofrecerManoNueva(s);                      // sólo si no puedes hacer nada
  if(G.over) return;
  if(G.tutorial){ tutCheck(); await tutBeat('turno',{side:s}); }
  // El turno del rival se encadena con el siguiente, y esa cadena sigue viva
  // aunque empiece otra partida: si vuelves al menú y entras de nuevo, la IA de
  // la anterior seguía jugando sobre la nueva. Cada newGame crea un G distinto,
  // así que basta con mirar si sigue siendo el mismo antes de continuar.
  if(s===FOE && !G.online) { const miG=G; await nap(780); if(G!==miG) return; await aiTurn(); }
  if(NET.host) netPushState();
}

async function endTurn(){
  if(G.over||G.busy) return;
  relojPara();
  const s=G.active, p=P(s);
  G.phase='final';
  if(G.tutorial) tutCheck();
  // Adreida — Maratón de K-dramas
  if(p.leaderId==='adreida' && !p.attacked && !p.leaderUsed){
    log('📺 Maratón de K-dramas: robas 1 carta.'); await draw(s,1); p.leaderUsed=true;
  }
  if(G.tutorial) await tutBeat('finTurno',{side:s});
  // Antro Juan
  if(G.place && CARDS[G.place.id].endPhase && p.pd>=2 && p.deck.length){
    const c=await ask(s,'Antro Juan: ¿pagar 2 PD para robar 1 carta?',['Sí, una ronda más','No'],
      (g,ss)=>P(ss).hand.length<6?0:1);
    if(c===0){ p.pd-=2; await draw(s,1); }
  }
  // Machete — Banco de Puntos
  const machete=p.field.find(u=>u.card.bank);
  if(machete && p.pd>0){ p.banked=Math.min(2,p.pd); log(`🎒 Machete guarda ${p.banked} PD para el próximo turno.`,'sys'); }
  // límite de mano
  while(p.hand.length>8){
    if(s===ME&&!G.auto){ toast('Límite de mano: 8 cartas'); await discardChoose(s,1); }
    else await discardRandom(s,1);
  }
  // limpieza de temporales
  [...P(0).field,...P(1).field].forEach(u=>{
    u.tA=0; u.tH=0; if(u.nUntil<=G.turnNo){ u.nA=0; u.nH=0; }
    u.marked=false; u.noCounter=false;
  });
  P(0).clouds=P(0).clouds.filter(c=>c.until>=G.turnNo);
  P(1).clouds=P(1).clouds.filter(c=>c.until>=G.turnNo);
  // condenados (Tal Habla por el Cadáver)
  for(const side of [0,1]) for(const u of [...P(side).field])
    if(u.doomed && u.doomed<=G.turnNo){ log(`${u.card.n} vuelve a morir.`,'dmg'); await destroy(u,{silent:true}); }
  // Rulchete: fin de la polimorfia
  for(const side of [0,1]) for(const u of P(side).field) if(u.poly && u.poly.until<=G.turnNo){
    const ratio=u.dmg/u.maxHp; u.card=u.poly.card; u.tribes=[...u.poly.card.tr]; u.poly=null;
    recalc(); u.dmg=Math.min(u.maxHp-1,Math.round(ratio*u.maxHp));
    log(`${u.card.n} recupera su forma original.`,'sys');
  }
  recalc(); render();
  if(G.over) return;
  await startTurn(1-s);
}

function canPlay(s,id){
  const c=CARDS[id];
  if(G.active!==s||G.over) return false;
  if(G.phase!=='principal'&&G.phase!=='combate') return false;
  if(costOf(id,s)>P(s).pd) return false;
  if(c.t==='personaje'&&P(s).field.length>=5) return false;
  if(c.t==='trampa'&&P(s).traps.length>=3) return false;
  if(c.t==='objeto'&&c.equip&&!P(s).field.some(u=>u.objs.length<(u.card.objSlots||1))) return false;
  if(c.req&&!c.req(G,s)) return false;
  if(c.tg){ for(const g of c.tg) if(g.min>0 && !targetPool(s,g,null,c).length) return false; }
  return true;
}

async function playFromHand(s, id, forcedTargets){
  if(!canPlay(s,id)) return false;
  const c=CARDS[id], cost=costOf(id,s);
  let ts=null;
  const tgDef = (c.t==='personaje'&&c.enterTg) ? [c.enterTg]
              : (c.t==='objeto'&&c.equip) ? [{k:'unidadAliada',min:1,max:1,label:'portador',
                    f:u=>u.objs.length<(u.card.objSlots||1)}]
              : c.tg;
  if(tgDef){
    ts = forcedTargets || await resolveTargets(s, (tgDef===c.tg? c : {tg:tgDef, sub:c.sub}), null);
    if(ts===null) return false;
  }
  P(s).pd-=cost;
  P(s).hand.splice(P(s).hand.indexOf(id),1);
  /* De una Trampa no se dice cuál es: va boca abajo. Esta línea anunciaba toda
     carta jugada con su nombre y no era privada, así que en línea le cantaba al
     rival la Trampa que acababas de poner. Era la fuga que quedaba. */
  if(c.t==='trampa'){
    log(`<b>${P(s).L.n}</b> juega <b>${c.n}</b> (${cost} PD).`, null, true);
    logRed(`<b>${P(s).L.n}</b> coloca una Trampa (${cost} PD).`);
  } else log(`<b>${P(s).L.n}</b> juega <b>${c.n}</b> (${cost} PD).`);
  render();
  fxStat(s,'.stat.pd');
  // Toda carta que se juega se anuncia. Antes sólo los Hechizos enseñaban algo,
  // y encima su etiqueta salía únicamente si la jugaba el rival: por eso unas
  // veces se veía texto y otras no.
  if(c.t==='hechizo'){ netFx('spell',{id,side:(s===FOE?0:1)}); await fxSpell(id,s); }
  else {
    const quien = P(s).L.n;
    const verbo = {personaje:'invoca a', trampa:'coloca una Trampa',
                   objeto:'saca', lugar:'cambia el escenario:'}[c.t] || 'juega';
    /* Una Trampa va boca abajo: su nombre no sale nunca del lado de quien la
       pone. Antes se decidía con `s!==ME`, que en local vale pero en línea no:
       ahí el anfitrión resuelve las dos partidas, así que al colocar la SUYA el
       texto llevaba el nombre y netFx se lo mandaba al rival. Se filtraba la
       carta boca abajo al otro jugador.
       Ahora hay dos textos: el que se ve en casa y el que sale por la red. */
    const enCasa  = (c.t==='trampa') ? `🪤 ${quien} coloca ${c.n}`
                                     : `${c.art} ${quien} ${verbo} ${c.n}`;
    const alRival = (c.t==='trampa') ? `🪤 ${quien} coloca una Trampa` : enCasa;
    netFx('notice',{txt:alRival,color:'var(--c-'+c.t+')'});
    fxNotice(s===ME ? enCasa : alRival, 'var(--c-'+c.t+')');
    await nap(s===ME ? 380 : 620);
  }

  if(c.t==='hechizo'){
    const ev={cardId:id, kind:'hechizo', countered:false};
    if(!c.uncounterable){
      await trapWindow(1-s,'hechizoOHabilidad',ev);
      if(!ev.countered) await fastWindow(1-s,{kind:'hechizo',ev});
    }
    if(ev.countered){ P(s).grave.push(id); render(); return true; }
    // Brick y Brock — Acertijo
    if(c.sub&&c.sub.includes('engano')){
      for(const u of [...P(1-s).field]) if(u.card.toll){ log('El Acertijo devuelve a Brick y Brock a la mano.','sys'); bounce(u); }
    }
    if(c.cast) await c.cast(G,s,ts);
    // Fender — Inspiración
    if(c.sub&&c.sub.includes('cancion')&&P(s).leaderId==='fender'){
      const t=P(s).field.slice().sort((a,b)=>b.atk-a.atk)[0];
      if(t){ t.pA++; log(`🎸 Inspiración: ${t.card.n} +1 ATQ permanente.`); }
    }
    P(s).grave.push(id);
  }
  else if(c.t==='personaje'){
    const u=mkUnit(id,s);
    P(s).field.push(u); recalc();
    if(u.keys.has('prisa')) u.sick=false;
    render();
    fxAterriza(u);
    await cloudCheck(u);
    if(u.alive){
      if(c.enter) await c.enter(G,s,u,ts);
      // Rafaela — Rebaño de Rul
      if(u.tribes.includes('Discípulo')&&P(s).leaderId==='rafaela'){
        const hurt=P(s).field.filter(o=>o.dmg>0).sort((a,b)=>b.dmg-a.dmg)[0];
        if(hurt){ healU(hurt,2); log('🐉 Rebaño de Rul: +2 PV.','heal'); }
        else { P(s).alma=Math.min(30,P(s).alma+2); log('🐉 Rebaño de Rul: +2 Alma.','heal'); }
      }
      // Aldrick — Recompensa
      if(id==='talia'&&P(s).field.some(o=>o.card.id==='aldrick')){ log('Recompensa de Aldrick: robas 2.'); await draw(s,2); }
    }
  }
  else if(c.t==='trampa'){ P(s).traps.push({id, revealed:false});
    /* El nombre de TU Trampa es privado: sin la marca, el registro viajaba
       entero al rival y en línea le decía qué acababas de poner boca abajo.
       Él recibe la línea genérica, que es lo único que puede saber. */
    if(s===ME){
      log(`Colocas <b>${c.n}</b> boca abajo.`,'sys',true);   // sólo para ti
      logRed('El rival coloca una Trampa boca abajo.','sys'); // sólo para él
    } else log('El rival coloca una Trampa boca abajo.','sys'); }
  else if(c.t==='objeto'){
    if(c.relic){ P(s).relics.push({id,counters:0}); render();
      fxNotice(c.art+' '+c.n+' en juego','var(--c-objeto)'); await nap(500); }
    else { const u=ts[0][0]; u.objs.push(id); log(`${c.n} se equipa a ${u.card.n}.`);
      recalc(); render(); fxObj(u,id,'Equipado a '+u.card.n); await nap(500); }
  }
  else if(c.t==='lugar'){
    if(G.place){ P(G.place.side).grave.push(G.place.id); log(`${CARDS[G.place.id].n} es reemplazado.`,'sys'); }
    G.place={id,side:s};
  }
  recalc(); await checkDeaths(); render();
  if(G.tutorial){ tutApunta(s,id); tutCheck(); await tutBeat('juega',{side:s,id}); }
  return true;
}

/* ---------- habilidad de líder ---------- */

async function useLeader(s){
  const p=P(s), L=p.L;
  if(p.leaderUsed||p.pd<L.habCost||G.active!==s||G.over) return false;
  if(L.habReq&&!L.habReq(G,s)) { toast('No hay objetivos válidos'); return false; }
  let ts=null;
  if(L.habTg){ const tg=Array.isArray(L.habTg)?L.habTg:[L.habTg];
    ts=await resolveTargets(s,{tg},null); if(ts===null) return false; }
  p.pd-=L.habCost; p.leaderUsed=true;
  log(`<b>${L.n}</b> usa <b>${L.habName}</b> (${L.habCost} PD).`);
  const ev={kind:'lider',cardId:null,countered:false};
  await trapWindow(1-s,'hechizoOHabilidad',ev);
  if(ev.countered){ render(); return true; }
  await fxHabilidad(s);
  netFx('hab',{side:s});
  await L.hab_do(G,s,ts);
  recalc(); await checkDeaths(); render();
  if(G.tutorial) tutCheck();
  return true;
}

/* ---------- habilidad activada de personaje ---------- */

async function useAct(u){
  const s=u.side, a=u.card.act;
  if(!a||u.actUsed||P(s).pd<a.cost||G.active!==s||u.stunned>0||u.possessed) return false;
  if(a.req&&!a.req(G,s)) { toast('No se puede usar ahora'); return false; }
  let ts=null;
  if(a.tg){ ts=await resolveTargets(s,{tg:[a.tg]},u); if(ts===null) return false; }
  P(s).pd-=a.cost; u.actUsed=true;
  log(`<b>${u.card.n}</b> usa <b>${a.n}</b>.`);
  await a.do(G,s,u,ts);
  recalc(); await checkDeaths(); render();
  return true;
}

async function useRelic(s,r){
  const c=CARDS[r.id]; if(!c.relicAct||G.active!==s) return false;
  if(P(s).pd<c.relicAct.cost) return false;
  P(s).pd-=c.relicAct.cost;
  await c.relicAct.do(G,s,r); recalc(); render(); return true;
}

/* ==========================================================================
   7. COMBATE
   ========================================================================== */

function canAttack(u){
  if(!u||!u.alive||u.attacked||u.stunned>0||u.atk<=0||G.over) return false;
  if(u.sick&&!u.keys.has('prisa')) return false;
  if(u.card.noAttack||u.blind) return false;
  if(u.card.clause&&!u.noClause&&!hasContract(u.side)) return false;
  // Peaje de Brick y Brock: atacar cuesta 1 PD, así que sin PD no se puede.
  // Esto se comprobaba sólo al resolver el ataque, y para entonces ya era
  // tarde: la carta salía marcada como lista, el rival la intentaba una y otra
  // vez —doce veces, con su pausa cada una— y el turno se quedaba colgado
  // siete segundos repitiendo el mismo aviso.
  if(P(u.side).pd<1 && P(1-u.side).field.some(o=>o.card.toll&&o.alive)) return false;
  return true;
}

function legalTargets(u){
  const d=1-u.side;
  const reach = o => !o.keys.has('vuelo') || u.keys.has('vuelo') || u.keys.has('arquero');
  const visible = o => !(o.keys.has('sigilo') && !o.revealed);
  const enemies = P(d).field.filter(o=>o.alive&&visible(o));
  const ignore = u.keys.has('sinhonor')||u.tIgnoreTaunt;
  const taunts = enemies.filter(o=>o.keys.has('provocar')&&reach(o));
  let units, face;
  if(taunts.length&&!ignore){ units=taunts; face=false; }
  else { units=enemies.filter(reach); face=true; }
  if(u.card.id==='tal' && P(d).field.some(o=>o.card.hostage)) face=false;
  return {units, face};
}

function hasContract(s){ return P(s).traps.some(t=>CARDS[t.id].contract); }

async function doAttack(u, target){
  if(G.resolving||!canAttack(u)) return false;
  const s=u.side, d=1-s;
  const lt=legalTargets(u);
  if(target==='face' ? !lt.face : !lt.units.includes(target)){
    /* Se dice por qué, y también al Registro: el cartel se cierra y el motivo
       se perdía, así que quedaba «no me deja atacar» sin explicación. */
    const why = porQueNoEsObjetivo(u, target);
    const limpio = why.replace(/<[^>]+>/g,'');
    log(`<b>${u.card.n}</b> no puede atacar ahí — ${limpio}.`,'sys');
    setPrompt(`${u.card.n}: ${why}`,[{t:'Entendido',fn:()=>{clearPrompt();render();}}]);
    return false;
  }
  G.resolving=true;
  try{
    // Peaje de Brick y Brock
    if(P(d).field.some(o=>o.card.toll&&o.alive)){
      if(P(s).pd<1){ toast('Peaje de Brick y Brock: necesitas 1 PD'); return false; }
      P(s).pd--; log('Peaje de Brick y Brock: −1 PD.','sys');
    }
    // El Puente de Brick y Brock (lugar)
    if(target==='face' && G.place && CARDS[G.place.id].riddleBridge){
      const r=await roll('Acertijo del Puente', s, {necesita:'8 o más', min:8,
        siOk:'Resuelve el acertijo y puede atacar al Alma',
        siMal:'No lo resuelve: no puede atacar al Alma'});
      if(r<8){ log('No resuelve el acertijo: no puede atacar al Alma.','sys'); u.attacked=true; render(); return true; }
    }
    P(s).attacked=true;
    const ev={att:u,target,cancel:false};
    log(`⚔️ <b>${u.card.n}</b> ataca ${target==='face'?`al Alma de ${P(d).L.n}`:`a ${target.card.n}`}.`);
    render(); await nap(280);
    if(G.tutorial) await tutBeat('ataque',{att:u,target,side:s});

    // Espíritus Guardianes del defensor
    if(P(d).spirits>=G.turnNo){
      log('Los Espíritus Guardianes estornudan sobre el atacante.','dmg');
      u.nA-=1; u.nUntil=G.turnNo; recalc();
      await dmgU(u,2,{src:'espiritus'});
      if(!u.alive){ return true; }
    }
    // Trampas
    if(!u.trapProof){
      await trapWindow(d,'ataque',ev);
      if(!ev.cancel && target==='face') await trapWindow(d,'ataqueAlma',ev);
    }
    if(!ev.cancel) await fastWindow(d,{kind:'ataque',ev});
    u.attacked=true; u.attackedEver=true; recalc();
    if(ev.cancel||!u.alive){ render(); return true; }
    if(target!=='face' && !target.alive){ render(); return true; }

    // Miope (Minus)
    if(u.card.myopic && target!=='face'){
      const r=await roll('Miope', s, {necesita:'11 o más', min:11,
        siOk:'Ataca a quien quería', siMal:'No ve bien y ataca a otro al azar'});
      if(r<=10){ const pool=lt.units.filter(o=>o.alive);
        if(pool.length){ target=pool[rnd(pool.length)]; log(`Minus no ve bien y ataca a ${target.card.n}.`,'sys'); } }
    }
    let atk=u.atk;
    if(u.card.hunter && target!=='face' && target.tribes.some(t=>['Mago','Dragón'].includes(t))){
      atk+=3; log('Cazamagos: +3 ATQ.','sys'); }
    if(P(s).fairy && target!=='face') atk+=1;
    // Ludópata (Aidman)
    if(u.card.gambler){
      const r=await roll('Ludópata', s, {necesita:'15 o más', min:15,
        siOk:'¡Gana la apuesta! Daño doble',
        siMal:'Pierde la apuesta (con 5 o menos, se hace el daño a sí mismo)'});
      if(r>=15){ atk*=2; log('¡Aidman acierta la apuesta! Daño doble.','roll'); }
      else if(r<=5){ log('Aidman pierde la apuesta y se hace el daño a sí mismo.','dmg');
        await dmgU(u,atk,{src:'ludopata'}); render(); return true; }
    }
    netFx('lunge',{uid:u.uid, tg:target==='face' ? 'face' : target.uid, side:(s===FOE?0:1)});
    await fxLunge(u,target);
    // Ilusión
    if(target!=='face' && target.card.illusion){
      log('La Ilusión se desvanece sin recibir daño.','sys');
      await destroy(target,{silent:true}); render(); return true;
    }
    if(target==='face'){
      await dmgFace(d,atk,{src:'combate'});
    } else {
      const back = target.atk;
      const noCounter = u.noCounter || target.marked || target.atk<=0;
      await dmgU(target,atk,{att:u,src:'combate'});
      if(!noCounter && back>0) await dmgU(u,back,{att:target,src:'combate'});  // daño simultáneo
      target.marked=false;
    }
    await checkDeaths();
    render();
    if(G.tutorial) tutCheck();
    return true;
  } finally { G.resolving=false; render(); }
}

/* ==========================================================================
   8. OBJETIVOS
   ========================================================================== */

function bestEnemy(side){ return P(side).field.filter(u=>u.alive).sort((a,b)=>(b.atk+b.maxHp)-(a.atk+a.maxHp))[0]||null; }

function worstAlly(side){ return P(side).field.filter(u=>u.alive).sort((a,b)=>(a.atk+a.maxHp)-(b.atk+b.maxHp))[0]||null; }

function targetPool(s, g, self, card){
  const flt = u => (!g.f || g.f(u,G,s,self));
  const engano = card && card.sub && card.sub.includes('engano');
  const ok = u => {
    if(!u.alive) return false;
    if(u.side!==s){
      if(u.keys.has('sigilo') && !u.revealed) return false;
      if(u.card.spellProof) return false;
      if(engano && grant(u,'enganoProof')) return false;
    }
    return flt(u);
  };
  switch(g.k){
    case 'unidadAliada': return P(s).field.filter(u=>u.alive&&flt(u));
    case 'unidadEnemiga': return P(1-s).field.filter(ok);
    case 'unidad': return [...P(s).field,...P(1-s).field].filter(u=>u.side===s?(u.alive&&flt(u)):ok(u));
    case 'objetivoEnemigo': return [...P(1-s).field.filter(ok),'face'];
    case 'objetoEnemigo': return allObjects(1-s);
  }
  return [];
}

let TGT=null;

function resolveTargets(s, cardLike, self){
  const groups=cardLike.tg;
  if(!groups||!groups.length) return Promise.resolve([]);
  if(NET.host&&s===FOE) return netAsk({kind:'targets', card:cardLike.id||null,
      groups:groups.map(g=>({k:g.k,min:g.min,max:g.max,rep:!!g.rep,label:g.label||'',
        pool:targetPool(s,g,self,cardLike).map(x=>x==='face'?'face':(x&&x.uid!=null?x.uid:null)).filter(v=>v!==null)})),
      fallback:null})
    .then(v=>v===null?null:v.map(a=>a.map(x=>x==='face'?'face':
      [...P(0).field,...P(1).field].find(u=>u.uid===x)).filter(Boolean)));
  if(s!==ME||G.auto) return Promise.resolve(aiTargets(s,groups,self,cardLike));
  return new Promise(res=>{
    TGT={s,groups,self,card:cardLike,gi:0,chosen:groups.map(()=>[]),res};
    stepTarget();
  });
}

function stepTarget(){
  if(!TGT) return;
  while(TGT.gi<TGT.groups.length){
    const g=TGT.groups[TGT.gi];
    const pool=g.poolRef||targetPool(TGT.s,g,TGT.self,TGT.card);
    if(!pool.length){ if(g.min>0){ finishTarget(null); return; } TGT.gi++; continue; }
    TGT.pool=pool;
    showTargetPrompt(g,pool);
    render(); return;
  }
  finishTarget(TGT.chosen);
}

function showTargetPrompt(g,pool){
  const need=g.min===g.max?`elige ${g.min}`:`elige ${g.min}–${g.max}`;
  const lbl=g.label||({unidadAliada:'un aliado',unidadEnemiga:'un Personaje rival',
     unidad:'un Personaje',objetivoEnemigo:'un objetivo rival',objetoEnemigo:'un Objeto rival'})[g.k];
  const chosen=TGT.chosen[TGT.gi].length;
  setPrompt(`🎯 Selecciona ${lbl} (${need}) — ${chosen}/${g.max}`,
    [ chosen>=g.min ? {t:'Confirmar',cls:'gold',fn:()=>{TGT.gi++;stepTarget();}} : null,
      {t:'Cancelar',fn:()=>finishTarget(null)} ].filter(Boolean));
}

function pickTarget(t){
  if(!TGT) return;
  const g=TGT.groups[TGT.gi], arr=TGT.chosen[TGT.gi];
  if(!g.rep && arr.includes(t)) return;
  if(!TGT.pool.includes(t)) return;
  arr.push(t);
  if(arr.length>=g.max){ TGT.gi++; stepTarget(); }
  else showTargetPrompt(g,TGT.pool), render();
}

function finishTarget(v){ const r=TGT.res; TGT=null; clearPrompt(); render(); r(v); }

function isTargetable(t){ return TGT && TGT.pool && TGT.pool.includes(t); }

/* ==========================================================================
   9. INTERFAZ
   ========================================================================== */
/* Tres clases de línea:
     log(txt)             la ven los dos
     log(txt,cls,true)    sólo la ves tú (priv: no viaja)
     logRed(txt)          sólo la ve el rival (no se pinta aquí, pero viaja)
   La tercera hacía falta para las Trampas: tú tienes que leer cuál pusiste y él
   sólo que pusiste una. Sin ella, o se lo decías todo o no le decías nada. */

function logRed(txt,cls){
  if(!G) return;
  G.log.push({txt,cls,priv:false,soloRed:true});
}

function tribeLine(c){ return (c.tr&&c.tr.length? c.tr.join(' · ') : (c.t==='hechizo'&&c.sub? c.sub.map(x=>SUBNAME[x]).join(' · '): cap(c.t))); }

const HAB_CACHE = {};

function nombresDeHabilidad(cardId){
  if(HAB_CACHE[cardId]) return HAB_CACHE[cardId];
  const txt = (CARDS[cardId] && CARDS[cardId].x) || '';
  const out = [];
  const re = /<b>([^<:]{2,26}):<\/b>/g;
  let m;
  while((m = re.exec(txt))) out.push(m[1].trim());
  return HAB_CACHE[cardId] = out;
}

// el cascarón se reutiliza entre renders para que las animaciones no se corten
/* DE DÓNDE SALEN SUS NÚMEROS.
   La carta enseña el ATQ y los PV finales, pero no por qué: un 6/1 puede ser un
   4/4 con dos Objetos y una Canción encima, o un 6/6 al que han pegado. Esto lo
   desglosa en el cajón, que es donde se mira una carta con calma. */

function modificadoresDe(u){
  const base = u.card, filas = [];
  const dif = (fin, ini) => fin===ini ? '' : ` <b>(${fin>ini?'+':''}${fin-ini})</b>`;
  const trozos = [];
  if(u.pA||u.pH) trozos.push(`${u.pA>=0?'+':''}${u.pA}/${u.pH>=0?'+':''}${u.pH} permanentes`);
  if(u.tA||u.tH) trozos.push(`${u.tA>=0?'+':''}${u.tA}/${u.tH>=0?'+':''}${u.tH} este turno`);
  if(u.aA||u.aH) trozos.push(`${u.aA>=0?'+':''}${u.aA}/${u.aH>=0?'+':''}${u.aH} por auras`);
  let objA=0, objH=0;
  u.objs.forEach(o=>{ const oc=CARDS[o]; if(oc&&oc.mod){ objA+=oc.mod.a||0; objH+=oc.mod.h||0; } });
  if(objA||objH) trozos.push(`${objA>=0?'+':''}${objA}/${objH>=0?'+':''}${objH} de Objetos`);
  if(u.possessed) trozos.push('Poseído: la mitad de ATQ y sin habilidades');

  filas.push(`<b>${u.atk}</b>/<b>${Math.max(0,u.maxHp-u.dmg)}</b>` +
    ` <i>(base ${base.a||0}/${base.h||0}${u.dmg?`, ${u.dmg} de daño`:''})</i>`);
  if(trozos.length) filas.push('<i>'+trozos.join(' · ')+'</i>');
  if(u.objs.length) filas.push('<i>Lleva: '+u.objs.map(o=>CARDS[o]?CARDS[o].n:o).join(', ')+'</i>');

  const estados=[];
  if(u.stunned>0) estados.push('Aturdido');
  if(u.infected) estados.push('Infectado');
  if(u.doomed) estados.push('Condenado');
  if(u.blind) estados.push('Ciego');
  if(u.sick && !u.keys.has('prisa')) estados.push('Recién entrado');
  if(u.attacked) estados.push('Ya atacó');
  if(estados.length) filas.push('<i>'+estados.join(' · ')+'</i>');
  return filas.join('<br>');
}

function inspectHTML(id,u){
  const c=CARDS[id];
  let kw='';
  if(u){
    const chips=[];
    u.keys.forEach(k=>{ const m={prisa:['Prisa','good'],provocar:['Provocar','pro'],vuelo:['Vuelo','vue'],
      sigilo:['Sigilo','sig'],arquero:['Arquero','vue'],regeneracion:['Regeneración','good'],
      sinhonor:['Ignora Provocar','']}[k];
      if(m) chips.push(`<span class="kw ${m[1]}">${m[0]}</span>`); });
    if(u.sick&&!u.keys.has('prisa')) chips.push('<span class="kw bad">Entró este turno</span>');
    if(u.attacked) chips.push('<span class="kw bad">Ya atacó</span>');
    if(u.stunned>0) chips.push('<span class="kw bad">Aturdido</span>');
    if(u.infected) chips.push('<span class="kw bad">Infectado</span>');
    if(u.possessed) chips.push('<span class="kw bad">Poseído</span>');
    if(chips.length) kw=`<div class="keys">${chips.join('')}</div>`;
  }
  const objs = u&&u.objs.length
    ? `<div class="bigsep"></div>`+u.objs.map(o=>CARDS[o]
        ? `<div class="bigrow">${CARDS[o].art} <b>${CARDS[o].n}</b></div><div class="txt" style="font-size:11px">${CARDS[o].x}</div>`
        : '').join('')
    : '';
  const base = (u&&c.t==='personaje'&&(u.atk!==c.a||u.maxHp!==c.h))
    ? `<div class="bigbase">Base ${c.a}/${c.h} · ahora ${u.atk}/${u.maxHp}</div>` : '';
  return `${c.r===2?'<i class="foil" aria-hidden="true"></i>':''}<div class="top"><div class="cost">${c.c}</div><div class="nm">${c.n}${c.r===2?' ★':''}</div></div>
    <div class="art">${c.art}</div>
    <div class="tribe">${u?u.tribes.join(' · '):tribeLine(c)}</div>
    ${kw}
    <div class="txt">${c.x||''}</div>
    ${objs}
    ${c.t==='personaje'?`<div class="bigsep"></div><div class="stats">
      <span class="atk">${u?u.atk:c.a}</span><span class="hp">${u?Math.max(0,u.maxHp-u.dmg):c.h}</span></div>${base}`:''}`;
}

let FXSTACK = 0;

const SUBCOLOR = {fuego:'#ff7a3a', fe:'#ffd76a', engano:'#b06aff', cancion:'#4aa6ff',
                  contrato:'#ff4a6a', rapido:'#7affd0'};

function fxCenter(t){ const r=fxRect(t); return r? {x:r.left+r.width/2, y:r.top+r.height/2, r} : null; }

const FX_COLOR = { golpe:'#ffd58a', fuego:'#ff7a3a', letal:'#ffffff', ceniza:'#a89f94', brasa:'#ff9a3c' };

/* Chispas desde (x,y). `ang` es la dirección del golpe en radianes; las chispas
   salen en un cono alrededor de ella. Sin ángulo, salen en todas direcciones. */

const FX_AVISOS = [];

const FX_FILA = 40;                              // lo que ocupa cada aviso

const fxQuieta = side => side===ME ? 520 : 1000;

/* EL ESTALLIDO DEL HECHIZO
   Cuando la carta se posa en escena, estalla con el carácter de su elemento.
   Reutiliza las piezas del combate (chispas, bocanadas, anillos) con otra
   paleta y otro movimiento: el Fuego sube y quema, la Fe asciende despacio y
   brilla, el Engaño se expande como humo y deriva, la Canción son ondas y
   notas, el Contrato un sello seco, lo Rápido trazos horizontales. Todo tras
   FXON(), y sin partículas con prefers-reduced-motion (queda el anillo). */

const FX_ELEMENTO = {
  fuego:   {color:'#ff7a3a', claro:'#ffd28a'},
  fe:      {color:'#ffd76a', claro:'#fff3c4'},
  engano:  {color:'#b06aff', claro:'#e2c6ff'},
  cancion: {color:'#4aa6ff', claro:'#bfe0ff'},
  contrato:{color:'#ff4a6a', claro:'#ffc0cc'},
  rapido:  {color:'#7affd0', claro:'#d6fff1'},
};

async function fxTrap(cardId, side){
  const dueño = (side==null) ? FOE : side;
  await fxCartaEnEscena(cardEl(cardId,{}), dueño, 'var(--c-trampa)',
    '🪤 ¡TRAMPA! '+CARDS[cardId].n, fxQuieta(dueño));
}
/* habilidad de Líder: sube su carta con el nombre de la habilidad */

function barHTML(s){
  const p=P(s), me=s===ME;
  return `<div class="who"><div style="font-weight:800;font-size:13px;color:var(--gold)">${p.L.n}</div></div>
    <div class="stat alma" title="Alma">❤️ <i>${Math.max(0,p.alma)}</i></div>
    <div class="stat pd" title="Puntos">🔷 <i>${p.pd}/${p.pdMax}</i></div>
    <div class="stat key" title="Llaves del Domo">🗝️ <i>${keys(s)}</i></div>
    ${p.leaderId==='talesin'&&!p.ascended?`<div class="stat gr" title="Fichas de Gracia">✨ <i>${p.gracia}/5</i></div>`:''}
    ${p.relics.length?p.relics.map(r=>`<div class="stat relic" title="${CARDS[r.id].n}" data-relic="${r.id}">${CARDS[r.id].art} <i>${CARDS[r.id].scroll?p.scrollTurns+'/2':(r.counters||0)}</i></div>`).join(''):''}
    <div class="spacer"></div>
    <div class="stat" title="Cartas en mano">🃏 <i>${p.hand.length}</i></div>
    ${(!me&&G.active===s)?'<div class="turnpill">SU TURNO</div>':''}
    ${(!me&&NET.on)?`<div class="netchip">👥 sala <b>${NET.code}</b>
       <button class="diariobtn" title="Descargar el diario de esta partida en línea">📄</button></div>`:''}`;
}

let SEL=null; // unidad seleccionada para atacar

function whyNot(s,id){
  const c=CARDS[id];
  if(G.over) return 'La partida ha terminado';
  if(G.active!==s) return 'No es tu turno';
  if(G.phase!=='principal'&&G.phase!=='combate') return 'Todavía no es la fase de jugar cartas';
  if(costOf(id,s)>P(s).pd) return `Cuesta ${costOf(id,s)} PD y tienes ${P(s).pd}`;
  if(c.t==='personaje'&&P(s).field.length>=5) return 'Tu campo está lleno: caben 5 Personajes';
  if(c.t==='trampa'&&P(s).traps.length>=3) return 'Tu zona de Trampas está llena: caben 3';
  /* Faltaba: un Objeto de equipo necesita a alguien con hueco. Sin esto el
     motivo salía como «no hay objetivos válidos», que no dice qué falta. */
  if(c.t==='objeto'&&c.equip&&!P(s).field.some(u=>u.objs.length<(u.card.objSlots||1)))
    return 'No hay ningún Personaje tuyo con hueco para otro Objeto';
  if(c.scroll) return 'Necesitas 2 Llaves del Domo (o controlar a Tal)';
  if(c.req&&!c.req(G,s)) return 'Ahora mismo no se cumple lo que pide esta carta';
  if(c.tg){ for(const g of c.tg) if(g.min>0 && !targetPool(s,g,null,c).length)
    return `No hay ${g.label||'objetivos'} válidos para esta carta`; }
  return 'No se puede jugar ahora mismo';
}
/* ==========================================================================
   EL RELOJ DE TURNO — 1:30, y si se acaba pasa el turno
   --------------------------------------------------------------------------
   Sólo corre en TU turno y sólo cuando hay alguien mirando: en el tutorial no
   —va a su ritmo y te para a explicarte cosas—, ni en partidas automáticas, ni
   mientras el juego resuelve algo. Si llega a cero, termina el turno igual que
   si pulsaras el botón: no se descarta nada ni se pierde nada, sólo se pasa.
   ======================================================================== */

const RELOJ_TURNO = 90;                          // segundos

let RELOJ = {queda:0, id:null};

function relojArranca(){
  relojPara();
  if(!G || G.over || G.auto || G.silent || G.tutorial) return;
  if(G.active!==ME) return;                      // el rival no juega contra reloj
  RELOJ.queda = RELOJ_TURNO;
  relojPinta();
  RELOJ.id = setInterval(()=>{
    if(!G || G.over || G.active!==ME){ relojPara(); return; }
    if(G.busy || G.resolving) return;            // no corre mientras se resuelve algo
    RELOJ.queda--;
    relojPinta();
    if(RELOJ.queda<=0){
      relojPara();
      log('⏱️ Se acabó el tiempo: pasa el turno.','sys');
      if(NET.guest) gIntent('end'); else endTurn();
    }
  },1000);
}

function loQuePodriasHacer(s){
  const p=P(s), L=p.L, out=[];
  const n=p.hand.filter(id=>canPlay(s,id)).length;
  if(n) out.push(n===1 ? 'jugar <b>1 carta</b>' : `jugar <b>${n} cartas</b>`);
  if(!p.leaderUsed && p.pd>=L.habCost && (!L.habReq||L.habReq(G,s)))
    out.push(`usar <b>${L.habName}</b>`);
  p.field.forEach(u=>{ const a=u.card.act;
    if(a && !u.actUsed && p.pd>=a.cost && !u.stunned && !u.possessed && (!a.req||a.req(G,s)))
      out.push(`usar <b>${a.n}</b> de ${u.card.n}`);
  });
  return out;
}

function terminarTurnoYa(){
  SEL=null; clearPrompt();
  if(NET.guest){ gIntent('end'); return; }
  endTurn();
}

function pedirTerminarTurno(){
  if(!G||G.over||G.active!==ME||G.busy) return;
  SEL=null; clearPrompt();
  /* En el tutorial no se pregunta: sus pasos guionan cuándo se termina el
     turno, y una pregunta de más lo deja atascado. */
  if(G.tutorial){ terminarTurnoYa(); return; }
  const p=P(ME);
  const hacer = p.pd>0 ? loQuePodriasHacer(ME) : [];
  if(!hacer.length){ terminarTurnoYa(); return; }

  const lista = hacer.length>3 ? hacer.slice(0,3).join(', ')+' y algo más'
              : hacer.length>1 ? hacer.slice(0,-1).join(', ')+' o '+hacer[hacer.length-1]
              : hacer[0];
  const machete = p.field.find(u=>u.card.bank);
  const guarda = machete ? Math.min(2,p.pd) : 0;
  const nota = guarda
    ? ` 🎒 Machete guardará ${guarda} para el próximo turno; ${p.pd-guarda>0?'el resto se':'no se'} pierde${p.pd-guarda>0?'':'n'}.`
    : ' Los PD no se guardan: se pierden.';

  setPrompt(`Te quedan <b>${p.pd} PD</b> y todavía puedes ${lista}.${nota} ¿Terminar el turno?`, [
    {t:'Sigo jugando', cls:'gold', fn:()=>{ clearPrompt(); render(); }},
    {t:'Terminar turno ⏭', fn:terminarTurnoYa}
  ]);
}

function porQueNoAtaca(u){
  if(!u) return 'No hay carta';
  if(!u.alive) return 'Ya no está en el campo';
  if(G.over) return 'La partida ha terminado';
  if(u.stunned>0) return 'Está Aturdido: no puede atacar hasta el final de tu siguiente turno';
  if(u.attacked) return 'Ya atacó este turno';
  if(u.sick&&!u.keys.has('prisa')) return 'Entró al campo este turno; podrá atacar en tu próximo turno (le falta Prisa)';
  if(u.atk<=0) return 'Tiene 0 de ATQ: sin ataque no puede pelear';
  if(u.card.noAttack) return 'Esta carta nunca puede atacar';
  if(u.blind) return 'Está cegado y no puede atacar';
  if(u.card.clause&&!u.noClause&&!hasContract(u.side)) return 'Cláusula: sólo puede atacar si controlas un Contrato';
  if(P(u.side).pd<1 && P(1-u.side).field.some(o=>o.card.toll&&o.alive))
    return 'Peaje de Brick y Brock: atacar cuesta 1 PD y no te queda ninguno';
  return 'No puede atacar (motivo sin explicar: avísanos)';
}

/* Por qué ESE objetivo no vale. Es distinto de porQueNoAtaca: ahí la carta no
   puede atacar a nadie; aquí puede, pero no a lo que has señalado. Antes sólo
   salía «Objetivo ilegal», que no dice nada — sobre todo con Provocar, que es
   la razón nueve de cada diez veces. */

function porQueNoEsObjetivo(u, target){
  const lt = legalTargets(u);
  const alAlma = target==='face';

  if(alAlma && !lt.face){
    const muros = lt.units.filter(o=>o.keys.has('provocar'));
    if(muros.length){
      const n = muros.map(o=>o.card.n).join(', ');
      return muros.length===1
        ? `<b>${n}</b> tiene <b>Provocar</b>: hay que atacarlo a él antes que al Alma`
        : `<b>${n}</b> tienen <b>Provocar</b>: hay que atacarlos antes que al Alma`;
    }
    if(u.card.id==='tal') return 'Tal no puede atacar al Alma mientras el rival tenga un rehén';
    return 'No puedes atacar al Alma ahora mismo';
  }

  if(!alAlma){
    if(!target.alive) return 'Ese Personaje ya no está en el campo';
    if(target.keys.has('sigilo') && !target.revealed)
      return `<b>${target.card.n}</b> está en <b>Sigilo</b>: no se le puede elegir hasta que ataque`;
    if(target.keys.has('vuelo') && !u.keys.has('vuelo') && !u.keys.has('arquero'))
      return `<b>${target.card.n}</b> tiene <b>Vuelo</b>: sólo le llegan los que vuelan o tienen Arquero`;
    const muros = lt.units.filter(o=>o.keys.has('provocar'));
    if(muros.length && !lt.units.includes(target))
      return `<b>${muros.map(o=>o.card.n).join(', ')}</b> tiene <b>Provocar</b>: hay que atacarlo a él primero`;
  }
  return 'Ese objetivo no es legal ahora mismo';
}

function selectUnit(u){
  if(G.active!==ME) return;
  if(!canAttack(u)){
    SEL=u; render(); fichaTactil(u);
    const why = porQueNoAtaca(u);
    // también al Registro: si sólo sale en el cartel, se pierde al cerrarlo
    log(`<b>${u.card.n}</b> no puede atacar — ${why}.`,'sys');
    setPrompt(`${u.card.n} — ${why}`,[{t:'Cerrar',fn:()=>{SEL=null;clearPrompt();render();}}]);
    return;
  }
  SEL=u;
  const lt=legalTargets(u);
  setPrompt(`⚔️ ${u.card.n} (${u.atk} ATQ) — elige objetivo${lt.face?' o ataca al Alma rival':''}`,
    [{t:'Cancelar',fn:()=>{SEL=null;clearPrompt();render();}}]);
  render();
  fichaTactil(u);
}
/* En táctil no hay hover, así que tocar una unidad —para atacar con ella o
   para ver por qué no puede— enseña también su ficha, anclada arriba, sin
   tapar la mano ni bloquear la elección del objetivo (el panel no recibe
   toques). Se cierra sola al deseleccionar. */

async function tryAttack(u,t){
  clearPrompt(); const uu=u; SEL=null;
  if(NET.guest){ gIntent('attack',{uid:uu.uid, target:(t==='face'?'face':t.uid)}); render(); return; }
  const ok=await doAttack(uu,t);
  if(!ok) render();
}

/* ==========================================================================
   10. INTELIGENCIA DEL RIVAL
   ========================================================================== */

function aiTargets(s, groups, self, card){
  const out=[]; let abort=false;
  const id = card && card.id;
  groups.forEach(g=>{
    const pool=targetPool(s,g,self,card);
    if(!pool.length){ if(g.min>0) abort=true; out.push([]); return; }
    let n = g.min||0;
    if(g.rep) n=g.max;
    else if(['manosardientes','auxilio','leche'].includes(id)) n=Math.min(g.max,pool.length);
    else n=Math.max(g.min, Math.min(1,g.max));
    if(n===0 && g.max>0 && ['petunia','rantiago'].includes(id)) n=1;
    const picked=[];
    const enemyish = g.k==='unidadEnemiga'||g.k==='objetivoEnemigo'||g.k==='objetoEnemigo';
    for(let i=0;i<n;i++){
      let cand=pool.filter(x=>g.rep||!picked.includes(x));
      if(!cand.length) break;
      let best;
      if(g.k==='objetivoEnemigo'){
        const units=cand.filter(x=>x!=='face'&&x.alive);
        const weak=units.sort((a,b)=>(a.maxHp-a.dmg)-(b.maxHp-b.dmg))[0];
        best = (weak && (weak.maxHp-weak.dmg)<=1) ? weak : (cand.includes('face')?'face':(weak||cand[0]));
      } else if(enemyish){
        const val=x=>(x&&x.id&&CARDS[x.id])?CARDS[x.id].c*3:(x.atk*2+x.maxHp);
        best = cand.slice().sort((a,b)=>val(b)-val(a))[0];
      } else {
        const beneficial = !['modificar','edbor','magodomo','hongos'].includes(id);
        best = cand.slice().sort((a,b)=> beneficial ? (b.atk+b.maxHp)-(a.atk+a.maxHp) : (a.atk+a.maxHp)-(b.atk+b.maxHp))[0];
      }
      picked.push(best);
    }
    if(picked.length<g.min) abort=true;
    out.push(picked);
  });
  return abort?null:out;
}

function aiScore(id,s){
  const c=CARDS[id], p=P(s), foe=P(1-s);
  const cost=costOf(id,s);
  let v=0;
  switch(c.t){
    case 'personaje':
      v = 20 + (c.a||0)*2 + (c.h||0) + cost*2;
      if(p.field.length>=4) v-=6;
      if(c.id==='tal') v+=60;
      break;
    case 'objeto':
      if(c.scroll) return 500;
      if(c.keyRelic) return 60;
      if(c.relic) return 14;
      v = p.field.length? 12+(c.mod?(c.mod.a||0)*2+(c.mod.h||0):0) : 0;
      break;
    case 'trampa': v = 14 - p.traps.length*3; break;
    case 'lugar': v = G.place && G.place.side===s ? 2 : 12; break;
    case 'hechizo': {
      const en=foe.field, my=p.field;
      if(c.fast) return 0;                                  // se guardan para respuesta
      if(['alientoacido','bolafuego'].includes(id)) v = en.length>=2 ? 26+en.length*6 : 4;
      else if(id==='manosardientes') v = en.filter(u=>u.card.c<=3).length*11;
      else if(id==='sangrefria') v = en.some(u=>u.card.c<=2)?24:0;
      else if(['saeta','burla','escarcha','proyectil','rayoabrasador'].includes(id))
        v = en.length? 16 + (en.some(u=>u.maxHp-u.dmg<=3)?10:0) : (id==='rayoabrasador'?14:0);
      else if(['balada','cantaberna','taumaturgia'].includes(id)) v = my.filter(u=>canAttack(u)).length*9;
      else if(['bendicion','auxilio','armadura','armamagica'].includes(id)) v = my.length?13:0;
      else if(id==='leche') v = my.filter(u=>u.dmg>0).length*8;
      else if(id==='palabracuracion') v = my.some(u=>u.dmg>=3)?12:6;
      else if(id==='hongos') v = 12;
      else if(id==='ilusion') v = 11;
      else if(id==='zancada'||id==='disfrazarse') v = my.some(u=>canAttack(u))?10:0;
      else if(id==='espiritus') v = en.length?18:6;
      else if(id==='mensaje') v = 9;
      else if(id==='disipar') v = allObjects(1-s).length?20:3;
      else if(id==='rulchete') v = 26;
      else if(id==='campanafe') v = 22;
      else if(id==='acertijo') v = en.length?15:0;
      else if(id==='cuerda') v = my.filter(u=>u.dmg>0).length>=2?14:2;
      else if(id==='pasoatronador') v = en.length?12:4;
      else if(id==='calentarmetal') v = 15;
      else if(id==='ceguera') v = en.some(u=>u.atk>=4)?17:3;
      else if(id==='luzhadas') v = en.some(u=>u.keys.has('vuelo')||u.keys.has('sigilo'))?14:3;
      else if(id==='copiajabon') v = 10;
      else if(id==='modificar') v = 16;
      else if(id==='nubedagas') v = 12;
      else v = 8;
      break; }
  }
  return v - Math.max(0,cost-p.pd)*100;
}

function aiPickAttack(u){
  const lt=legalTargets(u);
  const foeAlma=P(1-u.side).alma;
  const cands=lt.units.filter(t=>t.alive).map(t=>{
    const rem=t.maxHp-t.dmg, myRem=u.maxHp-u.dmg;
    const kills=u.atk>=rem, dies=t.atk>=myRem;
    let sc=(kills? 14+t.card.c*3 : Math.min(u.atk,rem)*1.5) - (dies? 10+u.card.c*3 : 0);
    if(t.keys.has('provocar')) sc+=3;
    if(t.card.id==='tal'||t.card.r===2) sc+=4;
    return {t,sc};
  }).sort((a,b)=>b.sc-a.sc);
  const faceSc = lt.face ? (u.atk>=foeAlma ? 999 : u.atk*2.2) : -999;
  if(cands.length && cands[0].sc>faceSc) return cands[0].t;
  if(lt.face) return 'face';
  return cands.length? cands[0].t : null;
}

async function aiTurn(){
  const s=FOE; if(G.over) return;
  // Sello de la partida: el turno del rival hace muchas pausas, y en cualquiera
  // de ellas puede arrancar otra partida. Si eso pasa, esta IA tiene que morir
  // en el sitio en vez de seguir jugando sobre la mesa nueva.
  const miG = G, viva = () => G === miG;
  if(G.tutorial && TUT.on){                    // durante el tutorial el rival va guionizado
    G.busy=true; let scripted=false;
    try{ scripted=await tutFoeTurn(); } finally{ if(viva()) G.busy=false; }
    if(scripted){ if(viva() && !G.over){ await nap(560); if(viva()) await endTurn(); } return; }
  }
  G.busy=true;
  // 200 ms era ilegible: sus jugadas pasaban antes de que te dieras cuenta.
  const pause = ()=>nap(G.tutorial?700:820);
  try{
    let guard=0, played=0; const skip=new Set();
    const maxPlays = 12;
    while(guard++<16 && viva() && !G.over && played<maxPlays){
      const opts=P(s).hand.filter(id=>canPlay(s,id)&&!skip.has(id))
        .map(id=>({id,v:aiScore(id,s)})).filter(o=>o.v>0)
        .sort((a,b)=>b.v-a.v);
      if(!opts.length) break;
      await pause();
      if(await playFromHand(s,opts[0].id)) played++; else skip.add(opts[0].id);
    }
    if(!viva() || G.over) return;
    // habilidades activadas
    for(const u of [...P(s).field]){
      if(u.card.act && !u.actUsed && P(s).pd>=u.card.act.cost && (!u.card.act.req||u.card.act.req(G,s))){
        await pause(); if(!viva()) return; await useAct(u);
      }
    }
    // habilidad de líder
    const L=P(s).L;
    if(!P(s).leaderUsed && P(s).pd>=L.habCost && (!L.habReq||L.habReq(G,s))){
      await pause(); if(!viva()) return; await useLeader(s);
    }
    if(!viva() || G.over) return;
    // combate
    G.phase='combate';
    let atkGuard=0;
    while(atkGuard++<12 && viva() && !G.over){
      const ready=P(s).field.filter(canAttack).sort((a,b)=>b.atk-a.atk);
      if(!ready.length) break;
      const u=ready[0];
      const t=aiPickAttack(u);
      if(!t){ u.attacked=true; recalc(); continue; }
      await pause();
      if(!viva()) return;
      // Si el ataque no llega a hacerse, esta unidad se da por gastada: sin
      // esto el bucle la reintentaba con el mismo resultado hasta agotar el
      // tope, y cada vuelta se lleva su pausa.
      if(!await doAttack(u,t)){ u.attacked=true; recalc(); }
    }
  } finally { if(viva()) G.busy=false; }
  if(viva() && !G.over){ await nap(560); if(viva()) await endTurn(); }
}

/* ==========================================================================
   11. TUTORIAL — Dungeon Master Gero
   ========================================================================== */
/* Tres clases de paso:
     say  → Gero explica; avanzas con el botón.
     task → tienes que hacer algo; se auto-avanza al conseguirlo.
     beat → espera un EVENTO de la partida (casi siempre del rival) y, cuando
            ocurre, PAUSA el motor y lo explica. Es lo que deja ver y entender
            los movimientos del enemigo en vez de que pasen en dos segundos.   */
/* El reparto de cada mazo: qué carta hace de qué en las lecciones. Todas salen
   de la lista real del Protagonista, así que el tutorial te enseña TU mazo. */

const TUT_MAZO = {
fender:{ c1:'discipulo', c2:'bartolomeo', quita:'burla', trampa:'tasha',
  mano:['discipulo','bartolomeo','burla','tasha','cantaberna'],
  top:['balada','matildus','discipulo','zancada','escarcha','adolfo'],
  quitaTxt:`<b>Burla Viciosa</b> (1 PD): 1 daño y −2 ATQ. Con lo poco que le queda, sobra.`,
  quitaExtra:`Y ha pasado algo más: Burla Viciosa es una <b>Canción</b>, y tu pasiva
    <b>Inspiración</b> acaba de regalarle <b>+1 ATQ permanente</b> a un aliado. Ese punto
    ya no se va al acabar el turno: encadenar Canciones es todo tu plan de ataque, y lo que
    construyes se queda.`,
  trampaTxt:`<b>Risa Incontrolable de Tasha</b> (2 PD): cuando un Personaje rival declare un
    ataque, se lo cancelas y encima queda <b>Aturdido</b>.` },
mohamed:{ c1:'conserje', c2:'bartolomeo', quita:'sangrefria', trampa:'tasha',
  mano:['conserje','bartolomeo','sangrefria','tasha','ilusion'],
  top:['mensaje','machete','brickbrock','acertijo','disipar','minus'],
  quitaTxt:`<b>Golpe a Sangre Fría</b> destruye cualquier Personaje de Costo 2 o menos.`,
  quitaExtra:`Fíjate en el precio: la carta pone 3, pero tú has pagado <b>2</b>. Es un Hechizo
    de <b>Engaño</b> y tu pasiva te los abarata todos en 1. Medio mazo lo es.`,
  trampaTxt:`<b>Risa Incontrolable de Tasha</b> (2 PD): cancela un ataque rival y deja al
    atacante <b>Aturdido</b>. Tu mazo va de que atacarte salga caro.` },
adreida:{ c1:'machete', c2:'bartolomeo', quita:'saeta', trampa:'colapso',
  mano:['machete','bartolomeo','saeta','colapso','augusto'],
  top:['mazo','horton','auxilio','armadura','lucius','brickbrock'],
  quitaTxt:`<b>Saeta Guía</b> (2 PD): 3 daño radiante, de sobra.`,
  quitaExtra:`Y deja al objetivo <b>marcado</b>: el siguiente ataque tuyo contra él no recibe
    contraataque. Junta eso con tu Habilidad <b>Golpe Directo</b> y matas lo que quieras sin
    recibir un solo punto de daño.`,
  trampaTxt:`<b>Colapso de Paja</b> (3 PD): cuando ataque un Personaje rival de Costo 4 o más,
    se lleva 4 de fuego, su ataque se cancela y queda <b>Aturdido</b>.` },
rafaela:{ c1:'discipulo', c2:'titaus', quita:'saeta', trampa:'destello',
  mano:['discipulo','titaus','saeta','destello','taumaturgia'],
  top:['discipulo','matildus','leche','bendicion','espiritus','machete'],
  quitaTxt:`<b>Saeta Guía</b> (2 PD): 3 daño radiante, de sobra.`,
  quitaExtra:`Ojo a algo que ya ha pasado sin que lo pidieras: cada <b>Discípulo</b> que entra
    a tu campo cura 2 por tu pasiva <b>Rebaño de Rul</b>. Por eso puedes permitirte recibir
    golpes que a otro mazo lo hundirían.`,
  trampaTxt:`<b>Destello Protector</b> (2 PD): cuando vayan a matarte un aliado, reduce ese
    daño a la mitad. Tu mazo no gana rápido: gana no muriéndose.` },
gero:{ c1:'machete', c2:'correcaminos', quita:'brujula', trampa:'ciclope',
  mano:['machete','correcaminos','brujula','ciclope','can'],
  top:['minus','aidman','brickbrock','rambo','coyote','spiderman'],
  quitaTxt:`<b>Brújula «She vale el doble»</b> (2 PD): 2 daño a un Personaje rival, y si eso
    lo mata robas <b>2 cartas</b>.`,
  quitaExtra:`Y ahora la parte que, la verdad, me da un poco de cosa explicar.<br><br>
    Mi pasiva es <b>El dado decide</b>: al inicio de cada turno tuyo —mío— se tira un
    <b>d20</b>. Con <b>15 o más</b> ganas <b>2 PD</b> de golpe. Con <b>10 o menos</b> pierdes
    <b>1 Alma</b>. Y no, no puedes repetirla.<br><br>
    Llevo cuatro temporadas diciéndole a la gente que las tiradas no se discuten. Ahora
    resulta que a mí también me tocan. Me parece bien. Me parece muy bien. No pasa nada.`,
  trampaTxt:`<b>Juguetes para el Cíclope</b> (2 PD): cuando un Personaje rival ataque, el
    ataque se cancela y aparecen <b>2 Ilusiones</b> de señuelo. Dos cuerpos más en tu mesa,
    que es exactamente lo que tu plan necesita.` },
talesin:{ c1:'matildus', c2:'eric', quita:'proyectil', trampa:'esporas',
  mano:['matildus','eric','proyectil','esporas','conserje'],
  top:['rayoabrasador','puntosrobados','alientoacido','matildus','escarcha','proyectil'],
  quitaTxt:`<b>Proyectil Mágico</b> (2 PD): 3 daño repartidos, y no hay Trampa que lo anule.`,
  quitaExtra:`Y lo importante de tu mazo: cuando muere un aliado <b>tuyo</b> ganas una
    <b>✨ Ficha de Gracia</b> — míralas en tu barra. Con cinco asciendes: +5 Alma y tus
    Celestiales +2/+2. Y de ahí en adelante <b>todo lo que bajes nace Celestial y con
    +2/+2</b>, así que tu campo se rehace más fuerte de lo que era. Aquí morir es parte
    del plan.`,
  trampaTxt:`<b>Esporas del Demonio</b> (2 PD): cuando muera un aliado tuyo, <b>todo</b> el
    campo rival queda Infectado. Tus muertes tienen que doler a alguien.` }
};

/* Guion del rival (siempre Adreida): así las lecciones encajan con la mesa. */

const TUT_FOE_SCRIPT = [
  {play:['bartolomeo'], attack:false},   // T1: baja un cuerpo, no ataca
  {play:['mazo'],       attack:true },   // T2: Objeto → 4 ATQ → Provocar → choca
  {play:['augusto'],    attack:true },
  {play:['horton'],     attack:true },   // T4: cuesta 4, dispara Colapso de Paja
  {play:['eric'],       attack:true },
  {play:['lucius'],     attack:true },
  {play:['brickbrock'],  attack:true },   // antes el Trol, que salió del mazo en la v2
];

function buildTut(lid){
  const M=TUT_MAZO[lid], L=LEADERS[lid], G0=GUIAS[lid];
  const n=id=>CARDS[id].n;
  const yo=L.n, rival='Adreida';
  const soyYo = lid==='gero';        // el DM narrando su propio mazo
  return [
{t: soyYo ? [
    `¡Al Domo se entra sin saber jugar, se sale sabiendo! Soy <b>Gero</b>, el Dungeon Master.`,
    `Llevas a <b>Gero</b> 🎲 y su mazo <b>“${DECKS[lid].n}”</b> contra <b>${rival}</b> ⚔️, y…<br><br>
     Un momento.`,
    `<b>Gero</b> soy yo.<br><br>
     ¿Me llevas… a mí? ¿Voy a explicarme a mí mismo cómo se juega conmigo?`,
    `Vale. Vale, vale. Nadie me conoce mejor, eso está claro.<br><br>
     Si me oyes decir “su mazo” y “mi mazo” en la misma frase, es que estoy improvisando —
     que es literalmente mi Habilidad. Vamos allá.`,
    `No te voy a soltar el reglamento de golpe: jugamos con <b>tus</b> cartas (mis cartas) y
     te explico las cosas cuando aparecen. También voy a <b>parar la partida en el turno de
     ella</b> para contarte qué hace y por qué.`
  ] : [
    `¡Al Domo se entra sin saber jugar, se sale sabiendo! Soy <b>Gero</b>, el Dungeon Master.`,
    `Llevas a <b>${yo}</b> ${L.art} y su mazo <b>“${DECKS[lid].n}”</b> contra <b>${rival}</b> ⚔️.<br><br>
     No te voy a soltar el reglamento de golpe: jugamos con <b>tus</b> cartas y te explico las
     cosas cuando aparecen. También voy a <b>parar la partida en el turno de ella</b> para
     contarte qué hace y por qué.`]},

{hi:'#leaderMe', t:`Lo único que importa de verdad: <b>❤️ Alma 20</b>, la que lleva tu carta de Líder.<br><br>
  Si dejas la de ${rival} en <b>0</b>, ganas. Si la tuya llega a 0, el Mago del Domo se queda
  con tu alma. Todo lo demás son herramientas para eso.`},

{hi:'#barMe', t:`<b>🔷 PD (Puntos)</b> es lo que puedes gastar cada turno. Ahora tienes <b>1</b>.<br><br>
  Tu máximo sube <b>+1 cada turno</b> hasta 10 y <b>se rellena solo</b>. No hay que ahorrar:
  el turno 5 tendrás 5, quieras o no.`},

{hi:'#hand', wait:g=>tutJugada(M.c1), allow:{hand:[M.c1], end:true},
 t:`Empieza tu mesa: <b>pulsa ${n(M.c1)}</b> para jugarla.<br><br>
    El <b>borde verde</b> quiere decir "puedes pagarla ahora mismo"; las grises, no.
    Y el color del borde te dice de qué clase es: <b>Personajes en azul</b>,
    <b>Hechizos en violeta</b>, <b>Trampas en rojo</b>, <b>Objetos en amarillo</b> y
    <b>Lugares en verde</b>.
    ${CARDS[M.c1].c>1?'Si todavía no te alcanza, termina el turno y la juegas al siguiente: en este mazo el turno 1 suele estar vacío.':''}`},

{hi:'#myField', t:[`Ya está en tu <b>Campo</b> (caben 5 Personajes).`,
  `Fíjate en que se ve apagado: <b>un Personaje no puede atacar el turno que entra</b>.
   Llega cansado del viaje. Sólo las cartas que dicen <b>Prisa</b> se saltan esa espera.`]},

{hi:'#controls', wait:g=>g.active===FOE, allow:{end:true},
 t:`Pulsa <b>Terminar turno</b> y vemos qué hace ella.`},

/* ---------- turno 1 del rival ---------- */
{on:'turno', when:(g,d)=>d.side===FOE, hi:'#barFoe',
 wait_t:'<i>Empieza el turno de Adreida…</i>',
 t:`Turno de ${rival}. <b>Voy parando la partida en cada jugada suya</b> para que veas qué pasa.
    Ella juega con tus mismas reglas: le subió el máximo de PD y robó una carta.`},

{on:'juega', when:(g,d)=>d.side===FOE, hi:'#foeField',
 wait_t:'<i>A ver qué baja…</i>',
 /* También se arma con lo que ha bajado: antes explicaba la habilidad de
    Bartolomeo aunque hubiera jugado otra cosa. */
 t:(g,d)=>{
   const c=CARDS[d.id], p=[`Jugó a <b>${c.n}</b>.`];
   if(/Al entrar/i.test(c.x||''))
     p.push(`Y mira lo que dice su carta: "<b>Al entrar</b>…". Esas palabras se resuelven en
       cuanto toca la mesa, no cuando ataca. Casi todos los Personajes traen habilidad
       escrita: léelas, ahí está el juego.`);
   else if(c.x)
     p.push(`Y lee su carta antes de decidir nada: <i>${c.x.replace(/<[^>]+>/g,'')}</i>.
       Casi todos los Personajes traen habilidad escrita, y ahí está el juego.`);
   else
     p.push(`Casi todos los Personajes traen una habilidad escrita en la carta. Léelas antes
       de decidir a quién pegas: ahí está el juego.`);
   return p;
 }},

{on:'finTurno', when:(g,d)=>d.side===FOE,
 wait_t:'<i>Sigue su turno…</i>',
 t:`No atacó: <b>su Personaje también entró cansado</b>. Las reglas van para los dos.`},

/* ---------- turno 2 del jugador ---------- */
{on:'turno', when:(g,d)=>d.side===ME, hi:'#barMe',
 wait_t:'<i>Vuelve tu turno…</i>',
 t:`Tu turno otra vez. Sin hacer nada: <b>+1 PD</b> y <b>+1 carta</b>. Y lo que bajaste ya no
    está apagado: tiene el borde verde de "listo para atacar".`},

{hi:'#hand', wait:g=>tutJugada(M.c2), allow:{hand:[M.c2], end:true, attack:true},
 t:`Suma otro cuerpo: juega <b>${n(M.c2)}</b>.${CARDS[M.c2].c>2?' Si aún no te alcanza, termina el turno y lo bajas al siguiente.':''}<br><br>
    En este juego la mesa lo es todo: el que tiene más Personajes decide contra qué se pelea.`},

/* Este paso espera a que ataques DE VERDAD (antes se daba por cumplido con sólo
   terminar el turno, y entonces te saltabas la lección). Puede pasar
   perfectamente que ahora mismo no tengas a nadie: si el rival te mató lo que
   bajaste primero, lo único que te queda es lo que acabas de jugar, y eso entra
   cansado. Por eso el texto te dice que termines el turno — y el paso sigue
   aquí, esperándote, hasta que puedas pegar. */
{hi:'#myField', wait:g=>P(FOE).alma<20, allow:{attack:'face', end:true},
 t:g=>`Ahora golpea. <b>Haz clic en un Personaje tuyo con borde verde</b> y luego en la
    <b>carta de ${rival}</b>, al borde de su lado del tapete.` +
    (P(ME).field.some(u=>canAttack(u)) ? '' :
     `<br><br><i>Ahora mismo no tienes a nadie con borde verde: lo que acaba de entrar
      está cansado hasta tu próximo turno. <b>Termina el turno</b> y pega en el siguiente.
      No te preocupes, este paso te espera.</i>`)},

{t:[`Menos Alma. Poco, pero así se gana.`,
  `Regla clave: <b>atacar al Alma nunca recibe contraataque</b>. Atacar a un <b>Personaje</b>,
   sí — ahí os pegáis los dos a la vez. Lo vas a ver en tus carnes ahora mismo.`]},

{hi:'#controls', wait:g=>g.active===FOE, allow:{end:true}, t:`Termina el turno.`},

/* ---------- turno 2 del rival: Objetos, Provocar y combate ---------- */
/* El texto se arma con la carta que HA jugado, no con la que el guion esperaba.
   Antes daba por hecho que era el Mazo de Brock, y cuando el rival no podía
   equiparlo —sin Personaje que lo llevara— el guion se lo saltaba y esta
   lección saltaba con la siguiente: llegó a llamar «Objeto» a Augusto Bale. */
{on:'juega', when:(g,d)=>d.side===FOE, hi:'#foeField',
 wait_t:'<i>Turno de Adreida…</i>',
 t:(g,d)=>{
   const c=CARDS[d.id], parr=[];
   if(c.t==='objeto') parr.push(`Ojo: jugó <b>${c.n}</b>, que es un <b>Objeto</b>. Los Objetos
     no van al campo solos: <b>se equipan a un Personaje</b> y se destruyen con él.` +
     (c.mod&&c.mod.a?` Ése le da <b>+${c.mod.a} ATQ</b>.`:''));
   else if(c.t==='personaje') parr.push(`Ojo: bajó a <b>${c.n}</b> — un <b>Personaje</b>, de
     ${c.a} ATQ y ${c.h} PV. Cuenta ya para su campo, pero no puede atacar el turno que entra.`);
   else parr.push(`Ojo: jugó <b>${c.n}</b>.`);
   // el segundo párrafo sólo si de verdad hay algo con Provocar por su pasiva
   const muro = P(FOE).field.find(u=>u.alive && u.keys.has('provocar') && u.atk>=4);
   if(muro) parr.push(`Y mira <b>${muro.card.n}</b>: le ha salido una etiqueta nueva,
     <b>Provocar</b>. No venía en la carta — es la <b>pasiva de Adreida</b>: <i>todo lo suyo con
     4 o más ATQ tiene Provocar</i>. Mientras esté ahí, tus Personajes tienen que pegarle a
     ella antes que a nada.`);
   return parr;
 }},

{on:'ataque', when:(g,d)=>d.side===FOE, hi:'#foeField',
 wait_t:'<i>Está decidiendo a quién pegar…</i>',
 t:(g,d)=>`Va a atacar a <b>${d.target==='face'?'tu Alma':d.target.card.n}</b>, y te conviene
   mirar despacio. En un combate entre Personajes el daño es <b>simultáneo</b>: el atacante
   hace su ATQ <b>y recibe el del defensor</b> en la misma pasada. No hay "bloquear": hay chocar.`},

{on:'muerte', when:(g,d)=>d.side===ME, hi:'#myField',
 wait_t:'<i>…</i>',
 t:[`Ha caído. Se va a <b>las Alcantarillas</b> — la pila de la izquierda del tapete.`,
   `Y aquí va lo que más despista al principio: <b>el daño se queda</b>. No se cura al final
    del turno. Un Personaje tocado sigue tocado hasta que alguien lo cure… o muera.
    <b>Eso lo hace rematable.</b>`]},

/* ---------- turno 3: quitar el Provocar ---------- */
{on:'turno', when:(g,d)=>d.side===ME, hi:'#foeField',
 wait_t:'<i>Vuelve tu turno…</i>',
 t:`Tu turno. Y tienes un problema: <b>ese Personaje suyo tiene Provocar</b>.
    Selecciona uno tuyo y compruébalo: sólo se marca él. <b>Mientras haya un Provocar vivo no
    puedes tocar su Alma</b> ni a ningún otro.`},

{hi:'#hand', wait:g=>!P(FOE).field.some(u=>u.card.id==='bartolomeo')||tutJugada(M.quita), allow:{hand:[M.quita], end:true, attack:true},
 t:`Hay que quitarlo de en medio, y chocando perderías tu Personaje.<br><br>
    ${M.quitaTxt} Juégala y elígelo a él.`},

{pasiva:true, t:[`Fuera. Eso son los <b>Hechizos</b>: se usan una vez, van a las Alcantarillas y resuelven
   lo que tus Personajes no pueden.`, M.quitaExtra]},

/* ---------- Habilidad de Líder ---------- */
{hi:'#leaderMe', wait:g=>P(ME).leaderUsed, allow:{leader:true, end:true},
 t:`Esa carta del borde del tapete es <b>tu Líder</b>: ahí vive tu ❤️ Alma y su Habilidad.<br><br>
    <b>${L.habName}</b> cuesta ${L.habCost} PD y se usa <b>una vez por turno</b>.
    ${L.hab.replace(/^<b>[^<]*<\/b>\s*/,'')}<br><br>
    <i>Haz clic en tu carta de ${yo}.</i>`},

{hi:'#myField', wait:g=>P(FOE).alma<19||g.active===FOE, allow:{attack:true, end:true},
 t:`Sin Provocar delante, el camino está libre otra vez. <b>Ataca</b>.<br><br>
    <i>Si en este momento no te queda nadie en pie, no pasa nada: termina el turno.</i>`},

{t:`Ese es el orden bueno de un turno: <b>primero los buffs y los hechizos, después los
    ataques</b>. Si atacas antes de buffear, el daño extra se pierde. Es el error número uno.`},

{hi:'#controls', wait:g=>g.active===FOE, allow:{end:true}, t:`Termina el turno.`},

{on:'finTurno', when:(g,d)=>d.side===FOE, hi:'#foeField',
 wait_t:'<i>Turno de Adreida…</i>',
 t:`Cada cosa que le matas le cuesta un turno entero de recuperarse. Eso es <b>tempo</b>, y
    en este juego vale tanto como el daño.`},

/* ---------- Trampas ---------- */
{on:'turno', when:(g,d)=>d.side===ME, hi:'#hand',
 wait_t:'<i>Vuelve tu turno…</i>',
 t:`Toca la última pieza que te falta por conocer: las <b>Trampas</b>.`},

{hi:'#hand', wait:g=>P(ME).traps.length>=1||tutJugada(M.trampa), allow:{hand:[M.trampa], end:true, attack:true},
 t:`Coloca <b>${n(M.trampa)}</b>.<br><br>${M.trampaTxt}<br><br>
    Se pone <b>boca abajo</b>: ${rival} ve que hay algo ahí, pero no sabe qué.`},

{t:[`No la activas tú. <b>Se dispara sola</b> cuando ocurre su condición, casi siempre en el
   turno de ella.`,
  `Sólo por estar ahí boca abajo ya le complica las cuentas. Cierra el turno y vamos a ver
   cuándo salta.`]},

/* Era el único hueco del tutorial donde se podía hacer cualquier cosa. Se cierra
   como los demás: aquí lo único que hace falta es terminar el turno. */
{hi:'#controls', wait:g=>g.active===FOE, allow:{end:true}, t:`Termina el turno.`},

{on:'trampa',
 wait_t:'<i>Atento a lo que hace…</i>',
 t:(g,d)=>[`💥 <b>¡Saltó tu Trampa!</b> Se dio la vuelta sola.`,
   `<b>${CARDS[d.id].n}</b> ha hecho su trabajo sin que tú tocaras nada. Una Trampa barata boca
    abajo hace que el rival juegue con miedo: ése es medio juego de control.`]},

/* ---------- estrategia del mazo ---------- */
{strat:true, on:'turno', when:(g,d)=>d.side===ME, hi:'#leaderMe',
 wait_t:'<i>Vuelve tu turno…</i>',
 t:[`Ya sabes jugar. Ahora lo que de verdad importa: <b>cómo gana ESTE mazo</b>, porque no
    todos ganan igual.`,
   `<b>${DECKS[lid].n}</b> — ${DECKS[lid].d}.<br><br>${G0.ganas}`]},

{strat:true, t:[`<b>Tu motor:</b> ${G0.motorTxt}`,
   `<b>La jugada que buscas:</b> ${G0.combo}`]},

{strat:true, t:[`<b>Y así es como se pierde con él:</b><br><br>• ${G0.pierdes[0]}`,
   `• ${G0.pierdes[1]}<br><br>• ${G0.pierdes[2]}`]},

...(soyYo ? [{strat:true, t:[
   `Y ya está: te he enseñado a jugar <b>conmigo</b>, contra una jugadora a la que también
    dirijo yo, con unas reglas que escribí yo.`,
   `Es la primera vez que el Dungeon Master no puede perder. Quiero que conste que <b>no</b>
    lo he hecho a propósito.`]}] : []),

{strat:true, t:[`Lo que queda por saber está escrito en las cartas: <b>Prisa</b>, <b>Vuelo</b> (sólo lo
   alcanzan Vuelo o Arquero), <b>Sigilo</b>, <b>Regeneración</b>, <b>Infectado</b>.`,
  `<b>El d20</b>: varias cartas te hacen tirar dado, y <b>lo tiras tú</b>: sale el dado, le das
   y ves el número antes de que pase nada. <b>20 = Crítico</b>, <b>1 = Pifia</b> (falla y
   pierdes 1 Alma).`,
  `<b>La otra forma de ganar</b>: juntar <b>2 🗝️ Llaves del Domo</b> y jugar el
   <b>Pergamino de Deseo Ilimitado</b>. Si aguanta hasta tu segundo turno, ganas sin tocarle
   el Alma.`,
  `Y ya está. Termina la partida y, cuando quieras más, en el menú tienes la <b>guía completa
   de ${yo}</b> con el mazo entero. 🎲`], last:true},
];
}

/* ¿Has jugado esta carta en el paso actual?

   Antes era `!hand.includes(id)`, y con dos copias de la misma carta el paso
   no avanzaba nunca: jugabas una, quedaba la otra en la mano y el tutorial
   seguía pidiéndote lo mismo señalando una carta que ya no podías pagar. A
   Rafaela le llega el segundo Discípulo en el robo del primer turno, así que
   le pasaba siempre.

   No se cuentan copias —eso dependía de cuándo se leyera la mano por primera
   vez, que es justo el tipo de detalle que se rompe solo—: se apunta lo que
   juegas, que es la señal que el motor ya emite. Vale igual para Personajes,
   Hechizos y Trampas, que no dejan rastro en el campo. */

function tutJugada(id){ return !!TUT.jugadas && TUT.jugadas.has(id); }

function tutApunta(side, id){
  if(!TUT.on || side!==ME) return;
  (TUT.jugadas || (TUT.jugadas = new Set())).add(id);
}

let TUT_STEPS=[];

let TUT={i:0,on:false,pending:null,bubble:0,foeTurn:0,data:null,poll:null,block:0,stepTurn:null,jugadas:null,lider:'fender'};

/* Durante el tutorial solo se puede hacer lo que el paso pide: el resto de la
   mano y los botones quedan bloqueados. Así no te pierdes jugando otra cosa. */

function tutAllow(){
  if(!TUT.on) return null;                    // fuera del tutorial, todo permitido
  const s=TUT_STEPS[TUT.i];
  if(!s) return null;
  if(TUT.pending) return {};                  // explicación en pausa: no se toca nada
  // Un beat espera un evento. Si el evento tiene que venir del rival pero todavía es TU
  // turno, hay que dejarte jugar: si no, el cartel te pide terminar el turno con el botón
  // bloqueado y la partida no avanza nunca.
  /* Esperando un evento del rival. Si todavía es tu turno hay que dejarte algo,
     o el tutorial se queda pidiendo lo que no puedes hacer; pero lo único que
     hace falta para llegar a su turno es terminar el tuyo. Antes se abría del
     todo —{free:true}— y podías jugar cualquier cosa en mitad de la lección. */
  if(s.on) return (G && !G.over && G.active===ME) ? (s.allow||{end:true}) : {};
  if(s.wait) return s.allow||{free:true};     // tarea: lo que declare
  return {};                                  // cartel: solo leer
}

function tutCan(kind, data){
  const a=tutAllow();
  if(!a||a.free) return true;
  switch(kind){
    case 'hand':   return !!(a.hand&&a.hand.includes(data));
    case 'end':    return !!a.end;
    case 'leader': return !!a.leader;
    case 'select': return !!a.attack;
    case 'attack': return !!a.attack && (a.attack===true||a.attack===data);
  }
  return false;
}

function tutTexts(s){
  const t = typeof s.t==='function' ? s.t(G,TUT.data) : s.t;
  return Array.isArray(t)? t : [t];
}

function tutSatisfiable(){
  const a=tutAllow();
  if(!a||a.free) return true;
  // Ojo con el orden. Esto NO mide "¿se va a cumplir el paso?", sino "¿puede
  // el jugador hacer algo?": si puedes terminar el turno no estás encerrado,
  // aunque el paso siga pendiente. Probé a poner a.hand primero, para que un
  // paso que pide una carta impagable contara como imposible, y dejó plantado
  // el tutorial de Fender en el paso de la Trampa. Si se vuelve a intentar,
  // hay que correr la suite de tutoriales entera antes de darlo por bueno.
  if(a.end)    return G.active===ME;
  if(a.hand)   return a.hand.some(id=>P(ME).hand.includes(id)&&canPlay(ME,id));
  if(a.leader){ const L=P(ME).L, p=P(ME);
    return G.active===ME&&!p.leaderUsed&&p.pd>=L.habCost&&(!L.habReq||L.habReq(G,ME)); }
  if(a.attack) return G.active===ME&&P(ME).field.some(u=>canAttack(u)&&
    (a.attack==='face'? legalTargets(u).face : legalTargets(u).units.length||legalTargets(u).face));
  return true;
}

function tutCheck(){
  if(!TUT.on||TUT.pending) return;
  const s=TUT_STEPS[TUT.i];
  if(s&&s.on){                               // beat esperando: ¿cambió el aviso?
    if(TUT.hint !== (G && !G.over && G.active===ME)) tutRender();
    // si pasó una ronda entera sin que llegue su evento, seguimos
    if(TUT.stepTurn==null) TUT.stepTurn=G.turnNo;
    else if(G.turnNo-TUT.stepTurn>=3){ TUT.stepTurn=null; tutNext(); }
    return;
  }
  if(!s||!s.wait) return;
  if(TUT.bubble < tutTexts(s).length-1) return;   // aún leyendo
  if(!s.wait(G)){
    // Mientras juega el rival no te toca: el paso no es imposible, es que no es
    // tu momento. Contarlo como bloqueo hacía que Gero se saltara la lección
    // justo cuando su propio texto te decía "si aún no te alcanza, termina el
    // turno y lo bajas al siguiente" — pedía Titaus (3 PD) con 2 PD y luego
    // pasaba de página sin que llegaras a jugarlo.
    if(G.active!==ME || G.busy){ TUT.block=0; return; }
    // paso imposible de cumplir durante un rato: no dejamos a nadie encerrado
    if(tutSatisfiable()) TUT.block=0;
    else if(++TUT.block>14){ TUT.block=0; toast('Gero pasa al siguiente paso');
      // Cada vez que la red tiene que rescatar a alguien es que el guion pedía
      // algo imposible. Se lleva la cuenta porque las pruebas la miran: un
      // tutorial que "termina" a base de rescates no está bien, sólo lo parece.
      (TUT.rescates || (TUT.rescates=[])).push(TUT.i+1);
      setTimeout(()=>{ if(TUT.on&&!TUT.pending&&TUT_STEPS[TUT.i]===s) tutNext(); },400); }
    return;
  }
  TUT.block=0;
  setTimeout(()=>{ if(TUT.on&&!TUT.pending&&TUT_STEPS[TUT.i]===s) tutNext(); },700);
}
/* cierra ya los pasos de acción cumplidos: si no, el evento del motor
   llega antes de que el paso avance y la explicación se pierde */

function tutFlush(){
  let guard=0;
  while(TUT.on && !TUT.pending && guard++<8){
    const s=TUT_STEPS[TUT.i];
    if(!s||!s.wait||s.on||!s.wait(G)) break;
    TUT.bubble=0; TUT.i++; TUT.block=0; TUT.stepTurn=null; TUT.jugadas=null;
    if(s.last){ tutEnd(); return; }
  }
  tutRender();
}
/* eventos de la partida: PAUSAN el motor hasta que el jugador lee */

async function tutFoeTurn(){
  const sc=TUT_FOE_SCRIPT[TUT.foeTurn++];
  if(!sc) return false;
  for(const id of sc.play){
    if(P(FOE).hand.includes(id) && canPlay(FOE,id)){
      await nap(800); await playFromHand(FOE,id); continue;
    }
    /* La lección de este turno cuenta con que baje ALGO —hay pasos esperando a
       verlo—, así que si su carta no se puede jugar baja la que pueda en vez de
       pasar el turno en blanco. Saltárselo en silencio desplazaba las lecciones
       un turno y acababan hablando de la carta equivocada. */
    const otra = P(FOE).hand.find(x=>canPlay(FOE,x));
    if(otra){ await nap(800); await playFromHand(FOE,otra); }
  }
  if(sc.attack){
    let g=0;
    while(g++<5&&!G.over){
      const ready=P(FOE).field.filter(canAttack).sort((a,b)=>b.atk-a.atk);
      if(!ready.length) break;
      const t=aiPickAttack(ready[0]);
      if(!t){ ready[0].attacked=true; recalc(); continue; }
      await nap(750); await doAttack(ready[0],t);
    }
  }
  return true;
}

/* elige con qué mazo aprender: el tutorial se reescribe con sus cartas */

let SELP=null, SELF=null;
/* EL CARRETE DE PROTAGONISTAS.
   Cinco cartas en abanico y la elegida al frente. La posición de cada una sale
   de una sola variable —su distancia al centro— que el CSS convierte en
   desplazamiento, giro, escala y brillo: así el movimiento es coherente y se
   anima solo al cambiar de carta.

   El rival va aparte y en pequeño, en fila de chips: es una decisión menor y
   antes competía con la tuya siendo idéntica. */
/* DOS PASOS: primero tu Protagonista, y cuando lo aceptas, tu rival.
   Los dos usan el mismo carrete: la decisión se toma dos veces igual, y así la
   segunda no parece un apéndice de la primera —antes el rival era una fila de
   fichas idénticas debajo, compitiendo con la tuya. */

let SEL_PASO = 'yo';                            // 'yo' | 'rival'

function estrellas(n){
  const d = Math.max(0, Math.min(3, n|0));
  return '★'.repeat(d) + '☆'.repeat(3-d);
}

/* el botón de en medio: acepta el de este paso y pasa al siguiente */

function selAceptar(){
  if(SEL_PASO === 'yo'){
    SEL_PASO = 'rival';
    if(!SELF || SELF===SELP) SELF = Object.keys(LEADERS).find(x=>x!==SELP);
    buildSelect();
    return;
  }
  startMatch(SELP, SELF);
}

/* girar el carrete: con las flechas, con el teclado o pulsando una carta */

function girarCarrete(paso){
  const ids=Object.keys(LEADERS);
  const actual = SEL_PASO==='yo' ? SELP : SELF;
  const i=Math.max(0, ids.indexOf(actual));
  const nuevo = ids[(i + paso + ids.length) % ids.length];
  if(SEL_PASO==='yo') SELP=nuevo; else SELF=nuevo;
  buildSelect();
}

const RULES_HTML=`
<div class="rules">
<h4>Objetivo</h4>
<p>Deja el <b>Alma</b> del rival en 0, o juega el <b>Pergamino de Deseo Ilimitado</b> y sobrevive dos turnos con él.</p>
<h4>Conceptos base</h4>
<table><tr><th>Término</th><th>Qué es</th></tr>
<tr><td><b>Alma</b></td><td>Tus puntos de vida. Empiezas con 20.</td></tr>
<tr><td><b>Puntos (PD)</b></td><td>Tu recurso. El máximo sube 1 por turno (tope 10) y se rellena al inicio de tu turno.</td></tr>
<tr><td><b>Líder</b></td><td>Tu Protagonista. Tiene una Pasiva siempre activa y una Habilidad que se paga con PD, una vez por turno.</td></tr>
<tr><td><b>Llaves del Domo</b></td><td>Fichas que dan ciertas cartas. Con 2 puedes jugar el Pergamino.</td></tr>
<tr><td><b>d20</b></td><td>20 natural = Crítico. 1 natural = Pifia: la carta falla y pierdes 1 Alma.</td></tr></table>
<h4>Zonas</h4>
<ul><li><b>Campo</b> — hasta 5 Personajes.</li>
<li><b>Zona de Trampas</b> — hasta 3 cartas boca abajo.</li>
<li><b>Zona de Lugar</b> — 1 Lugar activo; el más reciente reemplaza al anterior.</li>
<li><b>Las Alcantarillas</b> — el descarte.</li>
<li><b>Mano</b> — límite de 8 al final de tu turno.</li></ul>
<h4>Mano nueva</h4>
<p>Si en tu <b>primer turno</b> no puedes jugar <b>ninguna</b> carta de tu mano, el juego te
ofrece devolverla entera al mazo, barajarlo y robar otras tantas. <b>Una sola vez</b> por
partida, y la segunda mano es la que hay. Vale igual para tu rival.</p>
<h4>Estructura del turno</h4>
<ol style="margin-left:18px">
<li><b>Fase de Puntos</b> — +1 PD máximo y rellenas. Se aplican los efectos "al inicio de tu turno".</li>
<li><b>Fase de Robo</b> — robas 1. Sin mazo, pierdes 2 Alma.</li>
<li><b>Fase Principal</b> — juegas cartas, colocas Trampas y usas tu Habilidad de Líder.</li>
<li><b>Fase de Combate</b> — cada Personaje ataca una vez. Daño <b>simultáneo</b>; el daño al Alma no genera contraataque.</li>
<li><b>Fase Final</b> — descartas hasta quedarte con 8 cartas.</li></ol>
<p><i>Inicio:</i> cada jugador roba 5. El segundo roba 1 extra y tiene 1 PD extra en su primer turno.</p>
<h4>Tipos de carta</h4>
<ul>
<li><b>Personaje</b> — Costo / ATQ / PV y tribus. Ataca desde tu siguiente turno salvo que tenga Prisa. El daño recibido se queda.</li>
<li><b>Hechizo</b> — efecto inmediato. Subtipos: Engaño, Fe, Canción, Fuego, Contrato, Rápido.</li>
<li><b>Trampa</b> — boca abajo; se activa sola cuando ocurre su condición. Solo una responde a un mismo evento.</li>
<li><b>Objeto</b> — se equipa a un aliado (1 por Personaje, 2 con Machete) o queda en mesa si es Reliquia.</li>
<li><b>Lugar</b> — efecto continuo para ambos jugadores.</li></ul>
<h4>Palabras clave</h4>
<ul>
<li><b>Prisa</b> — puede atacar el turno que entra.</li>
<li><b>Provocar</b> — los rivales deben atacarlo antes que a otros o al Alma.</li>
<li><b>Vuelo</b> — solo lo atacan Vuelo o Arquero; él puede atacar a cualquiera.</li>
<li><b>Sigilo</b> — no puede ser objetivo de ataques ni Hechizos hasta que ataque.</li>
<li><b>Aturdido</b> — no puede atacar ni usar habilidades hasta el final del siguiente turno de su controlador.</li>
<li><b>Infectado</b> — pierde 1 PV al inicio de cada turno de su controlador.</li>
<li><b>Regeneración</b> — recupera 2 PV al inicio del turno de su controlador; no regenera si recibió Fuego.</li>
<li><b>Rápido</b> — el Hechizo puede jugarse también durante el turno rival, como respuesta.</li>
</ul>
<h4>Construcción de mazo</h4>
<p>40 cartas exactas + 1 Líder. Máximo 3 copias de cada carta; las Legendarias (★) máximo 1.
Recomendado: 16–20 Personajes, 10–14 Hechizos, 4–6 Trampas, 3–4 Objetos, 1–2 Lugares.</p>
</div>`;
/* ===========================================================================
   EL EDITOR DE CARTAS, DESDE EL MENÚ
   ---------------------------------------------------------------------------
   El editor (estudio.html) viaja con el juego para que una actualización mande
   las dos cosas a la vez. En tu ordenador se abre directo; publicado pide una
   contraseña.

   HAY QUE SER CLARO CON LO QUE ESTO ES: la página se descarga entera en el
   navegador de quien entra, así que esta comprobación se puede saltar leyendo
   el código. Guardar el hash en vez del texto evita que la contraseña se lea de
   un vistazo, y nada más. Sirve para que el editor no esté a la vista de
   cualquiera, no para impedir que alguien decidido entre.

   Que no proteja no es grave: el editor sólo escribe en el navegador de quien
   lo abre y en carpetas que esa persona elige a mano. Nadie puede tocar desde
   ahí este juego ni sus ilustraciones. Protección de verdad pide un servidor.

   Para cambiar la contraseña, saca el hash de la que quieras y pégalo abajo:
       printf 'la-que-sea' | shasum -a 256
   ======================================================================== */

const LLAVE_ESTUDIO = '6fd79214aee801974e7c3e71130970e12a1e24042c6c0046b5ea6c20a2195321';

const EDITOR = 'estudio.html';

/* En tu propia máquina no tiene sentido preguntar nada. */

function enCasa(){
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '' || h.endsWith('.local');
}

async function huella(txt){
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

let PARTIDA_N = 0;
/* ==========================================================================
   LA CORTINILLA DEL VS
   --------------------------------------------------------------------------
   Cuatro segundos entre elegir y jugar: las dos cartas entran desde los lados,
   chocan en el centro con destello y chispas, aguantan mientras se leen los dos
   nombres, y se apartan dejando ver la mesa.

   Va sobre su propia capa, por encima de todo, y se quita sola al acabar. Si el
   jugador tiene los efectos apagados —o es una partida automática— no se monta
   siquiera: es adorno, y el adorno no puede retrasar 4 segundos una tanda de
   2000 partidas.
   ======================================================================== */

const MQTT_URLS=['wss://broker.emqx.io:8084/mqtt',
                 'wss://test.mosquitto.org:8081/mqtt',
                 'wss://broker.hivemq.com:8884/mqtt'];

const mqEnc=new TextEncoder(), mqDec=new TextDecoder();

function mqLen(n){ const o=[]; do{ let d=n%128; n=Math.floor(n/128); if(n>0) d|=0x80; o.push(d); }while(n>0); return o; }

function mqStr(s){ const b=mqEnc.encode(s); return [b.length>>8&255, b.length&255, ...b]; }

function mqPkt(tipo, cuerpo){ return new Uint8Array([tipo, ...mqLen(cuerpo.length), ...cuerpo]); }

function mqReadLen(b,i){ let m=1,v=0,x; do{ if(i>=b.length) return null; x=b[i++]; v+=(x&127)*m; m*=128; }while(x&128); return [v,i]; }

function chMqtt(url, topic){
  const ch={tipo:'mqtt', url, ok:false, ws:null, buf:new Uint8Array(0), ping:null, topic, err:''};
  ch.open=()=>new Promise(res=>{
    let ws; try{ ws=new WebSocket(url,'mqtt'); }catch(e){ ch.err=e.message; return res(false); }
    ws.binaryType='arraybuffer'; ch.ws=ws;
    const to=setTimeout(()=>{ ch.err='sin respuesta'; try{ws.close();}catch(_){} res(false); },9000);
    ws.onopen=()=>{ const cid='caoz'+Math.random().toString(36).slice(2,10);
      ws.send(mqPkt(0x10,[...mqStr('MQTT'),4,0x02,0,60,...mqStr(cid)])); };
    ws.onmessage=e=>{
      const inc=new Uint8Array(e.data), un=new Uint8Array(ch.buf.length+inc.length);
      un.set(ch.buf); un.set(inc,ch.buf.length); ch.buf=un;
      let i=0;
      while(i<ch.buf.length){
        const tipo=ch.buf[i]&0xF0, r=mqReadLen(ch.buf,i+1);
        if(!r) break;
        const [len,ini]=r; if(ini+len>ch.buf.length) break;
        const cuerpo=ch.buf.subarray(ini,ini+len);
        if(tipo===0x20){                                   // CONNACK
          if(cuerpo[1]!==0){ ch.err='rechazado '+cuerpo[1]; clearTimeout(to); res(false); }
          else ws.send(mqPkt(0x82,[0,1,...mqStr(ch.topic),0]));
        } else if(tipo===0x90){                            // SUBACK: ya escuchamos
          clearTimeout(to); ch.ok=true;
          ch.ping=setInterval(()=>{ try{ ws.send(new Uint8Array([0xC0,0])); }catch(_){} },45000);
          res(true);
        } else if(tipo===0x30){                            // PUBLISH
          const tl=(cuerpo[0]<<8)|cuerpo[1];
          netRecvRaw(mqDec.decode(cuerpo.subarray(2+tl)));
        }
        i=ini+len;
      }
      ch.buf=ch.buf.slice(i);
    };
    ws.onerror=()=>{ ch.err='error de WebSocket'; clearTimeout(to); if(!ch.ok) res(false); };
    ws.onclose=()=>{ ch.ok=false; clearInterval(ch.ping); };
  });
  ch.send=txt=>{ if(!ch.ok) return false;
    try{ ch.ws.send(mqPkt(0x30,[...mqStr(ch.topic),...mqEnc.encode(txt)])); return true; }catch(_){ return false; } };
  ch.close=()=>{ clearInterval(ch.ping); try{ ch.ws.close(); }catch(_){} };
  return ch;
}

/* ---- Canal HTTP (ntfy) --------------------------------------------------
   Sondeo con since: recupera lo enviado mientras no mirabas. */

const NET_OVERRIDE=new URLSearchParams(location.search).get('relay');

const HTTP_RELAYS = NET_OVERRIDE ? [NET_OVERRIDE.replace(/\/?$/,'/')]
  : ['https://ntfy.sh/','https://ntfy.envs.net/','https://ntfy.adminforge.de/'];

function chHttp(base, topic){
  const ch={tipo:'http', url:base, ok:false, topic, since:'30s', err:'', fallos:0, saltar:0};
  const conCorte=(url,opt)=>{                 // sin esto, una red muerta cuelga minutos
    const ac=new AbortController(); const t=setTimeout(()=>ac.abort(),4000);
    return fetch(url,Object.assign({signal:ac.signal},opt||{})).finally(()=>clearTimeout(t));
  };
  ch.poll=async()=>{
    if(ch.saltar>0){ ch.saltar--; return; }        // dormido: se reintenta cada tanto
    try{
      const r=await conCorte(base+ch.topic+'/json?poll=1&since='+encodeURIComponent(ch.since),{cache:'no-store'});
      if(!r.ok) throw new Error('HTTP '+r.status);
      const txt=await r.text(); ch.ok=true; ch.err=''; ch.fallos=0;
      if(!ch.avisado){ ch.avisado=true; netStatus(); }
      if(!txt.trim()) return;
      for(const linea of txt.trim().split('\n')){
        let d; try{ d=JSON.parse(linea); }catch(_){ continue; }
        if(d.id) ch.since=d.id;
        if(d.event==='message'&&d.message) netRecvRaw(d.message);
      }
    }catch(e){ ch.ok=false; NET.err++;
      ch.err=(e&&e.name==='AbortError')?'sin respuesta (4s)':((e&&e.message)||'fallo');
      if(++ch.fallos>=2) ch.saltar=25;             // ~30 s antes de volver a intentarlo
    }
  };
  ch.send=async txt=>{
    try{ const r=await conCorte(base+ch.topic,{method:'POST',body:txt}); return r.ok; }
    catch(e){ ch.err=(e&&e.name==='AbortError')?'sin respuesta (4s)':((e&&e.message)||'fallo'); return false; }
  };
  ch.close=()=>{};
  return ch;
}

const NET_ABC='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin I/O/0/1, que se confunden

const NET={on:false,host:false,guest:false,code:null,topic:null,
  sid:null,seq:0,q:[],sending:false,pending:{},pid:1,acts:[],busy:false,hechas:null,esperaAck:null,
  status:'',peer:false,onjoin:null,seen:null,chs:[],timer:null,tx:0,rx:0,err:0};

function netCode(){ let s=''; for(let i=0;i<5;i++) s+=NET_ABC[rnd(NET_ABC.length)]; return s; }

async function netConnect(code, asHost){
  NET.code=code; NET.topic='caoztcg-v1-'+code.toLowerCase();
  NET.host=asHost; NET.guest=!asHost; NET.on=true;
  NET.miNombre = ONL.nombre || (asHost?'Anfitrión':'Invitado');
  chatVacio(); chatVisible(true);
  NET.seq=0; NET.q=[]; NET.sending=false; NET.pending={}; NET.acts=[]; NET.busy=false;
  NET.peer=false; NET.seen=new Set(); NET.tx=NET.rx=NET.err=0;
  NET.sid=Math.random().toString(36).slice(2,10);   // sesión: evita choques de seq al reconectar
  NET.hechas=new Set(); NET.esperaAck=new Map();
  NET.chs.forEach(c=>c.close()); NET.chs=[];
  clearInterval(NET.timer);
  netStatus('conectando…');
  // dos naturalezas a la vez: si una está bloqueada, la otra suele pasar
  const mqTopic='caoztcg/v1/'+code.toLowerCase();
  if(!NET_OVERRIDE) MQTT_URLS.forEach(u=>NET.chs.push(chMqtt(u,mqTopic)));
  HTTP_RELAYS.forEach(b=>NET.chs.push(chHttp(b,NET.topic)));
  netStatus();                                  // se ven las vías desde el primer instante
  NET.chs.forEach(c=>{ if(c.tipo==='mqtt') c.open().then(()=>netStatus()).catch(()=>netStatus()); });
  NET.chs.forEach(c=>{ if(c.tipo==='http') c.poll().then(()=>netStatus()); });
  NET.timer=setInterval(()=>{ NET.chs.forEach(c=>{ if(c.tipo==='http') c.poll(); }); netStatus(); },1100);
  // aviso si en 12 s no hay ninguna vía viva
  setTimeout(()=>{ if(NET.on&&!netVivos().length)
    netStatus('No hay salida a ningún relevo. Prueba con datos móviles o desde otra red.','warn'); },12000);
  return true;
}
/* ==========================================================================
   CHAT DE LA SALA
   Dos jugadores que comparten un código pueden hablarse. Viaja por el mismo
   canal que las jugadas, con su propio tipo de mensaje, así que no necesita
   nada nuevo por debajo.

   EL TEXTO DEL RIVAL ES DATO AJENO: se pinta SIEMPRE con textContent, nunca
   como HTML. Si se insertara como HTML, cualquiera con el código de sala podría
   colar etiquetas o guiones en la pantalla del otro. Es la única regla que no
   se puede relajar aquí.
   ========================================================================== */

const CHAT_MAX = 180;

function netClose(){
  chatVisible(false);
  clearInterval(NET.timer); NET.timer=null;
  NET.chs.forEach(c=>c.close()); NET.chs=[];
  NET.on=false; NET.host=false; NET.guest=false; NET.peer=false;
}
/* un mensaje puede llegar por varias vías: nos quedamos con el primero */
/* ==========================================================================
   EL DIARIO DE LA PARTIDA EN LÍNEA
   --------------------------------------------------------------------------
   Guarda lo que entra, lo que sale y lo que el anfitrión hace con cada jugada
   del invitado. Existe porque los fallos de aquí no se reproducen a mano: hacen
   falta dos personas, dos redes y un momento concreto de la partida. Con esto,
   cuando algo raro pasa, queda escrito qué se pidió y qué se contestó.

   Se guarda en memoria —las últimas 500 entradas— y se descarga con el botón
   «Diario» de la barra online, o desde la consola con NETDIARIO.bajar().
   Lleva tus cartas y el chat de la partida, así que es tuyo: no se manda a
   ninguna parte, sólo se descarga si tú lo pides.
   ======================================================================== */

function netRecvRaw(txt){
  let m; try{ m=JSON.parse(txt); }catch(_){ return; }
  if(!m||m.from===(NET.host?'host':'guest')) return;      // eco de lo mío
  const clave=(m.sid||m.from)+':'+m.seq;
  if(NET.seen.has(clave)) return;
  NET.seen.add(clave);
  NET.rx++; netStatus(null,'ok');
  NETDIARIO.apunta('recibe', m.t, {seq:m.seq, de:m.from,
    ...(m.k?{k:m.k}:{}), ...(m.id?{id:m.id}:{}), ...(m.aid?{aid:m.aid}:{}),
    bytes:txt.length});
  netRecv(m);
}

function netSend(msg){
  if(!NET.on) return;
  msg.from=NET.host?'host':'guest'; msg.sid=NET.sid; msg.seq=++NET.seq;
  if(msg.t==='state') NET.q=NET.q.filter(m=>m.t!=='state');   // sólo vale el último estado
  NET.q.push(msg); netPump();
  NETDIARIO.apunta('envía', msg.t, {seq:msg.seq,
    ...(msg.k?{k:msg.k}:{}), ...(msg.id?{id:msg.id}:{}), ...(msg.aid?{aid:msg.aid}:{})});
}

async function netPump(){
  if(NET.sending||!NET.q.length) return;
  NET.sending=true;
  try{
    while(NET.q.length&&NET.on){
      const msg=NET.q[0], txt=JSON.stringify(msg);
      let alguno=false;
      for(const c of NET.chs) if(c.tipo==='mqtt'&&c.ok&&c.send(txt)) alguno=true;
      const httpVivos=NET.chs.filter(c=>c.tipo==='http'&&c.ok);
      if(alguno){
        httpVivos.forEach(c=>c.send(txt));        // ya entregado por MQTT: no esperamos al HTTP
      } else {
        // sin MQTT probamos el HTTP; si ninguno vive, se prueban todos por si revivió
        const cand = httpVivos.length? httpVivos : NET.chs.filter(c=>c.tipo==='http'&&!c.saltar);
        const r=await Promise.all(cand.map(c=>c.send(txt)));
        if(r.some(Boolean)) alguno=true;
      }
      if(alguno){
        NET.q.shift(); NET.tx++;
        if(msg.__reintento) netStatus(null,'ok');
      } else {
        // NO se descarta: al arrancar las vías tardan un segundo en abrirse y
        // tirar aquí el mensaje era justo lo que dejaba la sala esperando siempre
        msg.__reintento=(msg.__reintento||0)+1;
        if(msg.__reintento>25){ NET.q.shift(); NET.err++;
          netStatus('no se pudo enviar: ninguna vía responde','warn'); }
        else { netStatus('esperando conexión…','warn'); await sleep(600); continue; }
      }
      await sleep(120);
    }
  } finally { NET.sending=false; }
}
/* pregunta del anfitrión al invitado; espera su respuesta */

function netAsk(payload){
  return new Promise(res=>{
    const id=NET.pid++;
    let hecho=false;
    NET.pending[id]=v=>{ if(hecho) return; hecho=true; delete NET.pending[id]; res(v); };
    netSend({t:'prompt', id, ...payload});
    setTimeout(()=>{ if(!hecho){ hecho=true; delete NET.pending[id];
      log('El rival no responde; se resuelve solo.','sys'); res(payload.fallback!==undefined?payload.fallback:0); } },90000);
  });
}

/* ---------- fotografía del estado, en la perspectiva del invitado ---------- */

function netSnap(){
  const uni=u=>({uid:u.uid,c:u.card.id,dmg:u.dmg,tr:u.tribes.slice(),
    kown:[...u.keysOwn],objs:u.objs.slice(),sick:u.sick,att:u.attacked,ever:u.attackedEver,
    stun:u.stunned,inf:u.infected,pos:u.possessed,doom:u.doomed||0,blind:!!u.blind,
    nofly:!!u.noFly,rev:!!u.revealed,mark:!!u.marked,nocnt:!!u.noCounter,
    tp:!!u.trapProof,tig:!!u.tIgnoreTaunt,ncl:!!u.noClause,arma:!!u.armaMagica,
    pA:u.pA,pH:u.pH,tA:u.tA,tH:u.tH,nA:u.nA,nH:u.nH,nU:u.nUntil,au:u.actUsed});
  const lado=(s,propio)=>{ const p=P(s); return {
    L:p.leaderId,alma:p.alma,pd:p.pd,pdMax:p.pdMax,llaves:p.llaves,gracia:p.gracia,
    asc:p.ascended,scroll:p.scrollTurns,used:p.leaderUsed,
    hand: propio? p.hand.slice() : p.hand.map(()=>null),
    deck: p.deck.map(()=>null), deckN:p.deck.length,
    grave:p.grave.slice(),
    traps:p.traps.map(t=>(propio||t.revealed)?{id:t.id,revealed:t.revealed}:{id:null,revealed:false}),
    relics:p.relics.map(r=>({id:r.id,counters:r.counters||0})),
    field:p.field.map(uni)}; };
  const desde=G.logSent||0;
  const nuevo=G.log.slice(desde).filter(l=>!l.priv); G.logSent=G.log.length;
  const fx=G.fxq||[]; G.fxq=[];
  return {me:lado(FOE,true), foe:lado(ME,false),
    turn:G.turnNo, active:(G.active===FOE?0:1), phase:G.phase, over:G.over,
    place:G.place?{id:G.place.id,side:(G.place.side===FOE?0:1)}:null,
    logN:nuevo, fx};
}

let netStateT=null;

function netPushState(){
  if(!NET.host||!NET.on||G.silent) return;
  clearTimeout(netStateT);
  netStateT=setTimeout(()=>{ if(NET.host&&NET.on&&G) netSend({t:'state', s:netSnap()}); },160);
}
/* efectos que el invitado debe ver aunque no corra el motor */

function netFx(k,d){ if(NET.host&&NET.on&&G){ (G.fxq=G.fxq||[]).push(Object.assign({k},d)); } }

/* ---------- el invitado reconstruye el estado y dibuja ---------- */

function netApply(s){
  if(!G) return;
  const poner=(idx,d,lado)=>{
    const p=G.pl[idx];
    p.leaderId=d.L; p.L=LEADERS[d.L];
    p.alma=d.alma; p.pd=d.pd; p.pdMax=d.pdMax; p.llaves=d.llaves;
    p.gracia=d.gracia; p.ascended=d.asc; p.scrollTurns=d.scroll; p.leaderUsed=d.used;
    p.hand=d.hand.slice(); p.deck=d.deck.slice(); p.grave=d.grave.slice();
    p.traps=d.traps.slice(); p.relics=d.relics.slice();
    p.field=d.field.map(x=>{ const u=mkUnit(x.c,lado); u.uid=x.uid; u.owner=lado;
      u.dmg=x.dmg; u.tribes=x.tr.slice(); u.keysOwn=new Set(x.kown); u.objs=x.objs.slice();
      u.sick=x.sick; u.attacked=x.att; u.attackedEver=x.ever; u.stunned=x.stun;
      u.infected=x.inf; u.possessed=x.pos; u.doomed=x.doom; u.blind=x.blind;
      u.noFly=x.nofly; u.revealed=x.rev; u.marked=x.mark; u.noCounter=x.nocnt;
      u.trapProof=x.tp; u.tIgnoreTaunt=x.tig; u.noClause=x.ncl; u.armaMagica=x.arma;
      u.pA=x.pA;u.pH=x.pH;u.tA=x.tA;u.tH=x.tH;u.nA=x.nA;u.nH=x.nH;u.nUntil=x.nU;
      u.actUsed=x.au; return u; });
  };
  poner(0,s.me,0); poner(1,s.foe,1);
  G.turnNo=s.turn; G.active=s.active; G.phase=s.phase; G.over=s.over;
  G.place=s.place?{id:s.place.id,side:s.place.side}:null;
  (s.logN||[]).forEach(l=>log(l.txt,l.cls));
  recalc(); render();
  netPlayFx(s.fx||[]);
  if(s.over&&!G.overShown){ G.overShown=true;
    const gano = P(ME).alma>0 && P(FOE).alma<=0;
    setTimeout(()=>showEnd(gano?ME:FOE, gano?'Tu rival se queda sin Alma.':'Te quedas sin Alma.'),700); }
}

async function netPlayFx(list){
  for(const f of list){
    const u=f.uid!=null? [...P(0).field,...P(1).field].find(x=>x.uid===f.uid) : null;
    if(f.k==='hit'&&u) await fxHit(u,f.n,{inf:f.inf,fuego:f.fuego,letal:f.letal});
    else if(f.k==='lunge'&&u){
      const tg = f.tg==='face' ? 'face' : [...P(0).field,...P(1).field].find(x=>x.uid===f.tg);
      if(tg) await fxLunge(u, tg);
    }
    else if(f.k==='heal'&&u) fxHeal(u,f.n);
    else if(f.k==='face') await fxFace(f.side,f.n);
    else if(f.k==='spell') await fxSpell(f.id,f.side);
    else if(f.k==='trap') await fxTrap(f.id,f.side);
    else if(f.k==='hab')  await fxHabilidad(f.side);
    else if(f.k==='revela') await revelarCarta(f.id, f.mano, f.side);
    else if(f.k==='banner') await fxBanner(f.side);
    else if(f.k==='dice') await rollDice(f.v,f.label,false,metaViva(f.meta));
    else if(f.k==='obj'&&u) fxObj(u,f.id,f.txt);
    else if(f.k==='notice') fxNotice(f.txt,f.color);
  }
}

/* ---------- reparto de mensajes ---------- */

async function netRecv(m){
  if(!NET.on) return;
  if(NET.host){
    if(m.t==='join'){
      if(NET.peer){                              // ya emparejados: repite la bienvenida
        if(NET.welcome) netSend(NET.welcome);
        return;
      }
      NET.peer=true; netStatus('rival conectado','ok');
      NET.suNombre = String(m.nombre||'').slice(0,18) || 'Tu rival';
      log(`<b>${NET.suNombre}</b> entra en la sala.`,'sys');
      if(NET.onjoin) NET.onjoin(m.leader||'fender');
      else NET.joinPend=m.leader||'fender';      // aún no listo: lo atendemos al asignar
      return;
    }
    if(m.t==='act'){
      if(m.aid&&NET.hechas.has(m.aid)){ netSend({t:'ack', aid:m.aid}); return; }   // ya hecha: sólo confirmar
      if(m.aid) NET.hechas.add(m.aid);
      NET.acts.push(m); netRunActs(); return;
    }
    if(m.t==='reply'&&NET.pending[m.id]){ NET.pending[m.id](m.v); return; }
    if(m.t==='chat'){ chatRecibe(m); return; }
    if(m.t==='bye'){ netStatus('el rival se fue','warn'); toast('Tu rival ha salido'); return; }
  } else {
    if(m.t==='chat'){ chatRecibe(m); return; }
    if(m.t==='welcome'){ NET.peer=true; netStatus('partida en marcha','ok');
      NET.suNombre = String(m.nombre||'').slice(0,18) || 'Tu rival';
      netGuestStart(m); return; }
    if(m.t==='state'){ netApply(m.s); return; }
    if(m.t==='prompt'){ netGuestPrompt(m); return; }
    if(m.t==='nope'){                          // el anfitrión rechazó tu jugada
      const p=NET.esperaAck.get(m.aid);
      if(p){ clearInterval(p.t); NET.esperaAck.delete(m.aid); }
      toast(m.why||'Esa jugada no se pudo hacer');
      log(`No se pudo: ${m.why||'jugada rechazada'}.`,'sys');
      netStatus(null,'ok'); return;
    }
    if(m.t==='ack'){ const p=NET.esperaAck.get(m.aid);
      if(p){ clearInterval(p.t); NET.esperaAck.delete(m.aid); netStatus(null,'ok'); } return; }
    if(m.t==='bye'){ netStatus('el anfitrión se fue','warn'); toast('El anfitrión ha salido'); return; }
  }
}
/* las intenciones del invitado se ejecutan de una en una */

async function netRunActs(){
  if(NET.busy) return;
  NET.busy=true;
  while(NET.acts.length){
    const m=NET.acts.shift();
    let r={ok:false, why:'error interno'};
    try{ r = await netDoAct(m); }
    catch(e){ r={ok:false, why:e.message}; log('Jugada rival inválida: '+e.message,'sys'); }
    NETDIARIO.apunta('resuelve', m.k, {aid:m.aid, ok:r.ok, ...(r.why?{motivo:r.why}:{})});
    /* Si la jugada NO se pudo hacer hay que decírselo. Antes se mandaba el ack
       igual: el invitado daba su jugada por buena, no pasaba nada en la mesa y
       desde su lado el juego «no le dejaba bajar cartas» sin más explicación. */
    if(m.aid) netSend({t:'ack', aid:m.aid});
    if(!r.ok && r.why) netSend({t:'nope', aid:m.aid, why:r.why});
    netPushState();
  }
  NET.busy=false;
}

/* Devuelve {ok, why}: quien la llama necesita saber si salió y, si no, por qué,
   para poder contárselo al invitado. */

async function netDoAct(m){
  const s=FOE;
  if(G.over) return {ok:false, why:'La partida ha terminado'};
  const mio=uid=>P(s).field.find(x=>x.uid===uid);

  if(m.k==='play'){
    if(!canPlay(s,m.id)) return {ok:false, why:whyNot(s,m.id)};
    return {ok: await playFromHand(s,m.id), why:'No se pudo jugar la carta'};
  }
  if(m.k==='end'){
    if(G.active!==s) return {ok:false, why:'No es tu turno'};
    await endTurn(); return {ok:true};
  }
  if(m.k==='leader'){
    const p=P(s), L=p.L;
    if(p.leaderUsed) return {ok:false, why:'Ya usaste tu Habilidad de Líder este turno'};
    if(p.pd<L.habCost) return {ok:false, why:`Tu Habilidad cuesta ${L.habCost} PD y tienes ${p.pd}`};
    if(G.active!==s) return {ok:false, why:'No es tu turno'};
    return {ok: await useLeader(s), why:'No hay objetivos para tu Habilidad'};
  }
  if(m.k==='act'){
    const u=mio(m.uid);
    if(!u) return {ok:false, why:'Ese Personaje ya no está en tu campo'};
    return {ok: await useAct(u), why:'No se pudo usar esa habilidad'};
  }
  if(m.k==='relic'){
    const r=P(s).relics.find(x=>x.id===m.id);
    if(!r) return {ok:false, why:'Ya no tienes esa Reliquia'};
    return {ok: await useRelic(s,r), why:'No se pudo usar la Reliquia'};
  }
  if(m.k==='attack'){
    const u=mio(m.uid);
    if(!u) return {ok:false, why:'Ese Personaje ya no está en tu campo'};
    if(!canAttack(u)) return {ok:false, why:porQueNoAtaca(u)};
    const t = m.target==='face' ? 'face' : P(ME).field.find(x=>x.uid===m.target);
    if(t!=='face' && !t) return {ok:false, why:'Ese objetivo ya no está en el campo'};
    const lt=legalTargets(u);
    if(t==='face' ? !lt.face : !lt.units.includes(t))
      return {ok:false, why:porQueNoEsObjetivo(u,t).replace(/<[^>]+>/g,'')};
    return {ok: await doAttack(u,t), why:'No se pudo atacar'};
  }
  return {ok:false, why:'Jugada desconocida'};
}

/* ---------- el invitado responde a lo que le pide el anfitrión ---------- */

async function netGuestPrompt(m){
  const responder=v=>netSend({t:'reply', id:m.id, v});
  if(m.kind==='ask'){
    const i=await ask(ME,m.title,m.options); responder(i);
  } else if(m.kind==='pick'){
    const c=await pickCard(ME,m.ids,m.title,m.cancellable); responder(c);
  } else if(m.kind==='from'){
    const idx=await pickIndex(m.list,m.title); responder(idx);
  } else if(m.kind==='roll'){
    await rollDice(m.value,m.label,true); responder(1);
  } else if(m.kind==='targets'){
    const v=await guestTargets(m); responder(v);
  }
}
/* selección de objetivos en el invitado: mismo interfaz, pero con la lista
   de objetivos legales que manda el anfitrión */

function guestTargets(p){
  return new Promise(res=>{
    const busca=v=>v==='face'?'face':[...P(0).field,...P(1).field].find(u=>u.uid===v);
    const groups=p.groups.map(g=>Object.assign({},g,{poolRef:(g.pool||[]).map(busca).filter(Boolean)}));
    TGT={s:ME, groups, self:null, card:{}, gi:0, chosen:groups.map(()=>[]),
      res:v=>res(v===null?null:v.map(a=>a.map(x=>x==='face'?'face':x.uid)))};
    stepTarget();
  });
}

function gIntent(k,d){
  const aid=NET.sid+'-'+(++NET.pid);
  const msg=Object.assign({t:'act',k,aid},d||{});
  netSend(msg);
  let intentos=0;
  const t=setInterval(()=>{
    if(!NET.on||!NET.esperaAck.has(aid)){ clearInterval(t); return; }
    if(++intentos>5){ clearInterval(t); NET.esperaAck.delete(aid);
      netStatus('tu jugada no llegó: revisa la conexión','warn'); return; }
    netStatus('reenviando tu jugada…','warn');
    netSend(msg);
  },3500);
  NET.esperaAck.set(aid,{t});
}

/* ---------- vestíbulo ---------- */

let ONL={lider:null,nombre:''};

function nombreGuardado(){
  try{ return (localStorage.getItem('caoz_nombre')||'').slice(0,18); }catch(e){ return ''; }
}

function guardaNombre(n){ try{ localStorage.setItem('caoz_nombre', n); }catch(e){} }

const GUIAS = {
mohamed:{
  dif:3, lema:'Que atacarte cueste caro, y ganar sin pelear.',
  ganas:`Tú no ganas por daño: ganas por <b>Llaves</b>. Tu mazo entero está montado para
    aburrir al rival mientras juntas dos y bajas el <b>Pergamino de Deseo Ilimitado</b>.
    El daño que hagas es un bonus.`,
  motor:['conserje','llavemago','pergamino','sangrefria','peaje'],
  motorTxt:`Seis fuentes de Llave en 40 cartas y sólo necesitas <b>dos</b>: los tres
    <b>Conserjes</b> (una al morir, y muere de un soplido), la <b>Llave del Mago</b>
    (cuenta como una ella sola), <b>Lucy Fernando</b> y el <b>Sacrificio de Sangre</b>
    del Mago del Domo, que además te deja matar a tu propio Conserje cuando te convenga.`,
  turnos:[
    ['1–3','<b>Conserje</b> e <b>Ilusión Menor</b> a la mesa. No intentes ganar el campo: intenta que atacarte sea incómodo. Con <b>Brick y Brock</b> cada ataque rival cuesta 1 PD, y el <b>Peaje del Puente</b> boca abajo hace el resto.'],
    ['4–6','Limpia con <b>Golpe a Sangre Fría</b> (que te cuesta 2, no 3) y <b>El Acertijo</b>. Mientras tanto van cayendo Conserjes y sumando Llaves. Mira su mesa: si aparece <b>Talia Boss</b> o <b>Juan Gabriel</b>, mátalos ya — son los que apagan tu plan.'],
    ['7+','Con 2 Llaves, baja el <b>Pergamino</b> y protégelo. <b>Contrato del Notario</b> boca abajo anula el hechizo que venga a destruirlo. Sólo tienes que sobrevivir hasta el inicio de tu segundo turno.']
  ],
  combo:`<b>Conserje + Sacrificio de Sangre.</b> Si te falta una Llave y el Conserje está
    vivo pero nadie lo mata, el <b>Mago del Domo</b> lo destruye por 3 PD y te la da él mismo.
    Y como el Mago gana 1 Alma cada vez que muere cualquier Personaje, cuanto más se pelea
    el rival, más aguantas tú.`,
  mano:`Quédate <b>Conserje</b>, <b>Ilusión Menor</b> y <b>Peaje del Puente</b>: son baratos
    y compran los turnos que necesitas. Descarta el <b>Pergamino</b> de salida si no ves
    ninguna fuente de Llave — es un ladrillo de 7 PD hasta el turno 7.`,
  pierdes:[
    'Contra <b>Fender</b>, por ir lento: él te mata antes del turno 7 si le dejas montar mesa. Tus Ilusiones y el Peaje son salvavidas, no lujos.',
    'Por guardar <b>Golpe a Sangre Fría</b> esperando algo mejor. Sólo mata cosas de Costo 2 o menos: úsalo pronto, no lo reserves para el dragón.',
    'Por bajar el Pergamino con la Zona de Trampas vacía. Es una Reliquia: <b>Disipar Magia</b> la borra por 2 PD.'
  ],
  vs:{fender:['Difícil','Es más rápido que tus Llaves.'],adreida:['Parejo','Sangre Fría no mata a sus grandes: usa Acertijo.'],
      rafaela:['Favorable','Sólo Juan Gabriel puede pararte el Pergamino.'],talesin:['Parejo','Carrera de Llaves: Disipar Magia contra su Pergamino.'],gero:['Difícil','Llena la mesa antes de que juntes dos Llaves.']}
},
fender:{
  dif:1, lema:'Llenar la mesa y rematar en un solo turno.',
  ganas:`Sales rápido, sumas cuerpos baratos y en el turno 5 o 6 conviertes cuatro
    Personajes pequeños en <b>diez o más de daño de golpe</b>. Si la partida llega al turno 9
    sin que hayas ganado, ya la perdiste.`,
  motor:['adolfo','balada','cantaberna','burla','discipulo'],
  motorTxt:`Doce Personajes de Costo 1 y 2: siempre tienes algo que jugar. <b>Bob Carly</b>
    le da <b>Prisa</b> a todo lo de Costo 3 o menos, así que lo que baje ataca ese mismo turno.
    Y cada <b>Canción</b> dispara tu pasiva <b>Inspiración</b>: +1 ATQ <b>permanente</b>,
    gratis, encima de lo que ya haga la carta. Tus cuerpos son pequeños, pero cada Canción
    que cantas los deja un poco más grandes para siempre.`,
  turnos:[
    ['1–3','Cuerpos, cuerpos y cuerpos. <b>Discípulo de Rul</b>, <b>Matildus</b>, <b>Bartolomeo</b>. No pienses en intercambios buenos: piensa en tener cuatro cosas en mesa el turno 4.'],
    ['4–5','Baja <b>Bob Carly</b>. A partir de ahí todo lo barato entra atacando y el rival no puede planear su defensa con un turno de margen.'],
    ['6','El turno letal: <b>Balada de Valoria</b> (+1/+1 y Prisa a todos) + una <b>Canción de Taberna</b> + <b>Sube el Volumen</b>. Con cuatro cuerpos son 12 o más de daño en una pasada.']
  ],
  combo:`<b>Cuenta antes de atacar.</b> Cuatro Personajes de 1 ATQ = 4. Balada los sube a 2
    (=8). Sube el Volumen a 3 (=12). Y cada Canción que juegues antes suma +1 más por
    Inspiración —y ése se queda—. Ese es el turno que buscas desde que empieza la partida:
    <b>primero todos los buffs, después todos los ataques</b>. Pero no esperes al turno
    perfecto para cantar: cada Canción temprana engorda a alguien para el resto de la
    partida.`,
  mano:`Quédate cualquier cosa de Costo 1 y 2 y una <b>Balada</b>. Si tu mano inicial no tiene
    dos Personajes baratos, no la tienes. <b>Bob Carly</b> vale mucho más en la mano que
    <b>Eric</b>.`,
  pierdes:[
    'Por vaciar la mano. Contra <b>Aliento de Ácido</b> o <b>Bola de Fuego</b> pierdes cuatro cuerpos de golpe: deja siempre dos Personajes en la mano para reconstruir.',
    'Contra <b>Provocar</b>. Adreida convierte cualquier cosa de 4 ATQ en un muro y tu daño se estrella. <b>Zancada Larga</b> te deja ignorarlo con un atacante: guárdala para el turno letal.',
    'Por atacar antes de buffear. Es el error más caro del mazo.'
  ],
  vs:{mohamed:['Favorable','Eres más rápido que sus Llaves.'],adreida:['Difícil','Provocar frena tu daño: Zancada Larga y Calentar Metal.'],
      rafaela:['Parejo','Sus curaciones contra tu velocidad.'],talesin:['Favorable','Es lento: mátalo antes del turno 7.'],gero:['Favorable','Sus NPC son baratos y frágiles: barre y no dejes que se junten cuatro.']}
},
adreida:{
  dif:1, lema:'Cuerpos grandes que el rival está obligado a mirar.',
  ganas:`Juegas en curva cosas gordas y dejas que tu pasiva haga el trabajo: con
    <b>Intimidante</b>, <b>todo lo tuyo de 4 o más ATQ tiene Provocar</b>. Eso significa que
    tú decides contra qué pelea el rival y cuándo. Ganas por acumulación, no por sorpresa.`,
  motor:['mazo','horton','lucius','eric','armadura'],
  motorTxt:`El <b>Mazo de Brock</b> (+3 ATQ) es tu mejor carta y no lo parece: puesto en un
    <b>Bartolomeo</b> de 1 ATQ lo convierte en un muro de 4 que el rival <i>tiene</i> que
    atacar. Con <b>Auxilio</b> y <b>Armadura Mágica</b> esos muros aguantan dos turnos.`,
  turnos:[
    ['1–3','Curva limpia: Bartolomeo (2), <b>Augusto Bale</b> (3). Augusto además abarata tus Trampas, y llevas cinco.'],
    ['4–6','Aquí manda el mazo: <b>Sir Horton</b>, <b>Lucius Bale</b>, <b>Talia Boss</b>, <b>Trol de la Mano Larga</b>. Casi todos superan los 4 ATQ, así que entran con Provocar puesto.'],
    ['7+','<b>Juan Gabriel</b> cierra: 5/6 Arquero que además congela el Pergamino rival. Si llegas aquí con mesa, la partida es tuya.']
  ],
  combo:`<b>Saeta Guía + Golpe Directo.</b> La Saeta hace 3 daño y quita el contraataque de
    ese objetivo; tu Habilidad da +2 ATQ y también anula el contraataque. Juntas matan
    cualquier cosa <b>sin que te devuelvan un solo punto de daño</b>. Es el intercambio más
    limpio del juego.`,
  mano:`Quédate la curva: algo de 2, algo de 3 y un <b>Mazo de Brock</b>. <b>Contrahechizo</b>
    es oro contra los mazos de barrido — guárdalo para el Aliento de Ácido, no lo gastes en
    una Canción.`,
  pierdes:[
    'Contra Trampas. <b>Risa de Tasha</b> y <b>Gema del Conserje</b> castigan atacar con cartas grandes: <b>Modificar las Reglas</b> limpia su Zona de Trampas antes de la gran embestida.',
    'Contra <b>Talesyn</b>, por el <b>Aliento de Ácido</b> y por Tal. Talia Boss es tu mejor carta ahí: mátale el Pergamino antes de que llegue.',
    'Por olvidar tu segunda Habilidad: si no vas a atacar, <b>Maratón de K-dramas</b> te da una carta gratis. Es 0 PD.'
  ],
  vs:{mohamed:['Parejo','Sus rebotes te hacen perder tempo.'],fender:['Favorable','Provocar apaga su turno letal.'],
      rafaela:['Favorable','Tus cuerpos pasan por encima de los Discípulos.'],talesin:['Difícil','Aliento de Ácido y Tal.'],gero:['Favorable','Provocar e Intimidante le rompen la corte antes de que la junte.']}
},
rafaela:{
  dif:2, lema:'Un enjambre que se cura solo y no se puede limpiar del todo.',
  ganas:`Cada <b>Discípulo</b> que entra a tu campo cura 2, y los Discípulos genéricos
    <b>crecen entre sí</b>. Tú no ganas una carrera: ganas alargando la partida hasta que su
    mesa no puede con la tuya y tu Alma sigue casi intacta.`,
  motor:['discipulo','titaus','espiritus','rulchete','leche'],
  motorTxt:`Tres <b>Discípulo de Rul</b> más tres <b>Titaus</b> y tres <b>Matildus</b>: con
    tres Discípulos en mesa, cada uno es un 3/2 por 1 PD. <b>Espíritus Guardianes</b> hace
    que atacarte cueste 2 de daño por cabeza, y <b>Taumaturgia</b> te roba carta gratis
    cuando ya tienes tres.`,
  turnos:[
    ['1–3','Suelta Discípulos sin miedo. Cada uno son 2 de curación por tu pasiva, así que aunque te estén pegando tu Alma no baja.'],
    ['4–6','<b>Espíritus Guardianes</b>. A partir de aquí el rival paga peaje por atacarte y tú sigues sumando cuerpos. <b>Titaus</b> te filtra el mazo para encontrar lo que falte.'],
    ['7+','<b>Rulchete</b> sobre <b>Machete</b> (o cualquier cosa de Costo 2 o menos) = un <b>7/7 con Vuelo</b> que casi nadie puede bloquear. Ése es tu remate.']
  ],
  combo:`<b>Rulchete sobre Machete.</b> Machete cuesta 1 y no hace nada; convertido en
    <b>Dragón Celestial Morado 7/7 volador</b> gana la partida en dos ataques. Guárdalo hasta
    tener el turno libre, porque vuelve a su forma al final de tu siguiente turno.`,
  mano:`Quédate Discípulos y <b>Taumaturgia</b>. <b>Leche de Petunia</b> y <b>Auxilio</b>
    valen mucho más en el turno 5 que en el 1: no los busques de salida.`,
  pierdes:[
    'Contra Dragones. <b>Adolfo y Remus</b> se cambian de bando si el rival controla uno: no los juegues si ves <b>Las Montañas de Tal</b> en la mesa.',
    'Por curar demasiado pronto. Las curaciones no acumulan: guárdalas hasta que haya daño real que quitar.',
    'Contra el <b>Pergamino</b>. Tu única respuesta es <b>Juan Gabriel</b>, que congela su contador. Si el rival junta Llaves, búscalo con Titaus ya.'
  ],
  vs:{mohamed:['Difícil','No tienes cómo parar el Pergamino salvo Juan Gabriel.'],fender:['Parejo','Tus curaciones contra su velocidad.'],
      adreida:['Difícil','Sus cuerpos pasan por encima del enjambre.'],talesin:['Parejo','Espíritus Guardianes castiga su sacrificio de Eric.'],gero:['Parejo','Enjambre contra enjambre: gana el que aguante más de pie.']}
},
talesin:{
  dif:3, lema:'Todo en este mazo quiere morir.',
  ganas:`Cada aliado que muere te da una <b>Ficha de Gracia</b>. Con cinco, <b>asciendes</b>:
    +5 Alma y tus <b>Celestiales</b> ganan +2/+2 permanentes. Y lo que de verdad decide la
    partida: <b>a partir de ahí, cada Personaje que bajes nace Celestial y con +2/+2</b>.
    Ascender con el campo vacío no es un problema, es el momento de rellenarlo. Tu mazo no
    protege a nadie — lo gasta. Y detrás viene <b>Tal</b> o el <b>Pergamino</b>.`,
  motor:['matildus','eric','tal','montanas','domo'],
  motorTxt:`<b>Matildus</b> explota en la cara de quien lo mata, <b>Eric</b> se sacrifica por
    otro, el <b>Conserje</b> deja Llaves, <b>Aidman</b> te da 2 PD al morir. Todo suma
    Gracia. <b>Las Montañas de Tal</b> abaratan a los Dragones 2 PD: Tal deja de costar 10 y
    baja el turno 8, o antes con <b>Puntos Robados</b>.`,
  turnos:[
    ['1–3','Cosas baratas y sacrificables. No te importa perderlas: es el plan. <b>Puntos Robados</b> temprano para acelerar después.'],
    ['4–6','<b>Aliento de Ácido</b> limpia su mesa y, si mata a los tuyos también, mejor: más Gracia. <b>Rayo Abrasador</b> puede rematar a tus propios Personajes para llegar a cinco.'],
    ['7+','Asciendes y bajas a <b>Tal</b> o el <b>Pergamino</b>. Con Tal en mesa el Pergamino <b>no necesita Llaves</b>, y llevas <b>El Domo</b> para que cada Llave cuente doble.']
  ],
  combo:`<b>Petunia + Ascensión.</b> Petunia muere y vuelve como <b>Petunia Sagrada</b>, que es
    <i>Celestial</i>. Si asciendes después, se queda en <b>5/7 con Vuelo</b>. Y con
    <b>Luz de Kenya</b> puedes hacer Celestial a cualquier otra cosa antes de ascender para
    que se lleve el +2/+2.`,
  mano:`Quédate <b>Matildus</b>, <b>Eric</b> y <b>Puntos Robados</b>. <b>Tal</b> en la mano
    inicial es una carta muerta durante siete turnos: sólo consérvalo si también tienes
    <b>Las Montañas</b>.`,
  pierdes:[
    'Por lento. Contra <b>Fender</b> estás muerto en el turno 6 si no encuentras <b>Aliento de Ácido</b> temprano.',
    'Por contar mal la Gracia. Mira el contador ✨ de tu barra antes de sacrificar: llegar a 4 y quedarte ahí es perder la partida a medias.',
    'Por bajar a <b>Lucy Fernando</b> sin un <b>Contrato</b>. Sin él no puede atacar: el <b>Contrato del Notario</b> boca abajo está en el mazo justo para eso.'
  ],
  vs:{mohamed:['Parejo','Carrera de Llaves.'],fender:['Difícil','Te mata antes de que arranques.'],
      adreida:['Favorable','Aliento de Ácido y Tal la desbordan.'],rafaela:['Parejo','Sus Espíritus castigan tus sacrificios.'],gero:['Difícil','Te llena la mesa antes de que asciendas.']}
},

gero:{
  dif:3, lema:'Tú no llevas un héroe: llevas la mesa entera.',
  ganas:`Los demás Protagonistas entraron al Domo. Tú lo <b>narras</b>. Tu mazo no son
    compañeros: son los <b>NPC</b> que repartes, y ganan por acumulación — cuantos más haya
    en pie, más cerca estás de bajar a <b>El Rey</b> y cerrar la campaña sin pegar un golpe.`,
  motor:['can','rambo','correcaminos','coyote','rey'],
  motorTxt:`Cuerpos baratos que llegan de dos en dos. <b>Can</b> entra con <b>dos Goblins</b>
    de regalo, así que él solo llena media mesa. <b>Rambo</b> cuesta 1 y pega 3 el turno que
    entra. <b>El Correcaminos</b> corre más si <b>El Coyote</b> anda por ahí — aunque sea del
    rival. Y todo eso existe para un momento: <b>El Rey</b> con otros tres en pie.`,
  turnos:[
    ['1–3','Cuerpos, cuerpos y cuerpos. <b>Machete</b>, <b>El Correcaminos</b>, <b>Rambo</b> si quieres tres de daño gratis. No mires el Alma del rival todavía: mira cuántos NPC tienes de pie al empezar tu turno.'],
    ['4–6','<b>Can</b> es tu mejor turno: entra él y entran dos Goblins con Provocar, que además te protegen a los demás. <b>Juguetes para el Cíclope</b> boca abajo cancela el ataque que venga a romperte la mesa y te deja dos Ilusiones más.'],
    ['7+','Con la mesa a cuatro, baja a <b>El Rey</b>. Sólo tienes que llegar vivo al inicio de tu siguiente turno con él y otros tres. El rival lo sabe y va a matar algo: por eso guardas <b>Peaje del Puente</b> y las Trampas para ese turno exacto.']
  ],
  combo:`<b>Can + El Rey.</b> Can pone tres cuerpos con una sola carta, así que la corte se
    reúne en un turno en vez de en tres. Si te falta uno, <b>Rulchete de Bajo Presupuesto</b>
    invoca un 0/6 con Provocar por 3 PD: no pega, pero cuenta — y aguanta.`,
  mano:`Quédate lo barato. <b>Machete</b>, <b>El Correcaminos</b> y <b>Brújula</b> valen más
    que <b>El Rey</b> de salida: él es un ladrillo de 7 PD hasta el turno 7, y sin mesa que
    reunir no hace nada. Descártalo sin pena si la mano no tiene cuerpos.`,
  pierdes:[
    'Por bajar a <b>El Rey</b> con la mesa a dos. Es un 3/8 caro que no gana solo: si no hay tres más, es sólo un cuerpo grande.',
    'Por olvidar que el <b>dado</b> también pierde. Con 10 o menos te cuesta 1 Alma, y eso son 10 puntos a lo largo de una partida larga: no alargues lo que puedas cerrar.',
    'Por gastar las Trampas pronto. Tu mesa se rompe en un solo turno rival; guárdalas para el turno en que la corte esté a punto.'
  ],
  vs:{mohamed:['Favorable','Su plan es lento y el tuyo llena la mesa antes.'],
      fender:['Difícil','Barre cuerpos baratos, que es exactamente lo que llevas.'],
      adreida:['Difícil','Provocar y cuerpos grandes te desmontan la corte.'],
      rafaela:['Parejo','Sus curaciones contra tu acumulación.'],
      talesin:['Favorable','Aliento de Ácido te duele, pero llegas antes.']}
}
};

/* Medido con balance.html: 4 tandas de 2880 partidas (11 520 en total), bot
   contra bot en los 30 cruces. Llevaba tiempo diciendo que Adreida ganaba el
   90 % «en 280 partidas», que era de una versión vieja del juego y de una
   muestra veinte veces menor. */

const GUIA_DATOS = {mohamed:40, fender:43, adreida:55, rafaela:53, talesin:40, gero:54};

const GUIA_PARTIDAS = '11 520';

let GUIA_SEL='fender';

async function autoTurn(s){
  // usa la misma lógica del rival para el bando indicado (arnés de pruebas)
  let guard=0; const skip=new Set();
  while(guard++<16&&!G.over){
    const o=P(s).hand.filter(id=>canPlay(s,id)&&!skip.has(id)).map(id=>({id,v:aiScore(id,s)}))
      .filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
    if(!o.length) break;
    if(!await playFromHand(s,o[0].id)) skip.add(o[0].id);
  }
  for(const u of [...P(s).field]) if(u.card.act&&!u.actUsed&&P(s).pd>=u.card.act.cost&&(!u.card.act.req||u.card.act.req(G,s))) await useAct(u);
  const L=P(s).L;
  if(!P(s).leaderUsed&&P(s).pd>=L.habCost&&(!L.habReq||L.habReq(G,s))) await useLeader(s);
  let g2=0;
  while(g2++<12&&!G.over){
    const ready=P(s).field.filter(canAttack).sort((a,b)=>b.atk-a.atk);
    if(!ready.length) break;
    const t=aiPickAttack(ready[0]);
    if(!t){ ready[0].attacked=true; recalc(); continue; }
    await doAttack(ready[0],t);
  }
  if(!G.over) await endTurn();
}

const LIENZO = { ancho: 1500, alto: 1040 };
/* EL LIENZO VERTICAL
   Un teléfono de pie no admite el reparto de un monitor apaisado: a 1500 de
   ancho el zoom lo dejaría en un cuarto y no se leería nada. Así que hay un
   segundo lienzo con la proporción de un teléfono (460×980 ≈ 0,47, como un
   393×852) y su PROPIO reparto de la mesa, escrito en CSS bajo `html.movil`.
   La clase la decide un solo sitio —ajustarLienzo— y no un @media, para poder
   forzarla desde un escritorio y comprobarla, y para que el arnés, que corre
   apaisado, no la vea nunca. */

const LIENZO_V = { ancho: 460, alto: 980 };
