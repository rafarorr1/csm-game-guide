#!/usr/bin/env python3
"""Imprime el resultado de las pruebas y devuelve 0 si todo está en verde.

Lo usa publicar.sh para decidir si puede publicar. Va en un archivo aparte, y
no incrustado en el script, porque un heredoc de Python dentro de un heredoc de
bash es una fuente de errores tontos.

    python3 leer_resultado.py <resultado.json>
"""
import sys, json

try:
    res = json.load(open(sys.argv[1]))
except Exception as e:
    print('  No pude leer el resultado de las pruebas:', e)
    sys.exit(1)

for s in res.get('suites', []):
    print(('  OK   ' if s['bien'] else '  MAL  ') + s['nombre'] + f" ({s['seg']}s)")
    for n in s.get('notas', []):
        print('         ·', n)
    if s.get('error'):
        print('         ->', s['error'])

sys.exit(0 if res.get('mal', 1) == 0 else 1)
