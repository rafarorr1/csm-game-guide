#!/bin/bash
# Captura el tablero para poder revisar el aspecto sin estar delante.
#   ./foto.sh salida.png "mohamed,adreida" "brickbrock:0,trol:1"
cd "$(dirname "$0")" || exit 1
OUT="${1:-/tmp/mesa.png}"; LID="${2:-mohamed,adreida}"; MESA="${3:-}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=8899
python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &
SRV=$!
sleep 1
URL="http://127.0.0.1:$PORT/index.html?foto=$LID"
[ -n "$MESA" ] && URL="$URL&mesa=$MESA"
[ -n "$4" ] && URL="$URL&hover=$4"
"$CHROME" --headless --disable-gpu --hide-scrollbars \
  --window-size=${W:-1600},$(( ${H:-1000} + 87 )) --virtual-time-budget=7000 \
  --screenshot="$OUT" "$URL" >/dev/null 2>&1
kill $SRV 2>/dev/null
[ -f "$OUT" ] && echo "foto: $OUT" || echo "no salió la foto"
