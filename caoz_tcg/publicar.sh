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
s=open('$AQUI/index.html').read(); i=s.index('<script>')+8; j=s.rindex('</script>'); print(s[i:j])") \
  || { rojo 'index.html tiene un error de sintaxis'; exit 1; }
node --check "$AQUI/tests.js" || { rojo 'tests.js tiene un error de sintaxis'; exit 1; }
gris "  sintaxis correcta"

# Animation.finished cuelga el motor: puede no resolverse nunca aunque la
# animación termine. Es una regla dura y se comprueba también aquí.
if grep -qE '\.finished\s*\.then|await\s[^;]{0,60}\.finished\b' "$AQUI/index.html"; then
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
  gris "  corriendo las rápidas (motor, cartas, cobertura, regresiones)"; ESPERA=120
fi

# Sin --virtual-time-budget a propósito: hacía que Chrome esperase a agotar el
# presupuesto en vez de a que las pruebas acabaran, y una tanda de diez segundos
# tardaba varios minutos. Ahora la página avisa por POST /resultado cuando
# termina, así que esto tarda exactamente lo que tarden las pruebas.
"$CHROME" --headless --disable-gpu --no-sandbox --user-data-dir="$PERFIL" \
  --no-first-run --disable-extensions \
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
cp "$AQUI/index.html" "$PAGES/$DESTINO/index.html"
cp "$AQUI/tests.js"   "$PAGES/$DESTINO/tests.js"

# Las ilustraciones, si las hay. La carpeta la prepara estudio.html y es
# opcional: sin ella el juego se publica igual, con los emojis.
if [ -d "$AQUI/art" ]; then
  mkdir -p "$PAGES/$DESTINO/art"
  cp "$AQUI/art/"* "$PAGES/$DESTINO/art/" 2>/dev/null
  gris "  $(ls -1 "$AQUI/art" | grep -c '\.webp$') ilustraciones incluidas"
fi

cd "$PAGES" || exit 1
# OJO: sólo estos dos archivos, nunca `git add -A`. En esta misma rama vive la
# PWA de Warhammer y un add general se llevaría por delante lo que no toca.
git add "$DESTINO/index.html" "$DESTINO/tests.js"
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
paso "4/4 · Comprobando que está en la web"
URL="https://rafarorr1.github.io/csm-game-guide/$DESTINO/index.html"
ESPERADO="$(shasum -a 256 "$AQUI/index.html" | cut -d" " -f1)"
# Se compara el archivo entero, no una palabra suelta. Antes esto buscaba
# "TUT_MAZO", que ya estaba en la versión anterior: daba por publicado un
# despliegue que aún servía el código viejo.
for i in $(seq 1 10); do
  sleep 12
  CODIGO="$(curl -s -o /tmp/publicado.html -w "%{http_code}" "$URL?cb=$(date +%s)")"
  SERVIDO="$(shasum -a 256 /tmp/publicado.html | cut -d" " -f1)"
  if [ "$CODIGO" = "200" ] && [ "$SERVIDO" = "$ESPERADO" ]; then
    verde "  publicado y verificado byte a byte: https://rafarorr1.github.io/csm-game-guide/$DESTINO/"
    gris "  si en tu navegador sigues viendo lo de antes, es su caché: recarga forzada"
    exit 0
  fi
  gris "  intento $i: $CODIGO$([ "$CODIGO" = "200" ] && echo " (aún sirve otra versión)")"
done
rojo "Se subió, pero la web aún no lo sirve. GitHub Pages tarda a veces; revisa $URL"
exit 1
