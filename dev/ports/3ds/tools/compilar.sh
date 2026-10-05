#!/usr/bin/env bash
# Exportación, simulación nativa, ARM11 y entrega usan las mismas fuentes.
set -euo pipefail
puerto_dir="$(cd "$(dirname "$0")/.." && pwd)"
repo_dir="$(cd "$puerto_dir/../../.." && pwd)"
sdk_local="$(cd "$repo_dir/.." && pwd)/herramientas/devkitpro"
if [[ -z "${DEVKITPRO:-}" ]]; then
  if [[ -x "$sdk_local/devkitARM/bin/arm-none-eabi-g++" ]]; then
    export DEVKITPRO="$sdk_local"
  else
    export DEVKITPRO=/opt/devkitpro
  fi
fi
export DEVKITARM="${DEVKITARM:-$DEVKITPRO/devkitARM}"
for herramienta in "$DEVKITARM/bin/arm-none-eabi-g++" "$DEVKITPRO/tools/bin/picasso" "$DEVKITPRO/tools/bin/3dsxtool" "$DEVKITPRO/tools/bin/smdhtool"; do
  if [[ ! -x "$herramienta" ]]; then
    printf 'Falta %s. Usa devkitPro 3ds-dev o el workflow arpg-3ds.\n' "$herramienta" >&2
    exit 1
  fi
done
cd "$repo_dir"
node dev/ports/3ds/tools/exportar.mjs
node dev/ports/3ds/tools/pruebas-recursos.mjs
mkdir -p "$puerto_dir/build"
"${CXX_HOST:-c++}" -std=c++17 -O2 -I"$puerto_dir/include" "$puerto_dir/source/juego.cpp" "$puerto_dir/tools/pruebas.cpp" -o "$puerto_dir/build/pruebas-host"
"$puerto_dir/build/pruebas-host"
make -C "$puerto_dir" -j"${JOBS_3DS:-2}"
python3 "$puerto_dir/tools/empaquetar.py" "$@"
