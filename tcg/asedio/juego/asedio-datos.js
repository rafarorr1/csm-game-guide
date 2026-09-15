/*
 * Caoz: El Asedio de Thal — contenido de Modo Domo.
 *
 * Este archivo es deliberadamente sólo datos. Las cartas conservan su id, nombre
 * y arte del TCG, pero sus efectos para el juego cooperativo viven aquí. El motor
 * no contiene números de balance ni casos por nombre de carta.
 */
(function(){
'use strict';

const HEROES={
  mohamed:{id:'mohamed',n:'Mohamed',ep:'El Mago Pitero',art:'lider_mohamed',asalto:1,vida:8,contador:'apertura',color:'#4aa6ff',icono:'⌘',lider:'Al declarar Asalto, gasta 1 Apertura: +2 daño; si elige ignorar Guardia, conserva ese +2.'},
  fender:{id:'fender',n:'Fender',ep:'La Voz de Valoria',art:'lider_fender',asalto:2,vida:8,contador:'ritmo',color:'#c97cff',icono:'♫',lider:'Al declarar Asalto, gasta cualquier Ritmo: +1 daño por ficha.'},
  adreida:{id:'adreida',n:'Adreida',ep:'La Intimidante',art:'lider_adreida',asalto:3,vida:8,contador:'ruptura',color:'#ff8069',icono:'⚔',lider:'Al derribar una Guardia, el exceso de su Asalto alcanza a Thal.'},
  rafaela:{id:'rafaela',n:'Rafaela',ep:'Devota de Rul',art:'lider_rafaela',asalto:1,vida:8,contador:'fe',color:'#f4c75c',icono:'☀',lider:'Al declarar Asalto, gasta cualquier Fe: +1 daño por ficha.'},
  talesyn:{id:'talesyn',n:'Talesyn',ep:'El Heredero Celestial',art:'lider_talesin',asalto:2,vida:8,contador:'gracia',color:'#63dca0',icono:'✦',lider:'Al declarar Asalto, gasta 1 Gracia: +1 daño; también puede guardarla para el Pergamino.'}
};

/* Una operación es una primitiva del motor. Nunca se ejecuta JavaScript arbitrario
 * desde una carta: para añadir una regla nueva se agrega una operación probada al
 * motor y luego se declara aquí. */
const CARDS={
  mensaje:{id:'mensaje',tcgId:'mensaje',n:'Mensaje',art:'mensaje',owner:'mohamed',tipo:'tactica',cost:{impulso:1,accion:1},role:'rastro-control',budget:1.6,text:'Intercambia Presagio y Amenaza. Gana 1 Apertura.',effects:[{op:'swapRastro',a:1,b:2},{op:'gainCounter',counter:'apertura',amount:1}]},
  cantaberna:{id:'cantaberna',tcgId:'cantaberna',n:'Canción de Taberna',art:'cantaberna',owner:'fender',tipo:'tactica',cost:{impulso:1,accion:1},role:'assault-enabler',budget:1.1,text:'Gana 1 Ritmo.',effects:[{op:'gainCounter',counter:'ritmo',amount:1}]},
  machete:{id:'machete',tcgId:'machete',n:'Machete (Glip)',art:'machete',owner:'adreida',tipo:'equipo',cost:{impulso:1,accion:1},role:'guard-answer',budget:1.4,text:'Entra con 1 carga. Retírala: el Asalto de Adreida gana Perforar.',effects:[{op:'addPreparation',key:'machete',charges:1}]},
  discipulo:{id:'discipulo',tcgId:'discipulo',n:'Discípulo de Rul',art:'discipulo',owner:'rafaela',tipo:'aliado',cost:{impulso:1,accion:1},role:'support',budget:1.5,text:'Al entrar, Rafaela gana 1 Fe y restaura 1 Aguante.',effects:[{op:'summon',slot:'support',unit:{id:'discipulo_rul',n:'Discípulo de Rul',attack:1,hp:2}},{op:'gainCounter',counter:'fe',amount:1},{op:'healHero',amount:1}]},
  eric:{id:'eric',tcgId:'eric',n:'Eric',art:'eric',owner:'talesyn',tipo:'aliado',cost:{impulso:2,accion:1},role:'guard',budget:2.2,text:'Vanguardia. Cuando cae, Puntos Robados puede darte 1 Gracia.',effects:[{op:'summon',slot:'vanguardia',unit:{id:'eric',n:'Eric',attack:2,hp:3,guard:true,owner:'talesyn'}}]},
  llavemago:{id:'llavemago',tcgId:'llavemago',n:'Llave del Mago',art:'llavemago',owner:'mohamed',tipo:'preparacion',cost:{impulso:1,accion:1},role:'guard-answer',budget:1.2,text:'Gana 1 Apertura.',effects:[{op:'gainCounter',counter:'apertura',amount:1},{op:'addPreparation',key:'llavemago'}]},
  balada:{id:'balada',tcgId:'balada',n:'Balada de Valoria',art:'balada',owner:'fender',tipo:'tactica',cost:{impulso:2,accion:1},role:'assault-enabler',budget:2.0,text:'Gana 2 Ritmo.',effects:[{op:'gainCounter',counter:'ritmo',amount:2}]},
  saeta:{id:'saeta',tcgId:'saeta',n:'Saeta Guía',art:'saeta',owner:'adreida',tipo:'tactica',cost:{impulso:1,accion:1},role:'mark',budget:1.5,text:'Thal queda Expuesto. El siguiente Asalto del equipo hace +1 daño.',effects:[{op:'addThalStatus',status:'expuesto'}]},
  bendicion:{id:'bendicion',tcgId:'bendicion',n:'Bendición de Rul',art:'bendicion',owner:'rafaela',tipo:'tactica',cost:{impulso:1,accion:1},role:'assault-enabler',budget:1.7,text:'Gana 2 Fe.',effects:[{op:'gainCounter',counter:'fe',amount:2}]},
  puntosrobados:{id:'puntosrobados',tcgId:'puntosrobados',n:'Puntos Robados',art:'puntosrobados',owner:'talesyn',tipo:'preparacion',cost:{impulso:1,accion:1},role:'sacrifice-engine',budget:1.6,text:'La primera vez que caiga un aliado de Talesyn en la ronda, gana 1 Gracia.',effects:[{op:'addPreparation',key:'puntosrobados'}]},
  brickbrock:{id:'brickbrock',tcgId:'brickbrock',n:'Brick y Brock',art:'ladrillos',owner:'mohamed',tipo:'aliado',cost:{impulso:2,accion:1},role:'vanguardia',budget:2.0,text:'Vanguardia.',effects:[{op:'summon',slot:'vanguardia',unit:{id:'brickbrock',n:'Brick y Brock',attack:2,hp:3,owner:'mohamed'}}]},
  matildus:{id:'matildus',tcgId:'matildus',n:'Matildus',art:'matildus',owner:'fender',tipo:'aliado',cost:{impulso:1,accion:1},role:'sacrifice',budget:1.1,text:'Al caer, Fender gana 2 Ritmo.',effects:[{op:'summon',slot:'support',unit:{id:'matildus',n:'Matildus',attack:1,hp:1,owner:'fender',onFall:{op:'gainCounter',counter:'ritmo',amount:2}}}]},
  armadura:{id:'armadura',tcgId:'armadura',n:'Armadura Mágica',art:'armamagica',owner:'adreida',tipo:'reaccion',cost:{impulso:1,accion:1},role:'defense',budget:1.4,text:'Preparación: previene los próximos 2 daño contra Adreida o uno de sus aliados.',effects:[{op:'addPreparation',key:'armadura',charges:2}]},
  taumaturgia:{id:'taumaturgia',tcgId:'taumaturgia',n:'Taumaturgia',art:'taumaturgia',owner:'rafaela',tipo:'tactica',cost:{impulso:2,accion:1},role:'recovery',budget:1.8,text:'Rafaela restaura 2 Aguante y gana 1 Fe.',effects:[{op:'healHero',amount:2},{op:'gainCounter',counter:'fe',amount:1}]},
  disipar:{id:'disipar',tcgId:'disipar',n:'Disipar Magia',art:'disipar',owner:'talesyn',tipo:'tactica',cost:{impulso:2,accion:1},role:'cleanse',budget:2.0,text:'Quita Poseído, Guardia, Armadura o Infectado de una carta.',effects:[{op:'cleanse'}]},
  sangrefria:{id:'sangrefria',tcgId:'sangrefria',n:'Golpe a Sangre Fría',art:'sangrefria',owner:'mohamed',tipo:'tactica',cost:{impulso:2,accion:1},role:'damage',budget:2.0,text:'El próximo Asalto de Mohamed gana +2 daño.',effects:[{op:'addHeroStatus',status:'golpe_sangre_fria'}]},
  zancada:{id:'zancada',tcgId:'zancada',n:'Zancada Larga',art:'zancada',owner:'fender',tipo:'tactica',cost:{impulso:1,accion:1},role:'positioning',budget:1.0,text:'Gana 1 Ritmo. En este tutorial puedes conservarlo para el siguiente reto.',effects:[{op:'gainCounter',counter:'ritmo',amount:1}]},
  rulchete:{id:'rulchete',tcgId:'rulchete',n:'Rulchete',art:'rulchete',owner:'rafaela',tipo:'tactica',cost:{impulso:2,accion:1},role:'finisher',budget:2.0,text:'El próximo Asalto de Rafaela puede gastar Fe e ignora una Guardia.',effects:[{op:'addHeroStatus',status:'rulchete'}]},

  aliento:{id:'aliento',tcgId:'alientoacido',n:'Aliento de Ácido',art:'alientoacido',owner:'thal',tipo:'amenaza',cost:{},resolveGains:{ira:1},role:'pressure',budget:2.2,text:'Cada Vanguardia recibe 2 daño. Cada héroe sin Vanguardia pierde 1 Aguante.',effects:[{op:'aliento'}]},
  rayo:{id:'rayo',tcgId:'rayoabrasador',n:'Rayo Abrasador',art:'rayoabrasador',owner:'thal',tipo:'amenaza',cost:{},resolveGains:{ira:1},role:'pressure',budget:2.0,text:'Reparte 3 daño entre héroes y Vanguardias elegidos.',effects:[{op:'damageTargets',amount:3,split:true}]},
  proyectil:{id:'proyectil',tcgId:'proyectil',n:'Proyectil Mágico',art:'proyectil',owner:'thal',tipo:'amenaza',cost:{},resolveGains:{ira:1},role:'pressure',budget:1.8,text:'Hace 2 daño a un héroe o a su Vanguardia.',effects:[{op:'damageTarget',amount:2}]},
  trol:{id:'trol',tcgId:'trol',n:'Trol de la Mano Larga',art:'trol',owner:'thal',tipo:'esbirro',cost:{dominio:2,comando:1},role:'guard',budget:2.8,text:'Guardia. 2/4.',effects:[{op:'summonMinion',unit:{id:'trol',n:'Trol de la Mano Larga',attack:2,hp:4,guard:true}}]},
  nube:{id:'nube',tcgId:'nubedagas',n:'Nube de Dagas',art:'nubedagas',owner:'thal',tipo:'amenaza',cost:{},resolveGains:{ira:1},role:'pressure',budget:1.9,text:'Cada Vanguardia recibe 1 daño. Si cae una, Thal gana 1 Ira.',effects:[{op:'nube'}]},
  esporas:{id:'esporas',tcgId:'esporas',n:'Esporas del Demonio',art:'esporas',owner:'thal',tipo:'reaccion',cost:{dominio:1},role:'debuff',budget:1.2,text:'Cuando caiga un aliado, Infecta a un protagonista: su próximo Asalto hace −1 daño.',effects:[{op:'infectHero'}]},
  domo:{id:'domo',tcgId:'domo',n:'El Domo',art:'domo',owner:'thal',tipo:'lugar',cost:{dominio:2,comando:1},role:'defense',budget:2.0,text:'Al entrar, Thal gana 1 Dominio. Una vez por ronda puede dar Guardia.',effects:[{op:'addThalPlace',key:'domo'},{op:'gainDominion',amount:1}]},
  magodomo:{id:'magodomo',tcgId:'magodomo',n:'El Mago del Domo',art:'magodomo',owner:'thal',tipo:'esbirro',cost:{dominio:2,comando:1},role:'pressure',budget:2.1,text:'1/3. Al entrar, Thal gana 1 Ira.',effects:[{op:'summonMinion',unit:{id:'magodomo',n:'El Mago del Domo',attack:1,hp:3}},{op:'gainRage',amount:1}]},
  thalhabla:{id:'thalhabla',tcgId:'talcadaver',n:'Thal Habla por el Cadáver',art:'talcadaver',owner:'thal',tipo:'amenaza',cost:{},role:'possession',budget:2.6,text:'Devuelve el último aliado caído como Esbirro Poseído 2/2. Avanza 1 Deseo.',effects:[{op:'possessLastFallen'}]},
  aldrick:{id:'aldrick',tcgId:'aldrick',n:'Aldrick Boss',art:'aldrick',owner:'thal',tipo:'esbirro',cost:{dominio:2,comando:1},role:'guard',budget:3.0,text:'Guardia. 3/4.',effects:[{op:'summonMinion',unit:{id:'aldrick',n:'Aldrick Boss',attack:3,hp:4,guard:true}}]},
  talia:{id:'talia',tcgId:'talia',n:'Talia Boss',art:'talia',owner:'thal',tipo:'reaccion',cost:{dominio:2},role:'mitigation',budget:2.1,text:'Durante una ventana de Reacción, reduce el Asalto en hasta 2 daño.',effects:[{op:'reducePendingAttack',amount:2}]}
};

/* Los mazos son fijos y públicos. El tutorial fija además qué cartas empiezan en
 * la mano; una partida completa puede tomar estas mismas listas y variar sólo
 * el orden de robo. */
const DECKS={
  mohamed:['mensaje','llavemago','brickbrock','sangrefria'],
  fender:['cantaberna','balada','matildus','zancada'],
  adreida:['machete','saeta','armadura'],
  rafaela:['discipulo','bendicion','taumaturgia','rulchete'],
  talesyn:['eric','puntosrobados','disipar'],
  thal:['aliento','rayo','proyectil','trol','nube','esporas','domo','magodomo','thalhabla','aldrick','talia']
};

const PROFILES={
  /* heroIds es el equipo predeterminado, no una restricción de personajes:
   * createState({profile:'normal_3',heroIds:[...]}) permite elegir cualquier
   * combinación válida del tamaño indicado sin tocar mazos ni reglas. */
  tutorial_5:{id:'tutorial_5',label:'Tutorial · 5 protagonistas',playerCount:5,heroIds:['mohamed','fender','adreida','rafaela','talesyn'],heroes:{vida:8,impulsos:3,acciones:2,asaltos:1},thal:{vida:36,dominio:6,comandos:2,reacciones:1,iraMax:8,deseoMax:3,esbirros:2},fases:[{id:1,minVida:25},{id:2,minVida:13},{id:3,minVida:0}]},
  normal_3:{id:'normal_3',label:'Partida completa · 3 protagonistas',playerCount:3,heroIds:['mohamed','fender','adreida'],heroes:{vida:9,impulsos:3,acciones:2,asaltos:1},thal:{vida:48,dominio:4,comandos:2,reacciones:1,iraMax:8,deseoMax:3,esbirros:2},fases:[{id:1,minVida:33},{id:2,minVida:17},{id:3,minVida:0}]},
  normal_4:{id:'normal_4',label:'Partida completa · 4 protagonistas',playerCount:4,heroIds:['mohamed','fender','adreida','rafaela'],heroes:{vida:8,impulsos:3,acciones:2,asaltos:1},thal:{vida:60,dominio:5,comandos:2,reacciones:1,iraMax:8,deseoMax:3,esbirros:2},fases:[{id:1,minVida:41},{id:2,minVida:21},{id:3,minVida:0}]},
  normal_5:{id:'normal_5',label:'Partida completa · 5 protagonistas',playerCount:5,heroIds:['mohamed','fender','adreida','rafaela','talesyn'],heroes:{vida:8,impulsos:3,acciones:2,asaltos:1},thal:{vida:72,dominio:6,comandos:2,reacciones:1,iraMax:8,deseoMax:3,esbirros:2},fases:[{id:1,minVida:49},{id:2,minVida:25},{id:3,minVida:0}]}
};

/* El guion no escribe el resultado de una acción: declara qué acción real tiene
 * que llegar al motor. La UI sólo ilumina la acción de este paso. */
const TUTORIAL={
  id:'tutorial-asedio-01',
  titulo:'Tutorial 01 · La Primera Herida',
  heroes:['mohamed','fender','adreida','rafaela','talesyn'],
  profile:'tutorial_5',
  phaseSchedule:{1:2,2:3},
  hands:{
    mohamed:['mensaje','llavemago','brickbrock','sangrefria'],
    fender:['cantaberna','balada','matildus','zancada'],
    adreida:['machete','saeta','armadura'],
    rafaela:['discipulo','bendicion','taumaturgia','rulchete'],
    talesyn:['eric','puntosrobados','disipar'],
    thal:['trol','esporas']
  },
  rastro:{1:['aliento','rayo','proyectil'],2:['nube','domo','magodomo'],3:['thalhabla','aldrick','talia']},
  scenarios:{2:'montanas',3:'pergamino'},
  steps:[
    {id:'bienvenida',kind:'say',chapter:'Montaje',title:'Todos pueden herir a Thal',text:'No hay una clase de apoyo que espere fuera del combate: cada protagonista puede gastar una acción para Asaltar directamente a Thal.'},
    {id:'r1-mensaje',kind:'task',actor:'mohamed',title:'Abre el Rastro',text:'Mohamed juega Mensaje. Cambia el futuro visible y gana Apertura.',expect:{type:'PLAY_CARD',actor:'mohamed',card:'mensaje'}},
    {id:'r1-mohamed-asalta',kind:'task',actor:'mohamed',title:'Primer Asalto',text:'Gasta la Apertura como daño. Mohamed ataca a Thal por 3.',expect:{type:'DECLARE_ASSAULT',actor:'mohamed',spend:{apertura:1},mode:'damage'}},
    {id:'r1-fender-canta',kind:'task',actor:'fender',title:'Ritmo antes del golpe',text:'Fender juega Canción de Taberna y gana Ritmo.',expect:{type:'PLAY_CARD',actor:'fender',card:'cantaberna'}},
    {id:'r1-fender-asalta',kind:'task',actor:'fender',title:'Thal puede responder',text:'Fender gasta 1 Ritmo y declara Asalto. Thal recibe una ventana de Reacción.',expect:{type:'DECLARE_ASSAULT',actor:'fender',spend:{ritmo:1},holdForResponse:true}},
    {id:'r1-reflejo',kind:'task',actor:'thal',title:'Reflejo del Domo',text:'El jugador Thal paga 1 Dominio para reducir el Asalto de Fender en 1.',expect:{type:'REFLECTION',actor:'thal'}},
    {id:'r1-machete',kind:'task',actor:'adreida',title:'Perforar queda preparado',text:'Adreida equipa Machete. La carga servirá contra una Guardia.',expect:{type:'PLAY_CARD',actor:'adreida',card:'machete'}},
    {id:'r1-adreida-asalta',kind:'task',actor:'adreida',title:'La fuerza de Adreida',text:'Adreida ataca directamente por 3.',expect:{type:'DECLARE_ASSAULT',actor:'adreida'}},
    {id:'r1-discipulo',kind:'task',actor:'rafaela',title:'Fe que también golpea',text:'Rafaela juega Discípulo de Rul y gana Fe.',expect:{type:'PLAY_CARD',actor:'rafaela',card:'discipulo'}},
    {id:'r1-rafaela-asalta',kind:'task',actor:'rafaela',title:'Rafaela también ataca',text:'Gasta 1 Fe. Su Asalto pasa de 1 a 2.',expect:{type:'DECLARE_ASSAULT',actor:'rafaela',spend:{fe:1}}},
    {id:'r1-eric',kind:'task',actor:'talesyn',title:'Una Vanguardia',text:'Talesyn juega a Eric delante del grupo.',expect:{type:'PLAY_CARD',actor:'talesyn',card:'eric'}},
    {id:'r1-talesyn-asalta',kind:'task',actor:'talesyn',title:'El quinto golpe',text:'Talesyn ataca a Thal por 2.',expect:{type:'DECLARE_ASSAULT',actor:'talesyn'}},
    {id:'r1-aliento',kind:'task',actor:'thal',title:'La Amenaza se resuelve',text:'Thal resuelve Aliento de Ácido. Eric queda con 1 Resistencia.',expect:{type:'RESOLVE_RASTRO',actor:'thal',card:'aliento'}},
    {id:'r1-trol',kind:'task',actor:'thal',title:'Dominio no es una IA',text:'El jugador Thal gasta 2 Dominio y una Orden para jugar al Trol.',expect:{type:'PLAY_CARD',actor:'thal',card:'trol'}},
    {id:'r1-cierre',kind:'task',actor:'thal',title:'El cambio de fase ocurre al cierre',text:'Cierra la ronda. Thal llega a 24 Vida y entra a Las Montañas.',expect:{type:'CLOSE_ROUND',actor:'thal'}},
    {id:'r2-intro',kind:'say',chapter:'Guardia',title:'Una Guardia no cancela al equipo',text:'El Trol puede interponerse, pero no decide quién puede atacar. Mohamed y Adreida tienen respuestas distintas.'},
    {id:'r2-llave',kind:'task',actor:'mohamed',title:'Apertura contra Guardia',text:'Mohamed juega Llave del Mago para recuperar Apertura.',expect:{type:'PLAY_CARD',actor:'mohamed',card:'llavemago'}},
    {id:'r2-mohamed-asalta',kind:'task',actor:'mohamed',title:'Ignora Guardia',text:'Gasta Apertura para ignorar la Guardia del Trol y causar 3 daño.',expect:{type:'DECLARE_ASSAULT',actor:'mohamed',spend:{apertura:1},mode:'ignore_guard'}},
    {id:'r2-balada',kind:'task',actor:'fender',title:'Dos compases',text:'Fender juega Balada y gana 2 Ritmo.',expect:{type:'PLAY_CARD',actor:'fender',card:'balada'}},
    {id:'r2-fender-asalta',kind:'task',actor:'fender',title:'La Guardia elige interceptar',text:'Fender gasta 2 Ritmo: Asalto 4. Ahora Thal puede redirigirlo al Trol.',expect:{type:'DECLARE_ASSAULT',actor:'fender',spend:{ritmo:2}}},
    {id:'r2-intercepta',kind:'task',actor:'thal',title:'El Trol protege a Thal',text:'El jugador Thal elige Guardia. El Trol recibe 4 daño, cae y Fender no deja exceso.',expect:{type:'INTERCEPT',actor:'thal',unit:'trol'}},
    {id:'r2-saeta',kind:'task',actor:'adreida',title:'Exponer a Thal',text:'Adreida juega Saeta Guía: el próximo Asalto del equipo gana +1.',expect:{type:'PLAY_CARD',actor:'adreida',card:'saeta'}},
    {id:'r2-adreida-asalta',kind:'task',actor:'adreida',title:'Daño directo',text:'El Asalto de Adreida es 3 más Expuesto: 4 daño a Thal.',expect:{type:'DECLARE_ASSAULT',actor:'adreida'}},
    {id:'r2-bendicion',kind:'task',actor:'rafaela',title:'La fe es presión',text:'Rafaela juega Bendición de Rul y gana 2 Fe.',expect:{type:'PLAY_CARD',actor:'rafaela',card:'bendicion'}},
    {id:'r2-rafaela-asalta',kind:'task',actor:'rafaela',title:'Otro golpe de Rafaela',text:'Gasta 2 Fe: Asalto 3.',expect:{type:'DECLARE_ASSAULT',actor:'rafaela',spend:{fe:2}}},
    {id:'r2-puntos',kind:'task',actor:'talesyn',title:'El sacrificio se prepara',text:'Talesyn juega Puntos Robados.',expect:{type:'PLAY_CARD',actor:'talesyn',card:'puntosrobados'}},
    {id:'r2-talesyn-asalta',kind:'task',actor:'talesyn',title:'Talesyn no espera',text:'Talesyn ataca a Thal por 2.',expect:{type:'DECLARE_ASSAULT',actor:'talesyn'}},
    {id:'r2-nube',kind:'task',actor:'thal',title:'Eric cae',text:'Resuelve Nube de Dagas. Eric recibe su último daño y cae.',expect:{type:'RESOLVE_RASTRO',actor:'thal',card:'nube'}},
    {id:'r2-esporas',kind:'task',actor:'thal',title:'Reacción de la mano de Thal',text:'Thal revela Esporas, paga 1 Dominio e Infecta a Mohamed.',expect:{type:'PLAY_REACTION',actor:'thal',card:'esporas',target:'mohamed'}},
    {id:'r2-cierre',kind:'task',actor:'thal',title:'El Pergamino aparece',text:'Cierra la ronda. Thal está a 12 Vida y entra la fase de Deseo.',expect:{type:'CLOSE_ROUND',actor:'thal'}},
    {id:'r3-intro',kind:'say',chapter:'Posesión',title:'Una pausa que enseña',text:'Esta ronda no hay Asaltos. La pausa es sólo del tutorial: deja que Thal convierta a Eric en un problema visible.'},
    {id:'r3-brick',kind:'task',actor:'mohamed',title:'Mohamed prepara mesa',text:'Mohamed juega Brick y Brock.',expect:{type:'PLAY_CARD',actor:'mohamed',card:'brickbrock'}},
    {id:'r3-matildus',kind:'task',actor:'fender',title:'Fender deja una respuesta',text:'Fender juega Matildus.',expect:{type:'PLAY_CARD',actor:'fender',card:'matildus'}},
    {id:'r3-armadura',kind:'task',actor:'adreida',title:'Defensa reactiva',text:'Adreida prepara Armadura Mágica.',expect:{type:'PLAY_CARD',actor:'adreida',card:'armadura'}},
    {id:'r3-tauma',kind:'task',actor:'rafaela',title:'Recuperar no es quedarse fuera',text:'Rafaela juega Taumaturgia y gana 1 Fe para el final.',expect:{type:'PLAY_CARD',actor:'rafaela',card:'taumaturgia'}},
    {id:'r3-poseer',kind:'task',actor:'thal',title:'Thal habla por el cadáver',text:'Resuelve la Amenaza. Eric vuelve agotado como Esbirro Poseído 2/2 y Deseo pasa a 1.',expect:{type:'RESOLVE_RASTRO',actor:'thal',card:'thalhabla'}},
    {id:'r3-cierre',kind:'task',actor:'thal',title:'Una última ronda',text:'Cierra la ronda sin avanzar Deseo: queda una ocasión para cerrar el Domo.',expect:{type:'CLOSE_ROUND',actor:'thal'}},
    {id:'r4-intro',kind:'say',chapter:'Final',title:'El equipo recupera la iniciativa',text:'Thal tiene 12 Vida. No hay que encontrar una carta de ataque: los cinco Asaltos ya existen.'},
    {id:'r4-disipar',kind:'task',actor:'talesyn',title:'Libera a Eric',text:'Talesyn juega Disipar Magia sobre Eric Poseído.',expect:{type:'PLAY_CARD',actor:'talesyn',card:'disipar',target:'eric_poseido'}},
    {id:'r4-talesyn-asalta',kind:'task',actor:'talesyn',title:'Gracia como daño',text:'Gasta 1 Gracia: Talesyn Asalta por 3.',expect:{type:'DECLARE_ASSAULT',actor:'talesyn',spend:{gracia:1}}},
    {id:'r4-golpe',kind:'task',actor:'mohamed',title:'Golpe contra Infección',text:'Mohamed juega Golpe a Sangre Fría.',expect:{type:'PLAY_CARD',actor:'mohamed',card:'sangrefria'}},
    {id:'r4-mohamed-asalta',kind:'task',actor:'mohamed',title:'Mohamed deja 2 daño',text:'El golpe da +2 y la Infección resta 1: Asalto 2.',expect:{type:'DECLARE_ASSAULT',actor:'mohamed'}},
    {id:'r4-zancada',kind:'task',actor:'fender',title:'Fender sigue en la ofensiva',text:'Fender juega Zancada Larga.',expect:{type:'PLAY_CARD',actor:'fender',card:'zancada'}},
    {id:'r4-fender-asalta',kind:'task',actor:'fender',title:'Asalto base',text:'Fender Asalta por 2.',expect:{type:'DECLARE_ASSAULT',actor:'fender'}},
    {id:'r4-adreida-asalta',kind:'task',actor:'adreida',title:'La tercera espada',text:'Adreida Asalta por 3.',expect:{type:'DECLARE_ASSAULT',actor:'adreida'}},
    {id:'r4-rulchete',kind:'task',actor:'rafaela',title:'Rafaela remata',text:'Rafaela juega Rulchete.',expect:{type:'PLAY_CARD',actor:'rafaela',card:'rulchete'}},
    {id:'r4-rafaela-asalta',kind:'task',actor:'rafaela',title:'Cinco protagonistas, una victoria',text:'Gasta 1 Fe. Los 2 daño restantes llevan a Thal a 0.',expect:{type:'DECLARE_ASSAULT',actor:'rafaela',spend:{fe:1}}},
    {id:'victoria',kind:'say',chapter:'Victoria',title:'El Domo no decide por ustedes',text:'El motor llega a Thal 0 porque ejecutaste las mismas reglas que usará una partida completa. Ahora puedes cambiar un número de balance y repetir el escenario.'}
  ]
};

function congelarProfundo(valor){
  if(valor&&typeof valor==='object'&&!Object.isFrozen(valor)){
    Object.values(valor).forEach(congelarProfundo);
    Object.freeze(valor);
  }
  return valor;
}
const DOMO_DATA={version:'0.1.0',heroes:HEROES,cards:CARDS,decks:DECKS,profiles:PROFILES,tutorial:TUTORIAL};
globalThis.CAOZ_ASEDIO_DATA=congelarProfundo(DOMO_DATA);
})();
