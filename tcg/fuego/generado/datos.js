/* Tres cartas reales; sin partida. */
const CARDS={"tal":{"n":"Thal","t":"personaje","c":10,"a":9,"h":9,"tr":["Dragón"],"r":2,"art":"🐉","x":"\u003cb>Vuelo. Aliento de Ácido — al entrar:\u003c/b> 3 daño a todos los Personajes rivales. \u003cb>Poseer (3 PD):\u003c/b> revive un rival muerto este turno como 2/2 en tu campo. \u003cb>Ganador de la temporada:\u003c/b> puedes jugar el Pergamino sin Llaves.","keys":["vuelo"],"scrollFree":true,"act":{"cost":3,"n":"Poseer"},"id":"tal"},"bartolomeo":{"n":"Bartolomeo","t":"personaje","c":2,"a":1,"h":2,"tr":["Humano","Sirviente","Casa Boss"],"r":0,"art":"🤵","x":"\u003cb>Al entrar:\u003c/b> roba 1 carta. \u003cb>Pomposo:\u003c/b> tus Nobles cuestan 1 PD menos.","id":"bartolomeo"},"eric":{"n":"Eric","t":"personaje","c":3,"a":3,"h":3,"tr":["Humano","Paladín","Casa Boss"],"r":0,"art":"🛡️","x":"\u003cb>Sacrificio:\u003c/b> cuando un aliado vaya a recibir daño letal, puedes destruir a Eric en su lugar (el daño se anula).","guard":true,"id":"eric"}};
const SUBNAME={"engano":"Engaño","fe":"Fe","cancion":"Canción","fuego":"Fuego","contrato":"Contrato","rapido":"Rápido"};

const cap = s => s.charAt(0).toUpperCase()+s.slice(1);

function tribeLine(c){ return (c.tr&&c.tr.length? c.tr.join(' · ') : (c.t==='hechizo'&&c.sub? c.sub.map(x=>SUBNAME[x]).join(' · '): cap(c.t))); }
