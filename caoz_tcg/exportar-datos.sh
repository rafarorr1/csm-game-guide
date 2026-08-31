#!/bin/bash
# Saca las cartas, Líderes y mazos del juego a un JSON que puede leer cualquier
# motor. Es lo que hace portable el trabajo: los datos no dependen del navegador.
#   ./exportar-datos.sh [destino.json]
set -uo pipefail
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINO="${1:-$AQUI/../caoz_godot/datos/cartas.json}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

PUERTO=8800
while lsof -i ":$PUERTO" >/dev/null 2>&1; do PUERTO=$((PUERTO+1)); done
CRUDO="$(mktemp)"; rm -f "$CRUDO"
python3 "$AQUI/servidor_pruebas.py" "$PUERTO" "$CRUDO" >/dev/null 2>&1 &
SRV=$!; disown "$SRV" 2>/dev/null; sleep 1
PERFIL="$(mktemp -d)"
trap 'kill "$SRV" 2>/dev/null; rm -rf "$PERFIL" "$CRUDO" 2>/dev/null; true' EXIT

"$CHROME" --headless --disable-gpu --no-sandbox --user-data-dir="$PERFIL" --no-first-run \
  "http://127.0.0.1:$PUERTO/index.html?biblia=1" >/dev/null 2>&1 &
CH=$!; disown "$CH" 2>/dev/null
for i in $(seq 1 40); do [ -f "$CRUDO" ] && break; sleep 1; done
kill "$CH" 2>/dev/null
[ -f "$CRUDO" ] || { echo "el juego no soltó los datos"; exit 1; }

mkdir -p "$(dirname "$DESTINO")"
python3 - "$CRUDO" "$DESTINO" << 'PY'
import json, sys, os
d = json.load(open(sys.argv[1]))
salida = {
  'cartas': {k:{'n':v['n'],'tipo':v['t'],'coste':v['c'],'atq':v['a'],'pv':v['h'],
                'tribus':v['tr'],'rareza':v['r'],'sub':v['sub'],'texto':v['x'],
                'claves':v['keys'],'ficha':v['token']} for k,v in d['cartas'].items()},
  'lideres': {k:{'n':v['n'],'epiteto':v['ep'],'arte':v['art'],'arquetipo':v['arch'],
                 'pasiva':v['pasiva'],'habilidad':v['hab'],'coste_hab':v['habCost'],
                 'nombre_hab':v['habName']} for k,v in d['lideres'].items()},
  'mazos': {k:{'n':v['n'],'desc':v['d'],'lista':v['list']} for k,v in d['mazos'].items()},
  'colores': d['colores'],
}
json.dump(salida, open(sys.argv[2],'w'), ensure_ascii=False, indent=1)
print(f"{len(salida['cartas'])} cartas, {len(salida['lideres'])} Líderes, "
      f"{len(salida['mazos'])} mazos -> {sys.argv[2]} ({round(os.path.getsize(sys.argv[2])/1024)} KB)")
PY
