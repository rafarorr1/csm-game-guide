/* Cuentas de jugadores: sólo servidor. La base, el correo y el secreto son enlaces
   privados del Worker. Los códigos y las sesiones nunca se registran en consola. */
import {correoConfigurado,enviarCodigoCuenta} from './cuenta-correo.js';
const CODIGO_MS=300000, REENVIO_MS=60000, SESION_MS=30*86400000;
const COOKIE='__Host-caoz-jugador', MAX_CUERPO=1100000, MAX_PROGRESO=524288;
const encoder=new TextEncoder();
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const copia=v=>v===null?null:JSON.parse(v);
const objeto=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fallo=(codigo,status=400,datos={})=>Object.assign(new Error(codigo),{codigo,status,datos});
const json=(datos,status=200,headers={})=>new Response(JSON.stringify(datos),{status,headers:{
  'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private',
  'Pragma':'no-cache','X-Content-Type-Options':'nosniff','Vary':'Cookie, Origin',...headers}});
const cookie=(valor,max)=>`${COOKIE}=${valor}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${max}`;
const aleatorio=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
function codigoAleatorio(){
  // Rechazo del resto evita sesgo de módulo sobre los seis dígitos.
  let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=4294000000);
  return String(n%1000000).padStart(6,'0');
}
async function hmac(secreto,texto){
  const k=await crypto.subtle.importKey('raw',encoder.encode(secreto),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(await crypto.subtle.sign('HMAC',k,encoder.encode(texto)));
}
function canonico(v){
  if(Array.isArray(v))return '['+v.map(canonico).join(',')+']';
  if(objeto(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonico(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
function claves(v,permitidas){if(!objeto(v)||Object.keys(v).some(k=>!permitidas.includes(k)))throw fallo('DATOS');}
function validarProgreso(v,entorno){
  if(v===null)return;
  claves(v,['formato','version','entorno','datos']);
  if(v.formato!=='caoz.progreso'||v.version!==1||v.entorno!==entorno)throw fallo('DATOS');
  claves(v.datos,['campana','borrador','logros','coleccion','premiosDomo','records','nombre']);
  const campos=['campana','borrador','logros','coleccion','premiosDomo','records','nombre'];
  if(campos.some(k=>!Object.hasOwn(v.datos,k)))throw fallo('DATOS');
  for(const k of ['campana','borrador','logros','coleccion','records'])if(v.datos[k]!==null&&!objeto(v.datos[k]))throw fallo('DATOS');
  // El deseo se representa como simulación local; el jugador no autorizó guardarlo.
  if(v.datos.campana&&['borradorDeseo','deseo'].some(k=>Object.hasOwn(v.datos.campana,k)))throw fallo('DATOS');
  if(v.datos.premiosDomo!==null&&!objeto(v.datos.premiosDomo)&&!Array.isArray(v.datos.premiosDomo))throw fallo('DATOS');
  if(v.datos.nombre!==null&&(typeof v.datos.nombre!=='string'||v.datos.nombre.length>40))throw fallo('DATOS');
  let nodos=0;
  function recorrer(x,nivel=0){
    if(++nodos>30000||nivel>24)throw fallo('DATOS');
    if(typeof x==='number'&&!Number.isFinite(x))throw fallo('DATOS');
    if(typeof x==='string'&&x.length>262144)throw fallo('TAMANO',413);
    if(x&&typeof x==='object')for(const [k,y] of Object.entries(x)){
      if(k==='__proto__'||k==='constructor'||k==='prototype'||k.length>200)throw fallo('DATOS');
      recorrer(y,nivel+1);
    }
  }
  recorrer(v);
  if(encoder.encode(JSON.stringify(v)).byteLength>MAX_PROGRESO)throw fallo('TAMANO',413);
}
async function leerCuerpo(request){
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')||''))throw fallo('DATOS',415);
  if(Number(request.headers.get('content-length'))>MAX_CUERPO)throw fallo('TAMANO',413);
  const lector=request.body?.getReader();if(!lector)throw fallo('DATOS');
  const partes=[];let total=0;
  for(;;){const {value,done}=await lector.read();if(done)break;total+=value.byteLength;
    if(total>MAX_CUERPO){await lector.cancel();throw fallo('TAMANO',413);}partes.push(value);}
  const bytes=new Uint8Array(total);let i=0;for(const p of partes){bytes.set(p,i);i+=p.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fallo('DATOS');}
}
async function correoPredeterminado({correo,nombre,codigo,vence},env){
  if(!correoConfigurado(env))throw fallo('NO_DISPONIBLE',503);
  await enviarCodigoCuenta(env,{correo,nombre,codigo,vence});
}
export function crearManejadorCuenta({enviarCodigo=correoPredeterminado,reloj=Date.now}={}){
  return async function manejar(request,env){
    try{
      const url=new URL(request.url),ruta=url.pathname.replace(/^\/api\/cuenta\/?/,'');
      if(!url.pathname.startsWith('/api/cuenta/'))return json({codigo:'NO_ENCONTRADO'},404);
      const lectura=request.method==='GET'&&ruta==='sesion';
      if(!lectura&&(request.method!=='POST'||!['codigo','verificar','progreso','salir'].includes(ruta)))return json({codigo:'METODO'},405);
      if(!lectura&&request.headers.get('origin')!==url.origin)throw fallo('ORIGEN',403);
      if(request.headers.get('sec-fetch-site')==='cross-site')throw fallo('ORIGEN',403);
      if(!env.CUENTAS_DB||typeof env.CUENTAS_SECRET!=='string'||env.CUENTAS_SECRET.length<32||!['produccion','beta'].includes(env.CUENTAS_ENTORNO))throw fallo('NO_DISPONIBLE',503);
      const db=env.CUENTAS_DB,entorno=env.CUENTAS_ENTORNO,ahora=reloj();
      const firmar=(tipo,valor)=>hmac(env.CUENTAS_SECRET,entorno+'|'+tipo+'|'+valor);
      const sentencia=(sql,...args)=>db.prepare(sql).bind(...args);
      const primera=async(sql,...args)=>sentencia(sql,...args).first();
      async function perfil(usuario){
        const fila=await primera('SELECT u.id,u.nombre,u.correo,p.progreso,p.revision FROM cuenta_usuarios u JOIN cuenta_progreso p ON p.usuario=u.id AND p.entorno=u.entorno WHERE u.id=? AND u.entorno=?',usuario,entorno);
        if(!fila)throw fallo('SESION',401);
        return {sesion:{id:fila.id,nombre:fila.nombre,correo:fila.correo},progreso:copia(fila.progreso),revision:fila.revision};
      }
      async function autenticar(){
        const tokens=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(COOKIE+'='));
        if(tokens.length!==1)throw fallo('SESION',401);
        const token=tokens[0].slice(COOKIE.length+1);if(!/^[a-f0-9]{64}$/.test(token))throw fallo('SESION',401);
        const hash=await firmar('sesion',token);
        const fila=await primera('SELECT usuario FROM cuenta_sesiones WHERE hash=? AND entorno=? AND vence>?',hash,entorno,ahora);
        if(!fila)throw fallo('SESION',401);return {...fila,hash};
      }
      if(lectura){const s=await autenticar();return json(await perfil(s.usuario));}
      const datos=await leerCuerpo(request);
      if(ruta==='codigo'){
        claves(datos,['correo','nombre','intencion']);
        const correo=typeof datos.correo==='string'?datos.correo.trim().toLowerCase():'';
        const nombre=typeof datos.nombre==='string'?datos.nombre.trim():'';
        if(correo.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(correo)||/[^\x20-\x7e]/.test(correo))throw fallo('DATOS');
        if(!['crear','entrar'].includes(datos.intencion)||nombre.length>40||/[\x00-\x1f\x7f]/.test(nombre)||(datos.intencion==='crear'&&nombre.length<2))throw fallo('DATOS');
        if(enviarCodigo===correoPredeterminado&&!correoConfigurado(env))throw fallo('NO_DISPONIBLE',503);
        const id=crypto.randomUUID(),codigo=codigoAleatorio(),vence=ahora+CODIGO_MS;
        const correoHash=await firmar('correo',correo),ipHash=await firmar('ip',request.headers.get('cf-connecting-ip')||'sin-ip');
        const codigoHash=await firmar('codigo',id+'|'+codigo);
        await db.batch([
          sentencia('DELETE FROM cuenta_desafios WHERE creado<?',ahora-86400000),
          sentencia(`INSERT INTO cuenta_desafios(id,entorno,correo,nombre,correo_hash,ip_hash,codigo_hash,creado,vence)
            SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM cuenta_desafios WHERE entorno=? AND correo_hash=? AND creado>?)
            AND (SELECT COUNT(*) FROM cuenta_desafios WHERE entorno=? AND correo_hash=? AND creado>?)<3
            AND (SELECT COUNT(*) FROM cuenta_desafios WHERE entorno=? AND ip_hash=? AND creado>?)<20`,
            id,entorno,correo,nombre||'Viajero',correoHash,ipHash,codigoHash,ahora,vence,entorno,correoHash,ahora-REENVIO_MS,entorno,correoHash,ahora-900000,entorno,ipHash,ahora-3600000),
          sentencia('UPDATE cuenta_desafios SET consumido=? WHERE entorno=? AND correo_hash=? AND id<>? AND consumido IS NULL AND EXISTS(SELECT 1 FROM cuenta_desafios WHERE id=?)','reemplazado',entorno,correoHash,id,id)
        ]);
        if(!await primera('SELECT id FROM cuenta_desafios WHERE id=?',id))throw fallo('ESPERA',429);
        try{await enviarCodigo({correo,nombre:nombre||'Viajero',codigo,vence},env);}
        catch{await sentencia('UPDATE cuenta_desafios SET consumido=? WHERE id=?','no-entregado',id).run();throw fallo('NO_DISPONIBLE',503);}
        await sentencia('UPDATE cuenta_desafios SET entregado=1 WHERE id=? AND consumido IS NULL',id).run();
        return json({id,vence,reenvioEn:ahora+REENVIO_MS});
      }
      if(ruta==='verificar'){
        claves(datos,['solicitud','codigo']);
        if(typeof datos.solicitud!=='string'||!/^[a-f0-9-]{36}$/i.test(datos.solicitud)||typeof datos.codigo!=='string'||!/^\d{6}$/.test(datos.codigo))throw fallo('CODIGO_INVALIDO');
        const codigoHash=await firmar('codigo',datos.solicitud+'|'+datos.codigo),consumo=crypto.randomUUID();
        const token=aleatorio(),hash=await firmar('sesion',token),usuario=crypto.randomUUID();
        await db.batch([
          sentencia('UPDATE cuenta_desafios SET intentos=intentos+1 WHERE id=? AND entorno=? AND consumido IS NULL AND entregado=1 AND vence>? AND intentos<5 AND codigo_hash<>?',datos.solicitud,entorno,ahora,codigoHash),
          sentencia('UPDATE cuenta_desafios SET consumido=? WHERE id=? AND entorno=? AND consumido IS NULL AND entregado=1 AND vence>? AND intentos<5 AND codigo_hash=?',consumo,datos.solicitud,entorno,ahora,codigoHash),
          sentencia('INSERT OR IGNORE INTO cuenta_usuarios(id,entorno,correo,nombre,creado) SELECT ?,entorno,correo,nombre,? FROM cuenta_desafios WHERE id=? AND consumido=?',usuario,ahora,datos.solicitud,consumo),
          sentencia('INSERT OR IGNORE INTO cuenta_progreso(usuario,entorno,actualizado) SELECT u.id,u.entorno,? FROM cuenta_usuarios u JOIN cuenta_desafios d ON d.correo=u.correo AND d.entorno=u.entorno WHERE d.id=? AND d.consumido=?',ahora,datos.solicitud,consumo),
          sentencia('INSERT INTO cuenta_sesiones(hash,usuario,entorno,creado,vence) SELECT ?,u.id,u.entorno,?,? FROM cuenta_usuarios u JOIN cuenta_desafios d ON d.correo=u.correo AND d.entorno=u.entorno WHERE d.id=? AND d.consumido=?',hash,ahora,ahora+SESION_MS,datos.solicitud,consumo),
          sentencia('DELETE FROM cuenta_sesiones WHERE vence<=?',ahora)
        ]);
        const sesion=await primera('SELECT usuario FROM cuenta_sesiones WHERE hash=? AND entorno=?',hash,entorno);
        if(!sesion){
          const d=await primera('SELECT vence,intentos,consumido FROM cuenta_desafios WHERE id=? AND entorno=?',datos.solicitud,entorno);
          if(d?.intentos>=5)throw fallo('INTENTOS',429);
          if(d&&d.vence<=ahora)throw fallo('CADUCADO');
          throw fallo('CODIGO_INVALIDO');
        }
        return json(await perfil(sesion.usuario),200,{'Set-Cookie':cookie(token,SESION_MS/1000)});
      }
      const sesion=await autenticar();
      // Otra pestaña puede cambiar la cookie mientras ésta conserva una cola
      // del jugador anterior. La cabecera sólo ata esa intención a su sesión:
      // jamás concede acceso por sí sola ni sustituye autenticar().
      if(request.headers.get('x-caoz-cuenta')!==sesion.usuario)throw fallo('SESION',401);
      if(ruta==='salir'){
        claves(datos,[]);
        await sentencia('DELETE FROM cuenta_sesiones WHERE hash=? AND entorno=?',sesion.hash,entorno).run();
        return json({ok:true},200,{'Set-Cookie':cookie('',0)});
      }
      claves(datos,['operacion','revision','progreso','respaldoLocal','origen']);
      if(typeof datos.operacion!=='string'||!/^[a-f0-9-]{36}$/i.test(datos.operacion)||!Number.isSafeInteger(datos.revision)||datos.revision<0||!['local','nube'].includes(datos.origen))throw fallo('DATOS');
      validarProgreso(datos.progreso,entorno);validarProgreso(datos.respaldoLocal,entorno);
      const {operacion,revision,origen}=datos,usuario=sesion.usuario;
      const solicitudHash=await firmar('operacion',canonico(datos));
      const actual=await primera('SELECT progreso,revision FROM cuenta_progreso WHERE usuario=? AND entorno=?',usuario,entorno);
      const seleccionado=origen==='nube'?actual.progreso:datos.progreso===null?null:JSON.stringify(datos.progreso);
      const local=datos.respaldoLocal===null?null:JSON.stringify(datos.respaldoLocal);
      const condicion='usuario=? AND entorno=? AND revision=? AND NOT EXISTS(SELECT 1 FROM cuenta_operaciones WHERE usuario=? AND entorno=? AND operacion=?)';
      const args=[usuario,entorno,revision,usuario,entorno,operacion];
      await db.batch([
        sentencia(`INSERT OR IGNORE INTO cuenta_respaldos(usuario,entorno,operacion,nube,local,creado) SELECT usuario,entorno,?,progreso,?,? FROM cuenta_progreso WHERE ${condicion}`,operacion,local,ahora,...args),
        sentencia(`UPDATE cuenta_progreso SET progreso=?,revision=revision+1,actualizado=?,operacion=? WHERE ${condicion}`,seleccionado,ahora,operacion,...args),
        sentencia('INSERT OR IGNORE INTO cuenta_operaciones(usuario,entorno,operacion,solicitud_hash,revision,creado) SELECT usuario,entorno,?,?,revision,? FROM cuenta_progreso WHERE usuario=? AND entorno=? AND operacion=? AND revision=?',operacion,solicitudHash,ahora,usuario,entorno,operacion,revision+1),
        sentencia('DELETE FROM cuenta_respaldos WHERE usuario=? AND entorno=? AND operacion NOT IN(SELECT operacion FROM cuenta_respaldos WHERE usuario=? AND entorno=? ORDER BY creado DESC,rowid DESC LIMIT 10)',usuario,entorno,usuario,entorno),
        sentencia('DELETE FROM cuenta_operaciones WHERE usuario=? AND entorno=? AND operacion NOT IN(SELECT operacion FROM cuenta_operaciones WHERE usuario=? AND entorno=? ORDER BY creado DESC,rowid DESC LIMIT 256)',usuario,entorno,usuario,entorno)
      ]);
      const recibo=await primera('SELECT solicitud_hash,revision FROM cuenta_operaciones WHERE usuario=? AND entorno=? AND operacion=?',usuario,entorno,operacion);
      if(recibo&&recibo.solicitud_hash!==solicitudHash)throw fallo('OPERACION',409);
      const nuevo=await primera('SELECT progreso,revision FROM cuenta_progreso WHERE usuario=? AND entorno=?',usuario,entorno);
      // Los recibos no duplican un snapshot en cada autoguardado. Un acuse perdido
      // devuelve el vigente; si otro dispositivo ya avanzó, pedimos resolverlo.
      // Incluso un recibo antiguo ya depurado no puede saltarse la revisión CAS.
      if(recibo&&recibo.revision===nuevo.revision)return json({progreso:copia(nuevo.progreso),revision:nuevo.revision});
      throw fallo('CONFLICTO',409,{progreso:copia(nuevo.progreso),revision:nuevo.revision});
    }catch(e){
      if(e?.codigo)return json({codigo:e.codigo,...e.datos},e.status||400,e.status===429?{'Retry-After':'60'}:{});
      // Errores de D1/proveedor no exponen consultas, correos, claves ni progreso ajeno.
      return json({codigo:'NO_DISPONIBLE'},503);
    }
  };
}
export const manejarCuenta=crearManejadorCuenta();
