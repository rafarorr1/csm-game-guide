#!/bin/bash
# ============================================================================
#  PUBLICAR EL TCG DEL DOMO
# ----------------------------------------------------------------------------
#  Corre las pruebas y SÓLO publica si están todas en verde. Ése es el punto:
#  hasta ahora publicar era copiar el archivo a mano, así que un fallo llegaba
#  a la web y se descubría jugando.
#
#  Uso:
#    ./publicar.sh                 pruebas rápidas (~10 s) y publica
#    ./publicar.sh --completo      añade los 5 tutoriales (~5 min) y publica
#    ./publicar.sh --solo-pruebas  sólo comprueba, no toca la web
#    ./publicar.sh --beta          publica en /tcg-beta/ para probarlo en el
#                                  móvil sin tocar la versión que usa la gente
#
#  No necesita instalar nada: usa el Chrome que ya tienes y un servidor de
#  Python de un solo uso.
# ============================================================================
set -euo pipefail

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
paso(){ printf '\n\033[1m→ %s\033[0m\n' "$*"; }

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
  rojo 'index.html usa Animation.finished — encadena con sleep(), o el motor se cuelga'; exit 1
fi
gris "  sin Animation.finished"

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

python3 -m http.server "$PUERTO" --bind 127.0.0.1 --directory "$AQUI" >/dev/null 2>&1 &
SERVIDOR=$!
PERFIL="$(mktemp -d)"
VOLCADO="$(mktemp)"
limpiar(){ kill "$SERVIDOR" 2>/dev/null || true; rm -rf "$PERFIL" "$VOLCADO" 2>/dev/null || true; }
trap limpiar EXIT
sleep 1

[ "$SUITES" = "1" ] && gris "  corriendo TODO, incluidos los tutoriales (~5 min)" \
                    || gris "  corriendo las rápidas (motor, cartas, cobertura, regresiones)"

# El presupuesto de tiempo virtual deja que Chrome adelante los temporizadores;
# el vigilante lo mata si aun así se atasca, para no dejar procesos sueltos.
"$CHROME" --headless --disable-gpu --no-sandbox --user-data-dir="$PERFIL" \
  --virtual-time-budget=600000 \
  --dump-dom "http://127.0.0.1:$PUERTO/?test=$SUITES" 2>/dev/null > "$VOLCADO" &
NAVEGADOR=$!
( sleep 900; kill "$NAVEGADOR" 2>/dev/null ) & VIGILANTE=$!
wait "$NAVEGADOR" 2>/dev/null || true
kill "$VIGILANTE" 2>/dev/null || true

python3 - "$VOLCADO" << 'PY'
import re, sys, json
h = open(sys.argv[1]).read()
t = re.search(r'<title>([^<]*)</title>', h)
titulo = t.group(1) if t else '(sin título)'
m = re.search(r'id="pruebasMarca">(.*?)</pre>', h, re.S)
if not m:
    print('  NO TERMINARON — el navegador no dejó resultado.'); print('  título:', titulo)
    sys.exit(1)
res = json.loads(m.group(1).replace('&quot;','"').replace('&amp;','&').replace('&lt;','<').replace('&gt;','>'))
for s in res['suites']:
    print(('  ✅ ' if s['bien'] else '  ❌ ') + s['nombre'] + f" ({s['seg']}s)")
    for n in s.get('notas', []): print('       ·', n)
    if s.get('error'): print('       →', s['error'])
sys.exit(0 if res['mal'] == 0 else 1)
PY
RESULTADO=$?

if [ "$RESULTADO" -ne 0 ]; then
  echo; rojo "PRUEBAS EN ROJO — no se publica nada."
  rojo "Míralas con detalle abriendo:  index.html?test=1"
  exit 1
fi
verde "  todas en verde"

# ---------------------------------------------------------------------------
if [ "$PUBLICAR" -eq 0 ]; then
  paso "Listo (--solo-pruebas: no se ha tocado la web)"; exit 0
fi

paso "3/4 · Publicando en /$DESTINO/"
[ -d "$PAGES" ] || { rojo "No encuentro el worktree de publicación en $PAGES"; exit 1; }
RAMA="$(cd "$PAGES" && git branch --show-current)"
[ "$RAMA" = "gh-pages" ] || { rojo "$PAGES está en '$RAMA', debería estar en gh-pages"; exit 1; }

mkdir -p "$PAGES/$DESTINO"
cp "$AQUI/index.html" "$PAGES/$DESTINO/index.html"
cp "$AQUI/tests.js"   "$PAGES/$DESTINO/tests.js"

cd "$PAGES"
# OJO: sólo estos dos archivos, nunca `git add -A`. En esta misma rama vive la
# PWA de Warhammer y un add general se llevaría por delante lo que no toca.
git add "$DESTINO/index.html" "$DESTINO/tests.js"

if git diff --cached --quiet; then
  gris "  no hay cambios que publicar"; exit 0
fi

VERSION="$(cd "$REPO" && git rev-parse --short HEAD)"
git commit -q -m "Publica el TCG ($VERSION) en /$DESTINO/

Pruebas en verde antes de subir.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push -q origin gh-pages
gris "  subido: $(git rev-parse --short HEAD)"

# ---------------------------------------------------------------------------
paso "4/4 · Comprobando que está en la web"
URL="https://rafarorr1.github.io/csm-game-guide/$DESTINO/"
for i in $(seq 1 10); do
  sleep 12
  CODIGO="$(curl -s -o /tmp/publicado.html -w '%{http_code}' "$URL" || true)"
  if [ "$CODIGO" = "200" ] && grep -q "TUT_MAZO" /tmp/publicado.html; then
    verde "  publicado y verificado: $URL"; exit 0
  fi
  gris "  intento $i: $CODIGO"
done
rojo "Se subió, pero la web aún no lo sirve. GitHub Pages tarda a veces; revisa $URL"
exit 1
