#!/bin/bash
# Genera La Biblia del Domo en PDF, sacando los datos del propio juego.
# Uso:  ./biblia.sh [salida.pdf]
set -uo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SALIDA="${1:-$AQUI/La-Biblia-del-Domo.pdf}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

PUERTO=8790
while lsof -i ":$PUERTO" >/dev/null 2>&1; do PUERTO=$((PUERTO+1)); done
VOLCADO="$(mktemp)"; rm -f "$VOLCADO"
python3 "$AQUI/servidor_pruebas.py" "$PUERTO" "$VOLCADO" >/dev/null 2>&1 &
SRV=$!; disown "$SRV" 2>/dev/null; sleep 1
PERFIL="$(mktemp -d)"
limpiar(){ kill "$SRV" 2>/dev/null; rm -rf "$PERFIL" "$VOLCADO" 2>/dev/null; true; }
trap limpiar EXIT

echo "-> sacando los datos del juego"
"$CHROME" --headless --disable-gpu --no-sandbox --user-data-dir="$PERFIL" --no-first-run \
  "http://127.0.0.1:$PUERTO/index.html?biblia=1" >/dev/null 2>&1 &
CH=$!; disown "$CH" 2>/dev/null
for i in $(seq 1 40); do [ -f "$VOLCADO" ] && break; sleep 1; done
kill "$CH" 2>/dev/null
[ -f "$VOLCADO" ] || { echo "el juego no soltó los datos"; exit 1; }

echo "-> maquetando"
HTML="$(mktemp).html"
python3 "$AQUI/biblia.py" "$VOLCADO" "$HTML" || exit 1

echo "-> imprimiendo a PDF"
P2="$(mktemp -d)"
"$CHROME" --headless --disable-gpu --no-sandbox --user-data-dir="$P2" \
  --no-pdf-header-footer --print-to-pdf="$SALIDA" "$HTML" >/dev/null 2>&1 &
PID=$!
for i in $(seq 1 90); do kill -0 $PID 2>/dev/null || break; sleep 1; done
kill $PID 2>/dev/null; rm -rf "$P2" "$HTML"

python3 - "$SALIDA" << 'PY'
import sys
d = open(sys.argv[1],'rb').read()
assert d[:5] == b'%PDF-', 'no salió un PDF válido'
print(f"listo: {sys.argv[1]}")
print(f"  {d.count(b'/Type /Page') - d.count(b'/Type /Pages')} páginas · {round(len(d)/1024)} KB")
PY
