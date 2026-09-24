#!/bin/bash
# ============================================================================
#  PUBLICAR EL TCG DEL DOMO
# ----------------------------------------------------------------------------
#  Corre las pruebas y SÓLO publica si están todas en verde. Ése es el punto:
#  hasta ahora publicar era copiar el archivo a mano, así que un fallo llegaba
#  a la web y se descubría jugando.
#
#  Uso:
#    ./publicar.sh --beta          desde develop: beta y preview Cloudflare
#    ./publicar.sh --produccion    desde main: producción web y móvil
#    ./publicar.sh --solo-pruebas  comprueba cualquier rama, no toca la web
#    Añade --visible para ver Chrome o --completo para los cinco tutoriales.
#    Publicar siempre exige elegir el destino; omitirlo no publica nada.
#
#  No necesita instalar nada: usa el Chrome que ya tienes y un servidor de
#  Python de un solo uso (servidor_pruebas.py).
# ============================================================================
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$AQUI/.." && pwd)"
PAGES="${CAOZ_PAGES_DIR:-$HOME/Documents/AppW40k-pages}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DESTINO=""
SUITES="1&rapido=1"
PUBLICAR=1
MODO_NAVEGADOR=(--headless --disable-gpu)

for arg in "$@"; do
  case "$arg" in
    --completo)     SUITES="1" ;;
    --solo-pruebas) PUBLICAR=0 ;;
    --beta|--produccion)
      NUEVO_DESTINO="tcg"
      [ "$arg" = "--beta" ] && NUEVO_DESTINO="tcg-beta"
      if [ -n "$DESTINO" ] && [ "$DESTINO" != "$NUEVO_DESTINO" ]; then
        echo 'Elige sólo un destino: --beta o --produccion.'; exit 2
      fi
      DESTINO="$NUEVO_DESTINO"
      ;;
    --visible)      MODO_NAVEGADOR=(--new-window) ;;
    *) echo "opción desconocida: $arg"; exit 2 ;;
  esac
done
if [ "$PUBLICAR" -eq 1 ] && [ -z "$DESTINO" ]; then
  echo 'Indica --beta (develop), --produccion (main) o --solo-pruebas.'; exit 2
fi

rojo(){ printf '\033[31m%s\033[0m\n' "$*"; }
verde(){ printf '\033[32m%s\033[0m\n' "$*"; }
gris(){ printf '\033[90m%s\033[0m\n' "$*"; }
paso(){ printf '\n\033[1m-> %s\033[0m\n' "$*"; }

# Las guardas se repiten después de Chrome: no se puede cambiar de rama,
# commit ni archivos mientras se valida y terminar publicando otra versión.
comprobar_fuente_publicacion(){
  [ "$PUBLICAR" -eq 0 ] && return 0
  local esperada="main" actual revision
  [ "$DESTINO" = "tcg-beta" ] && esperada="develop"
  actual="$(git -C "$REPO" branch --show-current)" || return 1
  if [ "$actual" != "$esperada" ]; then
    rojo "Sólo se publica /$DESTINO/ desde '$esperada'; estás en '${actual:-HEAD separado}'."
    return 1
  fi
  revision="$(git -C "$REPO" rev-parse HEAD)" || return 1
  if [ -n "${REVISION_VALIDADA:-}" ] && [ "$revision" != "$REVISION_VALIDADA" ]; then
    rojo 'El commit cambió durante las pruebas. Vuelve a validar antes de publicar.'
    return 1
  fi
  if [ -n "$(git -C "$REPO" status --porcelain -- caoz_tcg/)" ]; then
    rojo 'Hay cambios del TCG sin guardar en git. Haz commit antes de publicar.'
    git -C "$REPO" status --short -- caoz_tcg/
    return 1
  fi
  REVISION_VALIDADA="$revision"
}

# El juego queda detrás del Portal sólo en el dominio de Producción. La primera
# vez que se publica todavía no hay una página desde la que crear una cookie:
# se preautoriza una clave efímera, pero la sesión se abre sólo cuando
# Cloudflare ya sirve el Portal nuevo. Nunca se copia una clave ni una cookie
# al paquete, se imprime, ni se manda a git.
PORTAL_COOKIE_JAR=""
PORTAL_COOKIE_TEMPORAL=0
PORTAL_CLAVE_VERIFICACION=""
validar_jar_portal(){
  local archivo="$1" permisos="" ultimos=""
  if [ -z "$archivo" ] || [ ! -f "$archivo" ] || [ ! -r "$archivo" ]; then
    rojo 'El archivo temporal de sesión del Portal no existe o no se puede leer.'
    return 1
  fi
  # curl guarda cookies HttpOnly como #HttpOnly_dominio; no se muestra nunca
  # el contenido, sólo se confirma que corresponde al host y cookie correctos.
  if ! grep -Eq '^(#HttpOnly_)?juego[.]caozcontodo[.]com[[:space:]].*__Host-caoz-portal[[:space:]]' "$archivo" 2>/dev/null; then
    rojo 'La sesión temporal no corresponde al Portal de Producción.'
    return 1
  fi
  permisos="$(stat -f '%Lp' "$archivo" 2>/dev/null || stat -c '%a' "$archivo" 2>/dev/null || true)"
  case "$permisos" in
    *[!0-7]*|'')
      rojo 'No se pudieron comprobar los permisos del archivo temporal de sesión.'
      return 1
      ;;
    *)
      ultimos="${permisos#${permisos%??}}"
      if [ "$ultimos" != "00" ]; then
        rojo 'El archivo temporal de sesión no puede ser legible por grupo ni por otros usuarios.'
        return 1
      fi
      ;;
  esac
}
preparar_sesion_verificacion_portal(){
  [ "$PUBLICAR" -eq 1 ] && [ "$DESTINO" = "tcg" ] || return 0
  local archivo="${CAOZ_PORTAL_COOKIE_JAR:-}"
  if [ -n "$archivo" ]; then
    validar_jar_portal "$archivo" || return 1
    PORTAL_COOKIE_JAR="$archivo"
    export CAOZ_PORTAL_COOKIE_JAR="$archivo"
    return 0
  fi
  if [ -z "${CAOZ_PORTAL_CLAVE_VERIFICACION:-}" ]; then
    rojo 'Producción requiere CAOZ_PORTAL_CLAVE_VERIFICACION para abrir una sesión temporal de verificación.'
    rojo 'También acepta CAOZ_PORTAL_COOKIE_JAR con una sesión temporal ya iniciada.'
    return 1
  fi
  # No se deja la clave exportada mientras corren Chrome y las pruebas. Sólo
  # se entrega a Node en el instante de convertirla a JSON para el POST.
  PORTAL_CLAVE_VERIFICACION="$CAOZ_PORTAL_CLAVE_VERIFICACION"
  unset CAOZ_PORTAL_CLAVE_VERIFICACION
}
comprobar_fuente_publicacion || exit 1
preparar_sesion_verificacion_portal || exit 1

# ---------------------------------------------------------------------------
paso "1/4 · Comprobaciones baratas"
# Lo que se puede saber sin arrancar un navegador se comprueba antes, para
# fallar en un segundo en vez de en cinco minutos.

node --check <(python3 -c "
s=open('$AQUI/index.html').read(); i=s.rindex('<script>')+8; j=s.rindex('</script>'); print(s[i:j])") \
  || { rojo 'index.html tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/tests.js" || { rojo 'tests.js tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/motor.js" || { rojo 'motor.js tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/mulligan-ui.js" || { rojo 'mulligan-ui.js tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/invitaciones-compartidas.js" || { rojo 'invitaciones-compartidas.js tiene un error de sintaxis'; exit 1; }
# El motor no puede tocar la pantalla: si lo hace, la versión móvil hereda el fallo.
if grep -qE 'document\.|\$\(|innerHTML|\.classList' "$AQUI/motor.js"; then
  rojo 'motor.js toca el DOM (document/$()/innerHTML/classList): eso va en la pantalla'; exit 1
fi
# La pantalla del teléfono: mismo motor, misma build, y su script tiene que
# compilar igual que el de escritorio.
python3 -c "import sys; s=open(sys.argv[1]).read(); i=s.rindex('<script>')+8; j=s.rindex('</script>'); print(s[i:j])" "$AQUI/movil.html" > /tmp/movil_ui.js
node --check /tmp/movil_ui.js || { rojo 'movil.html tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/final.js" || { rojo 'final.js tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/final-core.js" || exit 1
node --check "$AQUI/campana-mesa.js" || exit 1
node --check "$AQUI/campana-personaje.js" || exit 1
node --check "$AQUI/campana-deseo.js" || exit 1
node --check "$AQUI/campana-pitagoras.js" || exit 1
node --check "$AQUI/campana-secreto.js" || exit 1
node --check "$AQUI/campana-honores.js" || exit 1
node --check "$AQUI/pitagoras-pruebas.js" || exit 1
node --check "$AQUI/pitagoras-mundos.js" || exit 1
node --check "$AQUI/pitagoras-cine.js" || exit 1
node --check "$AQUI/pitagoras-laboratorio.js" || exit 1
node --check "$AQUI/pitagoras-fps.js" || exit 1
node --check "$AQUI/pitagoras-pixel.js" || exit 1
node --check "$AQUI/pitagoras-combate.js" || exit 1
node --check "$AQUI/pitagoras-mesa.js" || exit 1
node --check "$AQUI/dado-fisico.js" || exit 1
node --check "$AQUI/moneda-fisica.js" || exit 1
node --check "$AQUI/polish-aaa.js" || exit 1
node --check "$AQUI/audio-domo.js" || exit 1
node --check "$AQUI/sonidos.js" || exit 1
node --check "$AQUI/estudio.js" || exit 1
node --check "$AQUI/estudio-publicacion.js" || exit 1
node --check "$AQUI/portal.js" || exit 1
node --check "$AQUI/arte-vistas.js" || exit 1
node --check "$AQUI/estudio-vista.js" || exit 1
node --check "$AQUI/arte-remoto.js" || exit 1
node --check "$AQUI/nombres-cartas.js" || exit 1
node "$AQUI/generar_catalogo_arte.mjs" --comprobar || exit 1
node --check "$AQUI/_worker.js" || exit 1
for f in cuenta-modelo.js cuenta-progreso.js cuenta-servicio.js cuenta-ui.js cuenta-acceso.js cuenta-juego.js cuenta-servidor.js cuenta-correo.js; do node --check "$AQUI/$f" || exit 1; done
node "$REPO/dev/cuentas/pruebas_servidor.mjs" --sabotaje || exit 1
node "$REPO/dev/cuentas/pruebas_cache.mjs" || exit 1
node "$REPO/dev/secciones/pruebas_cuenta_modelo.mjs" || exit 1
node "$REPO/dev/secciones/pruebas_cuenta_acceso.mjs" --sabotaje || exit 1
node "$REPO/dev/secciones/pruebas_cuenta_entradas.mjs" --sabotaje || exit 1
node "$AQUI/pruebas_cuenta_correo.mjs" || exit 1
node "$AQUI/pruebas_cuenta_progreso.mjs" || exit 1
node "$AQUI/pruebas_cuenta_servicio.mjs" || exit 1
python3 "$AQUI/verificar_sonidos.py" || exit 1
node "$AQUI/pruebas_sonidos.mjs" || exit 1
node "$AQUI/pruebas_arte.mjs" || exit 1
node "$AQUI/pruebas_arte_ediciones.mjs" || exit 1
node "$AQUI/pruebas_originales_acabados.mjs" || exit 1
node "$AQUI/pruebas_estudio.mjs" || exit 1
node "$AQUI/pruebas_portal.mjs" || exit 1
python3 "$AQUI/pruebas_fisico.py" || exit 1
node "$AQUI/pruebas_coleccion.mjs" || exit 1
node "$AQUI/pruebas_recompensas_domo.mjs" || exit 1
node "$REPO/dev/secciones/pruebas_sobres_apertura.mjs" --sabotaje || exit 1
for f in coleccion-modelo.js coleccion-juego.js coleccion-ui.js sobres-escena.js sobres-apertura.js sobres-revelacion.js fx-aliento.js carta-pintor.js carta-diseno.js carta-juego.js visor-3d-gl.js visor-3d.js; do node --check "$AQUI/$f" || exit 1; done
node --check "$AQUI/sw.js" || { rojo 'sw.js tiene un error de sintaxis'; exit 1; }
# El service worker lleva la build en VERSION: es lo que le dice al teléfono
# que hay una caché nueva. Sin subirlo, la app instalada se quedaría con la vieja.
SW_V="$(grep -o '^const VERSION = [0-9]*' "$AQUI/sw.js" | grep -o '[0-9]*$')"
# La cinemática del final la comparten las dos pantallas y va con la misma build
for H in index.html movil.html; do
  F_SRC="$(grep -o 'final.js?b=[0-9]*' "$AQUI/$H" | grep -o '[0-9]*$')"
  [ "$F_SRC" = "$(grep -o 'motor.js?b=[0-9]*' "$AQUI/$H" | grep -o '[0-9]*$')" ] || { rojo "$H carga final.js?b=$F_SRC y motor.js con otra build"; exit 1; }
  MULLIGAN_SRC="$(grep -o 'mulligan-ui.js?b=[0-9]*' "$AQUI/$H" | grep -o '[0-9]*$')"
  MULLIGAN_CSS="$(grep -o 'mulligan-ui.css?b=[0-9]*' "$AQUI/$H" | grep -o '[0-9]*$')"
  [ "$MULLIGAN_SRC" = "$F_SRC" ] && [ "$MULLIGAN_CSS" = "$F_SRC" ] || { rojo "$H carga el selector de mulligan con otra build"; exit 1; }
done
B_MOVIL="$(grep -o 'const BUILD = {n:[0-9]*' "$AQUI/movil.html" | grep -o '[0-9]*$')"
B_MOVIL_SRC="$(grep -o 'motor.js?b=[0-9]*' "$AQUI/movil.html" | grep -o '[0-9]*$')"
# index.html carga motor.js?b=<build>: si no coincide con BUILD, un navegador con el
# motor viejo en caché jugaría con reglas de una versión y pantalla de otra.
B_SRC="$(grep -o 'motor.js?b=[0-9]*' "$AQUI/index.html" | grep -o '[0-9]*$')"
B_NUM="$(grep -o 'const BUILD = {n:[0-9]*' "$AQUI/index.html" | grep -o '[0-9]*$')"
[ "$B_SRC" = "$B_NUM" ] || { rojo "index.html carga motor.js?b=$B_SRC pero BUILD es $B_NUM: actualiza los dos"; exit 1; }
[ "$B_MOVIL" = "$B_NUM" ] && [ "$B_MOVIL_SRC" = "$B_NUM" ] || { rojo "movil.html va en build $B_MOVIL (motor ?b=$B_MOVIL_SRC) y index.html en $B_NUM: actualiza los tres"; exit 1; }
[ "$SW_V" = "$B_NUM" ] || { rojo "sw.js lleva VERSION = $SW_V y BUILD es $B_NUM: súbelo también"; exit 1; }
gris "  sintaxis correcta"

# Animation.finished cuelga el motor: puede no resolverse nunca aunque la
# animación termine. Es una regla dura y se comprueba también aquí.
if grep -qE '\.finished\s*\.then|await\s[^;]{0,60}\.finished\b' "$AQUI/index.html" "$AQUI/motor.js" "$AQUI/movil.html" "$AQUI/final.js" "$AQUI/invitaciones-compartidas.js" "$AQUI/final-core.js" "$AQUI/campana-mesa.js" "$AQUI/campana-personaje.js" "$AQUI/campana-deseo.js" "$AQUI/campana-pitagoras.js" "$AQUI/campana-secreto.js" "$AQUI/campana-honores.js" "$AQUI/pitagoras-pruebas.js" "$AQUI/pitagoras-mundos.js" "$AQUI/pitagoras-cine.js" "$AQUI/pitagoras-laboratorio.js" "$AQUI/pitagoras-fps.js" "$AQUI/pitagoras-pixel.js" "$AQUI/pitagoras-combate.js" "$AQUI/pitagoras-mesa.js" "$AQUI/dado-fisico.js" "$AQUI/moneda-fisica.js" "$AQUI/polish-aaa.js" "$AQUI/mulligan-ui.js" "$AQUI/coleccion-modelo.js" "$AQUI/coleccion-juego.js" "$AQUI/coleccion-ui.js" "$AQUI/sobres-escena.js" "$AQUI/sobres-apertura.js"; then
  rojo 'index.html usa Animation.finished — encadena con sleep(), o el motor se cuelga'
  exit 1
fi
gris "  sin Animation.finished"

# BUILD identifica una versión publicada, no el número de commits. Documentar
# o fusionar ramas no cambia los bytes del juego y no exige otra build.
# Las cuatro referencias siguen sincronizadas; antes de copiar se compara
# también con el destino para impedir retrocesos o reutilizar una build distinta.
case "$B_NUM" in
  ''|*[!0-9]*) rojo 'BUILD debe ser un entero positivo'; exit 1 ;;
esac
[ "$B_NUM" -gt 0 ] || { rojo 'BUILD debe ser un entero positivo'; exit 1; }
gris "  build $B_NUM sincronizada en escritorio, móvil y caché"
if [ "$PUBLICAR" -eq 0 ]; then
  gris '  sólo validación: se permiten cambios locales y cualquier rama'
else
  gris "  commit validado: $REVISION_VALIDADA"
fi
python3 "$AQUI/pruebas_publicacion.py" || { rojo 'Fallaron las guardas de publicación'; exit 1; }

# ---------------------------------------------------------------------------
paso "2/4 · Pruebas en Chrome"
[ -x "$CHROME" ] || { rojo "No encuentro Chrome en $CHROME"; exit 1; }

PUERTO=8749
while lsof -i ":$PUERTO" >/dev/null 2>&1; do PUERTO=$((PUERTO+1)); done

RESULTADO_JSON="$(mktemp)"; rm -f "$RESULTADO_JSON"
python3 "$AQUI/servidor_pruebas.py" "$PUERTO" "$RESULTADO_JSON" >/dev/null 2>&1 &
SERVIDOR=$!
disown "$SERVIDOR" 2>/dev/null   # para que bash no anuncie su muerte al final
PERFIL="$(mktemp -d)"
NAVEGADOR=""
limpiar_sesion_verificacion_portal(){
  # Sólo eliminamos el jar que creó este proceso; una sesión externa sigue
  # siendo responsabilidad de quien la proporcionó.
  if [ "$PORTAL_COOKIE_TEMPORAL" = "1" ] && [ -n "$PORTAL_COOKIE_JAR" ]; then
    rm -f -- "$PORTAL_COOKIE_JAR" 2>/dev/null
  fi
  PORTAL_COOKIE_JAR=""
  PORTAL_COOKIE_TEMPORAL=0
  PORTAL_CLAVE_VERIFICACION=""
  unset CAOZ_PORTAL_COOKIE_JAR CAOZ_PORTAL_CLAVE_VERIFICACION
}
limpiar(){ limpiar_sesion_verificacion_portal; kill "$SERVIDOR" 2>/dev/null; [ -n "$NAVEGADOR" ] && kill "$NAVEGADOR" 2>/dev/null; rm -rf "$PERFIL" 2>/dev/null; true; }
trap limpiar EXIT
sleep 1

if [ "$SUITES" = "1" ]; then
  # La tanda rápida puede ocupar cinco minutos en un equipo cargado y los seis
  # tutoriales otros cuatro y medio. Se deja margen para ambas sin recortar
  # cobertura; la página avisa por POST y termina antes en una máquina libre.
  gris "  corriendo TODO, incluidos los tutoriales (hasta 15 min)"; ESPERA=900
else
  # 300 y no 180 (ni 120): las regresiones solas tardan ~110 s, y con el
  # ordenador ocupado —el escritorio remoto, el navegador del panel— se
  # pasaban del límite tres veces seguidas en una tarde. Daba un rojo que no
  # era del juego sino del reloj; como la página avisa al terminar, el margen
  # sobrante no se espera nunca.
  # D20 físico y final secreto añaden simulación y recorridos reales. La tanda
  # anterior ya rozaba 300 s; el margen no se espera si llega el resultado.
  gris "  corriendo las rápidas (motor, cartas, cobertura, regresiones)"; ESPERA=420
fi

# Sin --virtual-time-budget a propósito: hacía que Chrome esperase a agotar el
# presupuesto en vez de a que las pruebas acabaran, y una tanda de diez segundos
# tardaba varios minutos. Ahora la página avisa por POST /resultado cuando
# termina, así que esto tarda exactamente lo que tarden las pruebas.
# Sin estrangular: con el ordenador cargado, Chrome sin ventana trataba la
# página como si estuviera en segundo plano —temporizadores a cámara lenta,
# document.hidden a ratos— y los efectos no llegaban a dibujarse: una tanda
# de 62 s con un rojo de «no salió el número verde», o ninguna respuesta.
# En la pestaña visible la misma tanda estaba en verde.
"$CHROME" "${MODO_NAVEGADOR[@]}" --no-sandbox --user-data-dir="$PERFIL" --remote-debugging-port=0 \
  --no-first-run --disable-extensions --window-size=1600,1000 \
  --disable-background-timer-throttling --disable-renderer-backgrounding \
  --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion \
  "http://127.0.0.1:$PUERTO/?test=$SUITES" >/dev/null 2>&1 &
NAVEGADOR=$!
# Puerto de depuración local y efímero: permite revisar la prueba activa si no termina.
gris "  perfil de diagnóstico: $PERFIL"
disown "$NAVEGADOR" 2>/dev/null

for _ in $(seq 1 "$ESPERA"); do
  [ -f "$RESULTADO_JSON" ] && break
  sleep 1
done
kill "$NAVEGADOR" 2>/dev/null; NAVEGADOR=""

if [ ! -f "$RESULTADO_JSON" ]; then
  rojo "Las pruebas no terminaron en ${ESPERA}s. Míralas a mano con: index.html?test=$SUITES"
  exit 1
fi

python3 "$AQUI/leer_resultado.py" "$RESULTADO_JSON"
RESULTADO=$?
rm -f "$RESULTADO_JSON"

if [ "$RESULTADO" -ne 0 ]; then
  echo; rojo "PRUEBAS EN ROJO — no se publica nada."
  rojo "Míralas con detalle abriendo:  index.html?test=1"
  exit 1
fi
verde "  todas en verde"

# ---------------------------------------------------------------------------
if [ "$PUBLICAR" -eq 0 ]; then
  paso "Listo (--solo-pruebas: no se ha tocado la web)"
  exit 0
fi

comprobar_fuente_publicacion || exit 1

paso "3/4 · Publicando en /$DESTINO/"
[ -d "$PAGES" ] || { rojo "No encuentro el worktree de publicación en $PAGES"; exit 1; }
RAMA="$(cd "$PAGES" && git branch --show-current)"
[ "$RAMA" = "gh-pages" ] || { rojo "$PAGES está en '$RAMA', debería estar en gh-pages"; exit 1; }

[ -z "$(cd "$PAGES" && git status --porcelain)" ] || { rojo 'El worktree de publicación tiene cambios pendientes'; exit 1; }
# Un commit local pendiente podría incluir cambios del otro destino. No se
# arrastra al publicar ni se compara una build contra una copia desactualizada.
REVISION_PAGES_REMOTA="$(git -C "$PAGES" ls-remote --exit-code origin refs/heads/gh-pages)" \
  || { rojo 'No se pudo comprobar gh-pages en origin; no se publica'; exit 1; }
[ "$(git -C "$PAGES" rev-parse HEAD)" = "${REVISION_PAGES_REMOTA%%[[:space:]]*}" ] \
  || { rojo 'gh-pages local no coincide con origin/gh-pages. Sincroniza y revisa ambos destinos antes de publicar.'; exit 1; }
# No modifica el worktree: cualquier versión inválida se rechaza antes de copiar.
python3 "$AQUI/verificar_release.py" "$AQUI" "$PAGES/$DESTINO" || exit 1
mkdir -p "$PAGES/$DESTINO/art" "$PAGES/$DESTINO/audio" "$PAGES/$DESTINO/fisico" "$PAGES/$DESTINO/fuentes"
for f in audio-domo.js sonidos.html sonidos.js sonidos.css estudio.js estudio.css estudio-publicacion.js estudio-publicacion.css arte-vistas.js estudio-vista.js arte-remoto.js nombres-cartas.js acabados.css mulligan-ui.js mulligan-ui.css invitaciones-compartidas.js coleccion.css coleccion-modelo.js coleccion-juego.js coleccion-ui.js sobres-escena.js sobres-apertura.js sobres-revelacion.js fx-aliento.js sobres-apertura.css carta-pintor.js carta-diseno.js carta-juego.js visor-3d-gl.js visor-3d.js carta-diseno.css carta-juego.css tema-domo.css visor-3d.css fuentes/cinzel.woff2 fuentes/cormorant-garamond.woff2 fuentes/cormorant-garamond-italica.woff2 fuentes/OFL-Cinzel.txt fuentes/OFL-CormorantGaramond.txt cuenta-modelo.js cuenta-progreso.js cuenta-servicio.js cuenta-ui.js cuenta-acceso.js cuenta-juego.js cuenta.css cuenta-juego.css cuenta-servidor.js cuenta-correo.js _worker.js _routes.json portal.html portal.css portal.js fisico/index.html fisico/fisico.css fisico/Caoz-PnP-Duelo-del-Pergamino.zip; do cp "$AQUI/$f" "$PAGES/$DESTINO/$f" || exit 1; done
cp "$AQUI"/audio/*.wav "$AQUI/audio/catalogo.json" "$PAGES/$DESTINO/audio/" || exit 1
cp "$AQUI/index.html"   "$PAGES/$DESTINO/index.html"
cp "$AQUI/motor.js"     "$PAGES/$DESTINO/motor.js"
cp "$AQUI/movil.html"   "$PAGES/$DESTINO/movil.html"
cp "$AQUI/final.js"     "$PAGES/$DESTINO/final.js"
cp "$AQUI/final-core.js" "$PAGES/$DESTINO/final-core.js"
cp "$AQUI/campana-mesa.js" "$PAGES/$DESTINO/campana-mesa.js"
cp "$AQUI/campana-personaje.js" "$PAGES/$DESTINO/campana-personaje.js"
cp "$AQUI/campana-deseo.js" "$PAGES/$DESTINO/campana-deseo.js"
cp "$AQUI/campana-pitagoras.js" "$PAGES/$DESTINO/campana-pitagoras.js"
cp "$AQUI/campana-secreto.js" "$PAGES/$DESTINO/campana-secreto.js"
cp "$AQUI/campana-honores.js" "$PAGES/$DESTINO/campana-honores.js"
cp "$AQUI/pitagoras-pruebas.js" "$PAGES/$DESTINO/pitagoras-pruebas.js"
cp "$AQUI/pitagoras-mundos.js" "$PAGES/$DESTINO/pitagoras-mundos.js"
cp "$AQUI/pitagoras-cine.js" "$PAGES/$DESTINO/pitagoras-cine.js"
cp "$AQUI/pitagoras-laboratorio.js" "$PAGES/$DESTINO/pitagoras-laboratorio.js"
cp "$AQUI/pitagoras-fps.js" "$PAGES/$DESTINO/pitagoras-fps.js"
cp "$AQUI/pitagoras-pixel.js" "$PAGES/$DESTINO/pitagoras-pixel.js"
cp "$AQUI/pitagoras-combate.js" "$PAGES/$DESTINO/pitagoras-combate.js"
cp "$AQUI/pitagoras-mesa.js" "$PAGES/$DESTINO/pitagoras-mesa.js"
cp "$AQUI/dado-fisico.js" "$PAGES/$DESTINO/dado-fisico.js"
cp "$AQUI/moneda-fisica.js" "$PAGES/$DESTINO/moneda-fisica.js"
cp "$AQUI/polish-aaa.js" "$PAGES/$DESTINO/polish-aaa.js"
cp "$AQUI/sw.js"        "$PAGES/$DESTINO/sw.js"
cp "$AQUI/manifest.webmanifest" "$PAGES/$DESTINO/manifest.webmanifest"
cp "$AQUI"/art/icono-*.png "$PAGES/$DESTINO/art/"
cp "$AQUI/tests.js"     "$PAGES/$DESTINO/tests.js"
# El editor viaja con el juego: se entra desde el menú, así que una publicación
# tiene que mandar los dos o el botón lleva a una página que no existe.
cp "$AQUI/estudio.html" "$PAGES/$DESTINO/estudio.html"

# Las ilustraciones, si las hay. La carpeta la prepara estudio.html y es
# opcional: sin ella el juego se publica igual, con los emojis.
if [ -d "$AQUI/art" ]; then
  mkdir -p "$PAGES/$DESTINO/art"
  cp "$AQUI/art/"* "$PAGES/$DESTINO/art/" 2>/dev/null
  # Y se retiran las que ya no están. Esto sólo copiaba: al quitar una
  # ilustración, su archivo se quedaba publicado para siempre. No se veía en el
  # juego —el índice ya no la nombra— pero ahí seguía.
  RETIRADAS=0
  for f in "$PAGES/$DESTINO/art/"*.webp; do
    [ -e "$f" ] || continue
    if [ ! -e "$AQUI/art/$(basename "$f")" ]; then
      (cd "$PAGES" && git rm -q --ignore-unmatch "$DESTINO/art/$(basename "$f")")
      rm -f "$f"
      RETIRADAS=$((RETIRADAS+1))
    fi
  done
  gris "  $(ls -1 "$AQUI/art" | grep -c '\.webp$') ilustraciones incluidas$(
    [ "$RETIRADAS" -gt 0 ] && echo ", $RETIRADAS retirada(s)")"
fi

cd "$PAGES" || exit 1
# OJO: sólo estos dos archivos, nunca `git add -A`. En esta misma rama vive la
# PWA de Warhammer y un add general se llevaría por delante lo que no toca.
git add "$DESTINO/index.html" "$DESTINO/motor.js" "$DESTINO/movil.html" "$DESTINO/final.js" "$DESTINO/invitaciones-compartidas.js" "$DESTINO/final-core.js" "$DESTINO/campana-mesa.js" "$DESTINO/campana-personaje.js" "$DESTINO/campana-deseo.js" "$DESTINO/campana-pitagoras.js" "$DESTINO/campana-secreto.js" "$DESTINO/campana-honores.js" "$DESTINO/pitagoras-pruebas.js" "$DESTINO/pitagoras-mundos.js" "$DESTINO/pitagoras-cine.js" "$DESTINO/pitagoras-laboratorio.js" "$DESTINO/pitagoras-fps.js" "$DESTINO/pitagoras-pixel.js" "$DESTINO/pitagoras-combate.js" "$DESTINO/pitagoras-mesa.js" "$DESTINO/dado-fisico.js" "$DESTINO/moneda-fisica.js" "$DESTINO/polish-aaa.js" "$DESTINO/mulligan-ui.js" "$DESTINO/mulligan-ui.css" "$DESTINO/sw.js" "$DESTINO/manifest.webmanifest" "$DESTINO"/art/icono-*.png "$DESTINO/tests.js" "$DESTINO/estudio.html"
git add "$DESTINO/arte-vistas.js" "$DESTINO/estudio-vista.js" "$DESTINO/estudio.js" "$DESTINO/estudio.css" "$DESTINO/estudio-publicacion.js" "$DESTINO/estudio-publicacion.css" "$DESTINO/arte-remoto.js" "$DESTINO/nombres-cartas.js" "$DESTINO/acabados.css" "$DESTINO/coleccion.css" "$DESTINO/coleccion-modelo.js" "$DESTINO/coleccion-juego.js" "$DESTINO/coleccion-ui.js" "$DESTINO/sobres-escena.js" "$DESTINO/sobres-apertura.js" "$DESTINO/sobres-revelacion.js" "$DESTINO/fx-aliento.js" "$DESTINO/sobres-apertura.css" "$DESTINO/carta-pintor.js" "$DESTINO/carta-diseno.js" "$DESTINO/carta-juego.js" "$DESTINO/visor-3d-gl.js" "$DESTINO/visor-3d.js" "$DESTINO/carta-diseno.css" "$DESTINO/carta-juego.css" "$DESTINO/tema-domo.css" "$DESTINO/visor-3d.css" "$DESTINO/fuentes"
git add "$DESTINO/cuenta-modelo.js" "$DESTINO/cuenta-progreso.js" "$DESTINO/cuenta-servicio.js" "$DESTINO/cuenta-ui.js" "$DESTINO/cuenta-acceso.js" "$DESTINO/cuenta-juego.js" "$DESTINO/cuenta.css" "$DESTINO/cuenta-juego.css" "$DESTINO/cuenta-servidor.js" "$DESTINO/cuenta-correo.js"
git add "$DESTINO/audio-domo.js" "$DESTINO/sonidos.html" "$DESTINO/sonidos.js" "$DESTINO/sonidos.css" "$DESTINO/_worker.js" "$DESTINO/_routes.json" "$DESTINO/audio"
git add "$DESTINO/portal.html" "$DESTINO/portal.css" "$DESTINO/portal.js"
[ -d "$AQUI/fisico" ] && git add "$DESTINO/fisico"
[ -d "$AQUI/art" ] && git add "$DESTINO/art" 

if git diff --cached --quiet; then
  gris "  no hay cambios que publicar"
else
VERSION="$(cd "$REPO" && git rev-parse --short HEAD)"
git commit -q -m "Publica el TCG ($VERSION) en /$DESTINO/

Pruebas en verde antes de subir.

Co-Authored-By: Codex <noreply@openai.com>" || exit 1
git push -q origin gh-pages || exit 1
gris "  subido: $(git rev-parse --short HEAD)"
fi

# ---------------------------------------------------------------------------
# CLOUDFLARE PAGES — la dirección que se reparte.
# La operadora móvil de Rafa (y de media audiencia) no enruta *.github.io en
# 5G, así que el juego se sirve también desde Cloudflare Pages: el proyecto
# caoz-tcg está conectado a la rama gh-pages de este mismo repo y publica la
# carpeta tcg solo, sin que aquí haya que hacer nada más que esperarlo y
# comprobar que sirve los mismos bytes. GitHub Pages queda de espejo.
# La dirección oficial es el subdominio de Rafa (CNAME en GoDaddy hacia
# caoz-tcg.pages.dev); pages.dev sigue respondiendo con lo mismo.
CF_URL="https://juego.caozcontodo.com"
curl_portal(){
  # PORTAL_COOKIE_JAR siempre es una ruta, no el valor de la cookie. Evita que
  # una sesión de verificación termine en el historial, la salida o el paquete.
  curl -fsSL --max-time 25 --cookie "$PORTAL_COOKIE_JAR" "$@"
}
cabecera_portal(){
  curl -sS --max-time 25 -D - -o /dev/null "$@"
}
crear_sesion_verificacion_portal(){
  # Se llama sólo DESPUÉS de que el Portal nuevo ya contestó. Así la primera
  # publicación puede verificarse sin desplegar antes una versión a medias.
  [ "$DESTINO" = "tcg" ] || return 0
  if [ -n "$PORTAL_COOKIE_JAR" ]; then
    validar_jar_portal "$PORTAL_COOKIE_JAR" || return 1
    export CAOZ_PORTAL_COOKIE_JAR="$PORTAL_COOKIE_JAR"
    return 0
  fi
  if [ -z "$PORTAL_CLAVE_VERIFICACION" ]; then
    rojo 'No hay una clave efímera para abrir la sesión de verificación del Portal.'
    return 1
  fi
  local jar respuesta
  jar="$(mktemp "${TMPDIR:-/tmp}/caoz-portal-verificacion.XXXXXXXX")" || return 1
  chmod 600 "$jar" || { rm -f -- "$jar"; return 1; }
  # La clave viaja por stdin y se convierte a JSON dentro de la tubería: nunca
  # aparece en argumentos, salida, archivos del proyecto ni historial de git.
  respuesta="$(printf '%s' "$PORTAL_CLAVE_VERIFICACION" | python3 -c 'import json,sys; print(json.dumps({"clave":sys.stdin.read()},separators=(",",":")))' | curl -fsS --max-time 25 --cookie-jar "$jar" -H 'Content-Type: application/json' -H 'Accept: application/json' -H "Origin: $CF_URL" --data-binary @- "$CF_URL/api/portal/sesion")" || {
    # La clave sigue sólo en esta shell (no exportada) para que un despliegue
    # que aún se propaga pueda reintentar la misma sesión temporal.
    rm -f -- "$jar"; return 1;
  }
  if [ "$respuesta" != '{"ok":true}' ]; then
    rm -f -- "$jar"; return 1
  fi
  if ! validar_jar_portal "$jar"; then
    rm -f -- "$jar"; return 1
  fi
  PORTAL_COOKIE_JAR="$jar"
  PORTAL_COOKIE_TEMPORAL=1
  PORTAL_CLAVE_VERIFICACION=""
  export CAOZ_PORTAL_COOKIE_JAR="$jar"
}
comprobar_redireccion_privada(){
  local ruta="$1" marca="$2" cabeceras
  cabeceras="$(cabecera_portal "$CF_URL$ruta?cb=$marca")" || return 1
  printf '%s\n' "$cabeceras" | grep -Eq '^HTTP/[0-9.]+ 302' || return 1
  printf '%s\n' "$cabeceras" | grep -Eqi '^location: https://juego[.]caozcontodo[.]com/[?]siguiente=%2Fproduccion%2F' || return 1
}
comprobar_portal_publico(){
  local marca="$1" f remoto esp srv cabeceras estado
  # La entrada es pública para que el formulario pueda abrirse, pero debe ser
  # exactamente el Portal, con CSP, y no una copia residual del juego antiguo.
  for f in portal.html portal.css portal.js; do
    remoto="$f"
    # Cloudflare Pages responde con 308 a portal.html; /portal es el documento
    # canónico que la raíz del Worker debe servir sin una redirección circular.
    [ "$f" = 'portal.html' ] && remoto='portal'
    esp="$(shasum -a 256 "$AQUI/$f" | cut -d" " -f1)"
    srv="$(curl -fsS --max-time 25 "$CF_URL/${remoto}?cb=$marca" | shasum -a 256 | cut -d" " -f1)" || return 1
    [ "$srv" = "$esp" ] || return 1
  done
  cabeceras="$(cabecera_portal "$CF_URL/?cb=$marca")" || return 1
  printf '%s\n' "$cabeceras" | grep -Eq '^HTTP/[0-9.]+ 200' || return 1
  printf '%s\n' "$cabeceras" | grep -Eqi '^content-security-policy:.*frame-ancestors' || return 1
  printf '%s\n' "$cabeceras" | grep -Eqi '^cache-control:.*no-store' || return 1
  estado="$(curl -fsS --max-time 25 -H 'Accept: application/json' "$CF_URL/api/portal/sesion?cb=$marca")" || return 1
  [ "$estado" = '{"autenticado":false}' ] || return 1
  comprobar_redireccion_privada '/index.html' "$marca" || return 1
  comprobar_redireccion_privada '/produccion/index.html' "$marca" || return 1
  # El antiguo PWA de raíz no puede conservar una ruta abierta al juego: el
  # worker de retiro se desregistra antes de que un cliente vuelva a cargar.
  curl -fsS --max-time 25 "$CF_URL/sw.js?cb=$marca" | grep -Fq 'self.registration.unregister' || return 1
}
comprobar_sesion_portal(){
  local marca="$1" estado
  estado="$(curl_portal -H 'Accept: application/json' "$CF_URL/api/portal/sesion?cb=$marca")" || return 1
  [ "$estado" = '{"autenticado":true}' ]
}
comprobar_cloudflare(){
  gris "  esperando a Cloudflare Pages ($CF_URL, también caoz-tcg.pages.dev)"
  for j in $(seq 1 12); do
    sleep 10
    local ok=1 prefijo="" marca="$(date +%s)"
    if [ "$DESTINO" = "tcg" ]; then
      if comprobar_portal_publico "$marca"; then
        crear_sesion_verificacion_portal || { ok=0; }
        [ "$ok" = "1" ] && comprobar_sesion_portal "$marca" || ok=0
      else
        ok=0
      fi
      prefijo="/produccion"
    fi
    # El HTML privado redirige al estudio único de producción. Sus dependencias
    # públicas se verifican aquí y en verificar_arte_web.py; el HTML crudo sólo
    # se compara en GitHub Pages, que no aplica esa redirección.
    for f in index.html motor.js movil.html final.js invitaciones-compartidas.js final-core.js campana-mesa.js campana-personaje.js campana-deseo.js campana-pitagoras.js campana-secreto.js campana-honores.js pitagoras-pruebas.js pitagoras-mundos.js pitagoras-cine.js pitagoras-laboratorio.js pitagoras-fps.js pitagoras-pixel.js pitagoras-combate.js pitagoras-mesa.js dado-fisico.js moneda-fisica.js polish-aaa.js mulligan-ui.js mulligan-ui.css arte-remoto.js arte-vistas.js nombres-cartas.js estudio.js coleccion.css coleccion-modelo.js coleccion-juego.js coleccion-ui.js sobres-escena.js sobres-apertura.js sobres-revelacion.js fx-aliento.js sobres-apertura.css carta-pintor.js carta-diseno.js carta-juego.js visor-3d-gl.js visor-3d.js carta-diseno.css carta-juego.css tema-domo.css visor-3d.css fuentes/cinzel.woff2 fuentes/cormorant-garamond.woff2 fuentes/cormorant-garamond-italica.woff2 cuenta-modelo.js cuenta-progreso.js cuenta-servicio.js cuenta-ui.js cuenta-acceso.js cuenta-juego.js cuenta.css cuenta-juego.css cuenta-servidor.js cuenta-correo.js sw.js manifest.webmanifest art/pitagoras-abismo-v216.webp art/esbirro-editor-v219.webp art/moneda-cara-v245.webp art/moneda-cruz-v245.webp; do
      local esp; esp="$(shasum -a 256 "$AQUI/$f" | cut -d" " -f1)"
      local srv
      if [ "$DESTINO" = "tcg" ]; then
        srv="$(curl_portal "$CF_URL$prefijo/$f?cb=$marca" | shasum -a 256 | cut -d" " -f1)" || { ok=0; break; }
      else
        srv="$(curl -sL "$CF_URL/$f?cb=$marca" | shasum -a 256 | cut -d" " -f1)"
      fi
      [ "$srv" = "$esp" ] || { ok=0; break; }
    done
    if [ "$ok" = "1" ]; then
      local base_verificada="$CF_URL$prefijo"
      python3 "$AQUI/verificar_audio_web.py" "$base_verificada" || return 1
      python3 "$AQUI/verificar_arte_web.py" "$base_verificada" || return 1
      if [ "$DESTINO" = "tcg" ]; then
        verde "  Portal público, sesión y juego protegido verificados byte a byte en Cloudflare: $CF_URL/"
      else
        verde "  publicado y verificado byte a byte en Cloudflare: $CF_URL/"
      fi
      gris "  si en tu navegador sigues viendo lo de antes, es su caché: recarga forzada"
      return 0
    fi
    gris "  intento $j: Cloudflare aún sirve otra versión"
  done
  rojo "GitHub ya lo sirve, pero $CF_URL aún no. Mira el despliegue en dash.cloudflare.com → Workers & Pages → caoz-tcg"
  return 1
}

# ---------------------------------------------------------------------------
paso "4/4 · Comprobando que está en la web"
URL="https://rafarorr1.github.io/csm-game-guide/$DESTINO/index.html"
ESPERADO="$(shasum -a 256 "$AQUI/index.html" | cut -d" " -f1)"
# El motor va aparte desde v15: si la web sirviera el index nuevo con el motor
# viejo, la partida arrancaría con reglas de otra versión. Se comprueban los dos.
URL_MOTOR="https://rafarorr1.github.io/csm-game-guide/$DESTINO/motor.js"
ESPERADO_MOTOR="$(shasum -a 256 "$AQUI/motor.js" | cut -d" " -f1)"
URL_MOVIL="https://rafarorr1.github.io/csm-game-guide/$DESTINO/movil.html"
ESPERADO_MOVIL="$(shasum -a 256 "$AQUI/movil.html" | cut -d" " -f1)"
URL_FINAL="https://rafarorr1.github.io/csm-game-guide/$DESTINO/final.js"
ESPERADO_FINAL="$(shasum -a 256 "$AQUI/final.js" | cut -d" " -f1)"
# Se compara el archivo entero, no una palabra suelta. Antes esto buscaba
# "TUT_MAZO", que ya estaba en la versión anterior: daba por publicado un
# despliegue que aún servía el código viejo.
for i in $(seq 1 10); do
  sleep 12
  CODIGO="$(curl -s -o /tmp/publicado.html -w "%{http_code}" "$URL?cb=$(date +%s)")"
  SERVIDO="$(shasum -a 256 /tmp/publicado.html | cut -d" " -f1)"
  CODIGO_MOTOR="$(curl -s -o /tmp/publicado_motor.js -w "%{http_code}" "$URL_MOTOR?cb=$(date +%s)")"
  SERVIDO_MOTOR="$(shasum -a 256 /tmp/publicado_motor.js | cut -d" " -f1)"
  SERVIDO_MOVIL="$(curl -s "$URL_MOVIL?cb=$(date +%s)" | shasum -a 256 | cut -d" " -f1)"
  SERVIDO_FINAL="$(curl -s "$URL_FINAL?cb=$(date +%s)" | shasum -a 256 | cut -d" " -f1)"
  if [ "$CODIGO" = "200" ] && [ "$SERVIDO" = "$ESPERADO" ] && [ "$CODIGO_MOTOR" = "200" ] && [ "$SERVIDO_MOTOR" = "$ESPERADO_MOTOR" ] && [ "$SERVIDO_MOVIL" = "$ESPERADO_MOVIL" ] && [ "$SERVIDO_FINAL" = "$ESPERADO_FINAL" ]; then
    verde "  GitHub Pages verificado byte a byte (index.html, motor.js, movil.html y final.js)"
    for f in invitaciones-compartidas.js final-core.js campana-mesa.js campana-personaje.js campana-deseo.js campana-pitagoras.js campana-secreto.js campana-honores.js pitagoras-pruebas.js pitagoras-mundos.js pitagoras-cine.js pitagoras-laboratorio.js pitagoras-fps.js pitagoras-pixel.js pitagoras-combate.js pitagoras-mesa.js dado-fisico.js moneda-fisica.js polish-aaa.js mulligan-ui.js mulligan-ui.css arte-remoto.js arte-vistas.js nombres-cartas.js estudio.js estudio.html coleccion.css coleccion-modelo.js coleccion-juego.js coleccion-ui.js sobres-escena.js sobres-apertura.js sobres-revelacion.js fx-aliento.js sobres-apertura.css carta-pintor.js carta-diseno.js carta-juego.js visor-3d-gl.js visor-3d.js carta-diseno.css carta-juego.css tema-domo.css visor-3d.css fuentes/cinzel.woff2 fuentes/cormorant-garamond.woff2 fuentes/cormorant-garamond-italica.woff2 cuenta-modelo.js cuenta-progreso.js cuenta-servicio.js cuenta-ui.js cuenta-acceso.js cuenta-juego.js cuenta.css cuenta-juego.css cuenta-servidor.js cuenta-correo.js sw.js manifest.webmanifest portal.html portal.css portal.js fisico/index.html fisico/fisico.css fisico/Caoz-PnP-Duelo-del-Pergamino.zip art/pitagoras-abismo-v216.webp art/esbirro-editor-v219.webp art/moneda-cara-v245.webp art/moneda-cruz-v245.webp; do
      curl -fsSL "https://rafarorr1.github.io/csm-game-guide/$DESTINO/$f?cb=$(date +%s)" -o "/tmp/caoz-verificar-$(basename "$f")" || exit 1
      cmp -s "$AQUI/$f" "/tmp/caoz-verificar-$(basename "$f")" || { rojo "$f no coincide con la versión local"; exit 1; }
    done
    python3 "$AQUI/verificar_audio_web.py" "https://rafarorr1.github.io/csm-game-guide/$DESTINO" || exit 1
    python3 "$AQUI/verificar_arte_web.py" "https://rafarorr1.github.io/csm-game-guide/$DESTINO" || exit 1
    if [ "$DESTINO" = "tcg-beta" ]; then
      # Cloudflare sólo toma tcg como salida. La rama beta contiene exactamente
      # el árbol tcg-beta validado, bajo ese nombre, en un preview independiente.
      # No se cambia gh-pages/tcg ni se envía nada a main.
      python3 "$AQUI/beta_cloudflare.py" "$PAGES" || exit 1
      CF_URL="https://beta.caoz-tcg.pages.dev"
      comprobar_cloudflare || exit 1
      verde "Beta verificada para móvil: $CF_URL/movil.html?b=$B_NUM"
      exit 0
    fi
    comprobar_cloudflare
    exit $?
  fi
  gris "  intento $i: $CODIGO$([ "$CODIGO" = "200" ] && echo " (aún sirve otra versión)")"
done
rojo "Se subió, pero la web aún no lo sirve. GitHub Pages tarda a veces; revisa $URL"
exit 1
