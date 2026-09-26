/* El Mago del Domo; sin partida. */
const CARDS={"magodomo":{"n":"El Mago del Domo","t":"personaje","c":8,"a":4,"h":8,"tr":["Humano","Mago"],"r":2,"art":"🔮","x":"\u003cb>Nexo:\u003c/b> cada vez que muere cualquier Personaje ganas 1 Alma. \u003cb>Sacrificio de Sangre (3 PD):\u003c/b> destruye un aliado y gana 1 Llave. \u003cb>Vínculo:\u003c/b> si muere, pierdes 3 Alma.","nexus":true,"act":{"cost":3,"n":"Sacrificio de Sangre","tg":{"k":"unidadAliada","min":1,"max":1}},"id":"magodomo"}};
const SUBNAME={"engano":"Engaño","fe":"Fe","cancion":"Canción","fuego":"Fuego","contrato":"Contrato","rapido":"Rápido"};

const cap = s => s.charAt(0).toUpperCase()+s.slice(1);

function tribeLine(c){ return (c.tr&&c.tr.length? c.tr.join(' · ') : (c.t==='hechizo'&&c.sub? c.sub.map(x=>SUBNAME[x]).join(' · '): cap(c.t))); }
window.VISOR_GPU_ARTE={"normal":{"url":"art/magodomo.webp","enc":{"x":50,"y":30,"z":100}},"foil":{"url":"art/magodomo-foil-v1.webp","enc":{"x":50,"y":30,"z":100}},"dorado":{"url":"art/magodomo-dorado-v1.webp","enc":{"x":50,"y":30,"z":100}}};
