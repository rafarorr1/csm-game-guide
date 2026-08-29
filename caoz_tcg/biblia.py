#!/usr/bin/env python3
"""Genera la BIBLIA del TCG del Domo: un PDF con las reglas, los tipos de carta,
los Protagonistas y las 88 cartas.

Se alimenta de un volcado del propio juego (CARDS, LEADERS, DECKS, GUIAS y el
texto de reglas), no de una copia a mano: si mañana cambia una carta, la biblia
cambia con ella. El volcado lo manda index.html a servidor_pruebas.py.

    python3 biblia.py <volcado.json> <salida.html>

El PDF se saca luego con el Chrome instalado:
    chrome --headless --print-to-pdf=biblia.pdf --no-pdf-header-footer salida.html
"""
import json, sys, re, html
from collections import defaultdict

volcado, salida = sys.argv[1], sys.argv[2]
D = json.load(open(volcado))
CARTAS, LIDERES, MAZOS, GUIAS = D['cartas'], D['lideres'], D['mazos'], D['guias']
COLORES = D['colores']

TIPOS = [('personaje','Personajes','Los cuerpos que pelean por ti. Ocupan sitio en el campo.'),
         ('hechizo','Hechizos','Efecto inmediato y a las Alcantarillas. No ocupan campo.'),
         ('trampa','Trampas','Se ponen boca abajo y saltan solas cuando ocurre su condición.'),
         ('objeto','Objetos','Equipo y reliquias. Se quedan en juego dando su efecto.'),
         ('lugar','Lugares','Cambian las reglas del tablero mientras estén activos.')]

def esc(t): return html.escape(t or '')

def limpia(t):
    """El texto de las cartas trae <b> y algún <br>: se conservan y se limpia el resto."""
    t = (t or '').replace('<br>', ' ')
    return re.sub(r'<(?!/?b>)[^>]+>', '', t)

def habilidades(c):
    return re.findall(r'<b>([^<:]{2,26}):</b>', c.get('x') or '')

# ---------------------------------------------------------------- estadísticas
jugables = {k: v for k, v in CARTAS.items() if not v['token']}
fichas   = {k: v for k, v in CARTAS.items() if v['token']}
por_tipo = defaultdict(list)
for k, v in jugables.items():
    por_tipo[v['t']].append((k, v))
for t in por_tipo:
    por_tipo[t].sort(key=lambda kv: (kv[1]['c'], kv[1]['n']))

tribus = defaultdict(int)
for v in jugables.values():
    for tr in v['tr']:
        tribus[tr] += 1

en_mazos = defaultdict(list)      # id de carta -> [(lider, copias)]
for lid, m in MAZOS.items():
    for cid, n in m['list']:
        en_mazos[cid].append((LIDERES[lid]['n'], n))

# ------------------------------------------------------------------- plantilla
def ficha_carta(cid, c):
    stats = (f'<span class="atq">{c["a"]}</span><span class="pv">{c["h"]}</span>'
             if c['t'] == 'personaje' else '')
    habs = habilidades(c)
    chapas = ''.join(f'<span class="hab">{esc(h)}</span>' for h in habs)
    if c['fast']:  chapas += '<span class="marca">Rápido</span>'
    if c['relic']: chapas += '<span class="marca">Reliquia</span>'
    if c['r'] == 2: chapas += '<span class="marca oro">★ Legendaria</span>'
    quien = en_mazos.get(cid, [])
    mazos = ('<div class="enmazos">' +
             ' · '.join(f'{n}× {esc(nombre)}' for nombre, n in quien) +
             '</div>') if quien else '<div class="enmazos sin">en ningún mazo precon</div>'
    return f'''
    <div class="carta t-{c['t']}">
      <div class="cab">
        <span class="coste">{c['c']}</span>
        <span class="nombre">{esc(c['n'])}</span>
        {stats}
      </div>
      <div class="tribu">{esc(' · '.join(c['tr'])) or '&nbsp;'}</div>
      <div class="texto">{limpia(c['x']) or '<i>Sin texto de reglas.</i>'}</div>
      <div class="chapas">{chapas}</div>
      {mazos}
    </div>'''

def seccion_tipo(t, titulo, desc):
    cartas = por_tipo.get(t, [])
    return f'''
    <section class="tipo" id="tipo-{t}">
      <h2><span class="punto" style="background:{COLORES[t]}"></span>{titulo}
          <small>{len(cartas)} cartas</small></h2>
      <p class="desc">{desc}</p>
      <div class="rejilla">{''.join(ficha_carta(k, v) for k, v in cartas)}</div>
    </section>'''

def ficha_lider(lid, primero=False):
    L, G, M = LIDERES[lid], GUIAS[lid], MAZOS[lid]
    hab2 = (f'<p><b>{esc(L["hab2"]["n"])}</b> — {esc(L["hab2"]["d"])}</p>'
            if L.get('hab2') else '')
    filas = [f'<tr><td>{n}×</td><td>{esc(CARTAS[cid]["n"])}</td>'
             f'<td class="num">{CARTAS[cid]["c"]}</td>'
             f'<td>{esc(TIPO_ES[CARTAS[cid]["t"]])}</td></tr>'
             for cid, n in sorted(M['list'], key=lambda x: (CARTAS[x[0]]['c'], CARTAS[x[0]]['n']))]
    mitad = (len(filas) + 1) // 2
    cabecera = '<tr><th></th><th>Carta</th><th>PD</th><th>Tipo</th></tr>'
    lista = (f'<div class="dos"><table class="mazo">{cabecera}{"".join(filas[:mitad])}</table>'
             f'<table class="mazo">{cabecera}{"".join(filas[mitad:])}</table></div>')
    total = sum(n for _, n in M['list'])
    coste = sum(CARTAS[c]['c'] * n for c, n in M['list'])
    return f'''
    <section class="lider{' primero' if primero else ''}">
      <h2><span class="art">{L['art']}</span>{esc(L['n'])}
        <small>{esc(L['ep'])}</small></h2>
      <p class="arque">{esc(L['arch'])} · dificultad {'★' * G['dif']}{'☆' * (3 - G['dif'])}</p>
      <p class="lema">«{esc(G['lema'])}»</p>
      <div class="caja">
        <p><b>Pasiva.</b> {limpia(L['pasiva'])}</p>
        <p><b>Habilidad ({L['habCost']} PD).</b> {limpia(L['hab'])}</p>
        {hab2}
      </div>
      <p class="lore">{esc(L['lore'])}</p>
      <h3>Cómo se gana con él</h3>
      <p>{limpia(G['ganas'])}</p>
      <h3>Su motor</h3>
      <p>{limpia(G['motorTxt'])}</p>
      <h3>La jugada que buscas</h3>
      <p>{limpia(G['combo'])}</p>
      <h3>Cómo se pierde</h3>
      <ul>{''.join(f'<li>{limpia(p)}</li>' for p in G['pierdes'])}</ul>
      <h3>El mazo — «{esc(M['n'])}» · {total} cartas · coste medio {coste/total:.2f} PD</h3>
      {lista}
    </section>'''

TIPO_ES = {'personaje':'Personaje','hechizo':'Hechizo','trampa':'Trampa',
           'objeto':'Objeto','lugar':'Lugar'}

reglas = D['reglas'].replace('<div class="rules">','').replace('</div>','')

doc = f'''<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>La Biblia del Domo — Caoz Con Todo TCG</title>
<style>
@page {{ size:A4; margin:15mm 14mm 16mm; }}
* {{ box-sizing:border-box; }}
body {{ font:10.5pt/1.5 "Georgia","Times New Roman",serif; color:#1a1420; margin:0; }}
h1,h2,h3,h4 {{ font-family:"Trebuchet MS",system-ui,sans-serif; color:#4a2f8a; }}

/* ---------- portada ---------- */
.portada {{ height:264mm; display:flex; flex-direction:column; align-items:center;
  justify-content:center; text-align:center; page-break-after:always;
  background:linear-gradient(170deg,#1b1030,#3a2560 55%,#1b1030); color:#f4ecff;
  margin:-15mm -14mm 0; padding:20mm; }}
.portada h1 {{ font-size:44pt; margin:0; color:#ffd76a; letter-spacing:1px; line-height:1.05; }}
.portada .sub {{ font-size:15pt; margin-top:6mm; color:#cbb8f0; }}
.portada .cifras {{ margin-top:16mm; display:flex; gap:12mm; }}
.portada .cifras div {{ font-size:11pt; color:#cbb8f0; }}
.portada .cifras b {{ display:block; font-size:26pt; color:#ffd76a; font-family:sans-serif; }}
.portada .pie {{ position:absolute; bottom:22mm; font-size:9pt; color:#9a86c4; }}

/* ---------- estructura ---------- */
section.corta {{ page-break-inside:avoid; }}
h2 {{ font-size:17pt; margin:9mm 0 2mm; padding-bottom:1.5mm; page-break-after:avoid;
  border-bottom:2px solid #d9cdf0; display:flex; align-items:center; gap:3mm; }}
h2 small {{ font-size:10pt; color:#8a7bab; font-weight:400; margin-left:auto; }}
h3 {{ font-size:11.5pt; margin:5mm 0 1mm; page-break-after:avoid; }}
h4 {{ font-size:11pt; margin:5mm 0 1mm; }}
p {{ margin:0 0 2.5mm; }}
.punto {{ width:4mm; height:4mm; border-radius:50%; display:inline-block; }}
.desc {{ color:#5c5170; font-style:italic; margin-bottom:4mm; }}

/* ---------- reglas ---------- */
.reglas table {{ width:100%; border-collapse:collapse; margin:2mm 0 4mm; font-size:9.5pt; }}
.reglas th {{ background:#efe9fa; text-align:left; }}
.reglas th,.reglas td {{ border:1px solid #d9cdf0; padding:1.4mm 2mm; vertical-align:top; }}
.reglas ul {{ margin:0 0 3mm 5mm; }} .reglas li {{ margin-bottom:1mm; }}

/* ---------- cartas ---------- */
.rejilla {{ display:grid; grid-template-columns:1fr 1fr; gap:3mm; }}
.carta {{ border:1px solid #cfc4e4; border-left:3.5mm solid #999; border-radius:1.5mm;
  padding:2mm 2.5mm; page-break-inside:avoid; background:#fdfcff; }}
.carta.t-personaje {{ border-left-color:{COLORES['personaje']}; }}
.carta.t-hechizo   {{ border-left-color:{COLORES['hechizo']}; }}
.carta.t-trampa    {{ border-left-color:{COLORES['trampa']}; }}
.carta.t-objeto    {{ border-left-color:{COLORES['objeto']}; }}
.carta.t-lugar     {{ border-left-color:{COLORES['lugar']}; }}
.cab {{ display:flex; align-items:center; gap:2mm; }}
.coste {{ background:#4a2f8a; color:#fff; font-family:sans-serif; font-weight:bold;
  width:5.5mm; height:5.5mm; border-radius:50%; display:inline-grid; place-items:center;
  font-size:8.5pt; flex:0 0 auto; }}
.nombre {{ font-weight:bold; font-size:10.5pt; flex:1; }}
.atq,.pv {{ font-family:sans-serif; font-weight:bold; font-size:9pt; padding:0 1.6mm;
  border-radius:1mm; }}
.atq {{ background:#f6e2cf; color:#8a4a12; }} .pv {{ background:#f8d7d4; color:#8a1f18; }}
.tribu {{ font-size:7.5pt; letter-spacing:.4pt; text-transform:uppercase; color:#8a7bab;
  margin:.6mm 0 1mm; }}
.texto {{ font-size:9pt; line-height:1.42; }}
.chapas {{ margin-top:1.2mm; }}
.hab,.marca {{ display:inline-block; font-family:sans-serif; font-size:7pt; padding:.2mm 1.4mm;
  border:1px solid #c8b98f; border-radius:1mm; margin:.6mm .8mm 0 0; color:#7a5f14;
  background:#fdf6e0; }}
.marca {{ border-color:#b9aecd; color:#5c5170; background:#f2eefa; }}
.marca.oro {{ border-color:#d9b64a; color:#8a6a12; background:#fdf3d6; }}
.enmazos {{ font-size:7.5pt; color:#6f6390; margin-top:1.2mm;
  border-top:1px dotted #ddd4ee; padding-top:1mm; }}
.enmazos.sin {{ color:#a99cc4; font-style:italic; }}

/* ---------- líderes ---------- */
.lider {{ page-break-before:always; }}
.lider.primero {{ page-break-before:auto; }}
.lider .art {{ font-size:20pt; }}
.arque {{ font-family:sans-serif; font-size:9pt; letter-spacing:.6pt; text-transform:uppercase;
  color:{COLORES['hechizo']}; margin-top:-1mm; }}
.lema {{ font-style:italic; font-size:12pt; color:#4a2f8a; margin:2mm 0 3mm; }}
.caja {{ background:#f5f1fd; border:1px solid #ddd4ee; border-left:3px solid #4a2f8a;
  border-radius:1.5mm; padding:2.5mm 3mm; margin-bottom:3mm; }}
.caja p {{ margin:0 0 1.5mm; font-size:10pt; }} .caja p:last-child {{ margin:0; }}
.lore {{ font-style:italic; color:#5c5170; }}
.dos {{ display:flex; gap:4mm; margin-top:1.5mm; }}
.dos table {{ flex:1; }}
table.mazo {{ width:100%; border-collapse:collapse; font-size:8.5pt; }}
table.mazo th {{ background:#efe9fa; text-align:left; font-family:sans-serif; font-size:8.5pt; }}
table.mazo th,table.mazo td {{ border:1px solid #e2daf2; padding:.45mm 1.4mm; }}
table.mazo td:first-child {{ width:8mm; text-align:right; font-weight:bold; }}
table.mazo .num {{ text-align:center; width:9mm; }}

/* ---------- varios ---------- */
.indice {{ columns:2; column-gap:8mm; font-size:10pt; }}
.indice li {{ margin-bottom:1mm; }}
.aviso {{ background:#fdf6e0; border:1px solid #e2d3a0; border-left:3px solid #d9b64a;
  border-radius:1.5mm; padding:2.5mm 3mm; font-size:9.5pt; margin:3mm 0; }}
.tribus {{ columns:3; column-gap:6mm; font-size:9pt; }}
</style></head><body>

<div class="portada">
  <h1>La Biblia<br>del Domo</h1>
  <div class="sub">Caoz Con Todo · el Juego de Cartas</div>
  <div class="cifras">
    <div><b>{len(jugables)}</b>cartas</div>
    <div><b>{len(LIDERES)}</b>Protagonistas</div>
    <div><b>{len(MAZOS)}</b>mazos</div>
  </div>
  <div class="pie">Generado desde el juego · versión v5</div>
</div>

<h2>Qué hay dentro</h2>
<ol class="indice">
  <li>Cómo se juega — las reglas</li>
  <li>Las cinco clases de carta</li>
  <li>Palabras clave y estados</li>
  <li>Los cinco Protagonistas y sus mazos</li>
  <li>Todas las cartas, por clase</li>
  <li>Fichas</li>
</ol>

<section class="reglas">
<h2>1 · Cómo se juega</h2>
{reglas}
</section>

<section>
<h2>2 · Las cinco clases de carta</h2>
<p class="desc">Cada clase tiene su color, en el borde de la carta y en el círculo del coste.</p>
<table class="reglas" style="width:100%">
<tr><th>Clase</th><th>Qué es</th><th>Cuántas hay</th><th>Color</th></tr>
{''.join(f"""<tr><td><b>{t[1]}</b></td><td>{t[2]}</td>
  <td>{len(por_tipo.get(t[0],[]))}</td>
  <td><span class="punto" style="background:{COLORES[t[0]]}"></span></td></tr>""" for t in TIPOS)}
</table>
<div class="aviso"><b>Cómo leer una carta.</b> El número del círculo es lo que cuesta en
Puntos (PD). En los Personajes, los dos números de la derecha son <b>Ataque</b> y
<b>Vida</b>. Debajo del nombre va la tribu, y en negrita dentro del texto van los nombres de
sus habilidades — los mismos que el juego enseña en el tablero.</div>
</section>

<section>
<h2>3 · Palabras clave y estados</h2>
<p class="desc">Referencia completa, con las que ya salen arriba y las que no.</p>
<table class="reglas" style="width:100%">
<tr><th>Palabra</th><th>Qué hace</th></tr>
<tr><td><b>Prisa</b></td><td>Puede atacar el mismo turno que entra. Sin ella, un Personaje llega cansado.</td></tr>
<tr><td><b>Provocar</b></td><td>Mientras esté vivo, el rival tiene que atacarlo a él antes que a nada.</td></tr>
<tr><td><b>Vuelo</b></td><td>Sólo lo pueden alcanzar los que tengan Vuelo o Arquero.</td></tr>
<tr><td><b>Arquero</b></td><td>Puede atacar a los que tienen Vuelo.</td></tr>
<tr><td><b>Sigilo</b></td><td>No se le puede atacar ni elegir como objetivo hasta que ataque por primera vez.</td></tr>
<tr><td><b>Regeneración</b></td><td>Se cura al final del turno.</td></tr>
<tr><td><b>Ignora Provocar</b></td><td>Puede atacar a quien quiera aunque haya un Provocar delante.</td></tr>
<tr><td><b>Infectado</b></td><td>Pierde 1 de Vida al principio de cada uno de tus turnos. En el juego se pone <b>verde</b>, y ese daño sale también en verde.</td></tr>
<tr><td><b>Aturdido</b></td><td>No puede atacar este turno.</td></tr>
<tr><td><b>Poseído</b></td><td>Lo controla el rival.</td></tr>
<tr><td><b>Condenado</b></td><td>Morirá al cabo de los turnos indicados.</td></tr>
</table>
<div class="aviso"><b>El d20.</b> Varias cartas te hacen tirar un dado de veinte caras, y
<b>lo tiras tú</b>: sale el dado, le das, y ves el número antes de que pase nada en el
tablero. <b>20 = Crítico</b>. <b>1 = Pifia</b>: falla y además pierdes 1 de Alma.</div>
</section>

<section>
<h2>Las tribus</h2>
<p class="desc">Muchas cartas se refieren a tribus concretas. Estas son las que existen y
cuántas cartas pertenecen a cada una.</p>
<div class="tribus">{''.join(f'<div>{esc(t)} — {n}</div>' for t,n in sorted(tribus.items(), key=lambda x:(-x[1],x[0])))}</div>
</section>

<div style="page-break-before:always"></div>
<h2>4 · Los cinco Protagonistas</h2>
{''.join(ficha_lider(l, i==0) for i,l in enumerate(LIDERES))}

<h2 style="page-break-before:always">5 · Todas las cartas</h2>
<p class="desc">Ordenadas por coste dentro de cada clase. Debajo de cada una se indica en qué
mazos precon aparece y con cuántas copias.</p>
{''.join(seccion_tipo(t, titulo, desc) for t, titulo, desc in TIPOS)}

<section style="page-break-before:always">
<h2>6 · Fichas <small>{len(fichas)} fichas</small></h2>
<p class="desc">No se ponen en el mazo: las crean otras cartas durante la partida.</p>
<div class="rejilla">{''.join(ficha_carta(k, v) for k, v in sorted(fichas.items(), key=lambda kv: kv[1]['n']))}</div>
</section>

</body></html>'''

open(salida, 'w').write(doc)
print(f'biblia generada: {len(jugables)} cartas jugables, {len(fichas)} fichas, '
      f'{len(LIDERES)} Protagonistas, {len(tribus)} tribus')
