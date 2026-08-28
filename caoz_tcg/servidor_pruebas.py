#!/usr/bin/env python3
"""Servidor de un solo uso para correr las pruebas sin ventana.

Sirve la carpeta del juego y, además, acepta POST /resultado: cuando las
pruebas terminan, tests.js manda el JSON aquí y esto lo escribe en disco.

Existe porque la alternativa —el volcado del DOM de Chrome con tiempo virtual—
era impredecible: el navegador esperaba a agotar el presupuesto en vez de a que
las pruebas acabaran, y una tanda de diez segundos tardaba minutos. Así el
script sabe exactamente cuándo ha terminado, y tarda lo que tarden las pruebas.

    python3 servidor_pruebas.py <puerto> <archivo-de-salida>
"""
import sys, os, json
from http.server import SimpleHTTPRequestHandler, HTTPServer

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8749
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'resultado.json'
RAIZ = os.path.dirname(os.path.abspath(__file__))


class Manejador(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=RAIZ, **kw)

    def do_POST(self):
        if self.path != '/resultado':
            self.send_error(404)
            return
        n = int(self.headers.get('Content-Length', 0))
        cuerpo = self.rfile.read(n).decode('utf-8', 'replace')
        try:
            json.loads(cuerpo)              # que sea JSON válido antes de guardarlo
            with open(SALIDA, 'w') as f:
                f.write(cuerpo)
        except Exception as e:
            print('resultado ilegible:', e, file=sys.stderr)
        self.send_response(204)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def log_message(self, *a):
        pass                                 # sin ruido: el script ya informa


if __name__ == '__main__':
    HTTPServer(('127.0.0.1', PUERTO), Manejador).serve_forever()
