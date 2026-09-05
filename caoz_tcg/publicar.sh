#!/bin/bash
# ============================================================================
#  PUBLICAR EL TCG DEL DOMO
# ----------------------------------------------------------------------------
#  Corre las pruebas y SÓLO publica si están todas en verde. Ése es el punto:
#  hasta ahora publicar era copiar el archivo a mano, así que un fallo llegaba
#  a la web y se descubría jugando.
#
#  Uso:
#    ./publicar.sh                 pruebas rápidas (~15 s) y publica
#    ./publicar.sh --completo      añade los 5 tutoriales (~5 min) y publica
#    ./publicar.sh --solo-pruebas  sólo comprueba, no toca la web
#    ./publicar.sh --beta          publica en /tcg-beta/ para probarlo en el
#                                  móvil sin tocar la versión que usa la gente
#
#  No necesita instalar nada: usa el Chrome que ya tienes y un servidor de
#  Python de un solo uso (servidor_pruebas.py).
# ============================================================================
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$AQUI/.." && pwd)"
PAGES="$HOME/Documents/AppW40k-pages"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DESTINO="tcg"
SUITES="1&rapido=1"
PUBLICAR=1

for arg in "$@"; do
  case "$arg" in
    --completo)     SUITES="1" ;;
    --solo-pruebas) PUBLICAR=0 ;;
    --beta)         DESTINO="tcg-beta" ;;
    *) echo "opción desconocida: $arg"; exit 2 ;;
  esac
done

rojo(){ printf '\033[31m%s\033[0m\n' "$*"; }
verde(){ printf '\033[32m%s\033[0m\n' "$*"; }
gris(){ printf '\033[90m%s\033[0m\n' "$*"; }
paso(){ printf '\n\033[1m-> %s\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
paso "1/4 · Comprobaciones baratas"
# Lo que se puede saber sin arrancar un navegador se comprueba antes, para
# fallar en un segundo en vez de en cinco minutos.

node --check <(python3 -c "
s=open('$AQUI/index.html').read(); i=s.rindex('<script>')+8; j=s.rindex('</script>'); print(s[i:j])") \
  || { rojo 'index.html tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/tests.js" || { rojo 'tests.js tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/motor.js" || { rojo 'motor.js tiene un error de sintaxis'; exit 1; }
# El motor no puede tocar la pantalla: si lo hace, la versión móvil hereda el fallo.
if grep -qE 'document\.|\$\(|innerHTML|\.classList' "$AQUI/motor.js"; then
  rojo 'motor.js toca el DOM (document/$()/innerHTML/classList): eso va en la pantalla'; exit 1
fi
# La pantalla del teléfono: mismo motor, misma build, y su script tiene que
# compilar igual que el de escritorio.
python3 -c "import sys; s=open(sys.argv[1]).read(); i=s.rindex('<script>')+8; j=s.rindex('</script>'); print(s[i:j])" "$AQUI/movil.html" > /tmp/movil_ui.js
node --check /tmp/movil_ui.js || { rojo 'movil.html tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/final.js" || { rojo 'final.js tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/sw.js" || { rojo 'sw.js tiene un error de sintaxis'; exit 1; }
# El service worker lleva la build en VERSION: es lo que le dice al teléfono
# que hay una caché nueva. Sin subirlo, la app instalada se quedaría con la vieja.
SW_V="$(grep -o '^const VERSION = [0-9]*' "$AQUI/sw.js" | grep -o '[0-9]*$')"
# La cinemática del final la comparten las dos pantallas y va con la misma build
for H in index.html movil.html; do
  F_SRC="$(grep -o 'final.js?b=[0-9]*' "$AQUI/$H" | grep -o '[0-9]*$')"
  [ "$F_SRC" = "$(grep -o 'motor.js?b=[0-9]*' "$AQUI/$H" | grep -o '[0-9]*$')" ] || { rojo "$H carga final.js?b=$F_SRC y motor.js con otra build"; exit 1; }
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
if grep -qE '\.finished\s*\.then|await\s[^;]{0,60}\.finished\b' "$AQUI/index.html" "$AQUI/motor.js" "$AQUI/movil.html" "$AQUI/final.js"; then
  rojo 'index.html usa Animation.finished — encadena con sleep(), o el motor se cuelga'
  exit 1
fi
gris "  sin Animation.finished"

# El número de build tiene que corresponderse con el historial: si no, la
# versión publicada dice una cosa y el commit del que salió es otro, y las notas
# dejan de servir para nada.
BUILD_EN_JUEGO="$(grep -o 'const BUILD = {n:[0-9]*' "$AQUI/index.html" | grep -o '[0-9]*$')"
BUILD_ESPERADO=$(( $(cd "$REPO" && git rev-list --count HEAD -- caoz_tcg/) ))
if [ "$BUILD_EN_JUEGO" != "$BUILD_ESPERADO" ]; then
  rojo "El build del juego dice $BUILD_EN_JUEGO y el historial va por $BUILD_ESPERADO."
  rojo "Actualiza 'const BUILD = {n:...}' en index.html antes de publicar."
  exit 1
fi
gris "  build $BUILD_EN_JUEGO al día"

if [ -n "$(cd "$REPO" && git status --porcelain -- caoz_tcg/)" ]; then
  rojo 'Tienes cambios del TCG sin guardar en git. Haz commit antes de publicar,'
  rojo 'o lo que suba a la web no coincidirá con ninguna versión guardada.'
  (cd "$REPO" && git status --short -- caoz_tcg/)
  exit 1
fi
gris "  todo commiteado ($(cd "$REPO" && git rev-parse --short HEAD) en $(cd "$REPO" && git branch --show-current))"

# ---------------------------------------------------------------------------
paso "2/4 · Pruebas en Chrome sin ventana"
[ -x "$CHROME" ] || { rojo "No encuentro Chrome en $CHROME"; exit 1; }

PUERTO=8749
while lsof -i ":$PUERTO" >/dev/null 2>&1; do PUERTO=$((PUERTO+1)); done

RESULTADO_JSON="$(mktemp)"; rm -f "$RESULTADO_JSON"
python3 "$AQUI/servidor_pruebas.py" "$PUERTO" "$RESULTADO_JSON" >/dev/null 2>&1 &
SERVIDOR=$!
disown "$SERVIDOR" 2>/dev/null   # para que bash no anuncie su muerte al final
PERFIL="$(mktemp -d)"
NAVEGADOR=""
limpiar(){ kill "$SERVIDOR" 2>/dev/null; [ -n "$NAVEGADOR" ] && kill "$NAVEGADOR" 2>/dev/null; rm -rf "$PERFIL" 2>/dev/null; true; }
trap limpiar EXIT
sleep 1

if [ "$SUITES" = "1" ]; then
  gris "  corriendo TODO, incluidos los tutoriales (~5 min)"; ESPERA=600
else
  # 300 y no 180 (ni 120): las regresiones solas tardan ~110 s, y con el
  # ordenador ocupado —el escritorio remoto, el navegador del panel— se
  # pasaban del límite tres veces seguidas en una tarde. Daba un rojo que no
  # era del juego sino del reloj; como la página avisa al terminar, el margen
  # sobrante no se espera nunca.
  gris "  corriendo las rápidas (motor, cartas, cobertura, regresiones)"; ESPERA=300
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
"$CHROME" --headless --disable-gpu --no-sandbox --user-data-dir="$PERFIL" \
  --no-first-run --disable-extensions --window-size=1600,1000 \
  --disable-background-timer-throttling --disable-renderer-backgrounding \
  --disable-backgrounding-occluded-windows --disable-features=CalculateNativeWinOcclusion \
  "http://127.0.0.1:$PUERTO/?test=$SUITES" >/dev/null 2>&1 &
NAVEGADOR=$!
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

paso "3/4 · Publicando en /$DESTINO/"
[ -d "$PAGES" ] || { rojo "No encuentro el worktree de publicación en $PAGES"; exit 1; }
RAMA="$(cd "$PAGES" && git branch --show-current)"
[ "$RAMA" = "gh-pages" ] || { rojo "$PAGES está en '$RAMA', debería estar en gh-pages"; exit 1; }

mkdir -p "$PAGES/$DESTINO"
cp "$AQUI/index.html"   "$PAGES/$DESTINO/index.html"
cp "$AQUI/motor.js"     "$PAGES/$DESTINO/motor.js"
cp "$AQUI/movil.html"   "$PAGES/$DESTINO/movil.html"
cp "$AQUI/final.js"     "$PAGES/$DESTINO/final.js"
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
git add "$DESTINO/index.html" "$DESTINO/motor.js" "$DESTINO/movil.html" "$DESTINO/final.js" "$DESTINO/sw.js" "$DESTINO/manifest.webmanifest" "$DESTINO"/art/icono-*.png "$DESTINO/tests.js" "$DESTINO/estudio.html"
[ -d "$AQUI/art" ] && git add "$DESTINO/art" 

if git diff --cached --quiet; then
  gris "  no hay cambios que publicar"
  exit 0
fi

VERSION="$(cd "$REPO" && git rev-parse --short HEAD)"
git commit -q -m "Publica el TCG ($VERSION) en /$DESTINO/

Pruebas en verde antes de subir.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -q origin gh-pages
gris "  subido: $(git rev-parse --short HEAD)"

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
comprobar_cloudflare(){
  gris "  esperando a Cloudflare Pages ($CF_URL, también caoz-tcg.pages.dev)"
  for j in $(seq 1 12); do
    sleep 10
    local ok=1
    for f in index.html motor.js movil.html final.js sw.js manifest.webmanifest; do
      local esp; esp="$(shasum -a 256 "$AQUI/$f" | cut -d" " -f1)"
      local srv; srv="$(curl -sL "$CF_URL/$f?cb=$(date +%s)" | shasum -a 256 | cut -d" " -f1)"
      [ "$srv" = "$esp" ] || { ok=0; break; }
    done
    if [ "$ok" = "1" ]; then
      verde "  publicado y verificado byte a byte en Cloudflare: $CF_URL/"
      gris "  si en tu navegador sigues viendo lo de antes, es su caché: recarga forzada"
      return 0
    fi
    gris "  intento $j: Cloudflare aún sirve otra versión"
  done
  rojo "GitHub ya lo sirve, pero Cloudflare aún no. Mira el despliegue en dash.cloudflare.com → Workers & Pages → caoz-tcg"
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
    comprobar_cloudflare
    exit $?
  fi
  gris "  intento $i: $CODIGO$([ "$CODIGO" = "200" ] && echo " (aún sirve otra versión)")"
done
rojo "Se subió, pero la web aún no lo sirve. GitHub Pages tarda a veces; revisa $URL"
exit 1
