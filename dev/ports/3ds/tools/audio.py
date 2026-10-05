"""Sonido original sintetizado fuera de la consola; PCM mono a 22050 Hz.
No usa grabaciones, librerías de muestras ni archivos de Nintendo.
"""
from pathlib import Path
import math, random, struct, json
salida = Path(__file__).resolve().parents[1] / 'romfs' / 'audio'
salida.mkdir(parents=True, exist_ok=True)
SR = 22050
rng = random.Random(3401)
resumen = []
def guardar(nombre, duracion, funcion):
    n = round(duracion * SR)
    muestras = []
    bajo = 0.0
    for i in range(n):
        t = i / SR
        ruido = rng.uniform(-1, 1)
        bajo += (ruido - bajo) * .035
        v = funcion(t, t / duracion, ruido, bajo)
        # Entrada y salida suaves: nunca se corta una señal fuera de cero.
        if nombre != 'lluvia':
            v *= min(1, t / .003, (duracion - t) / .02)
        muestras.append(max(-32760, min(32760, int(v * 24000))))
    if nombre == 'lluvia':
        # Cruce circular en el borde del bucle para evitar un clic cada 4 s.
        cruz = 512
        for i in range(cruz):
            k = i / cruz
            muestras[-cruz+i] = int(muestras[-cruz+i]*(1-k)+muestras[i]*k)
        muestras = muestras[cruz:]
    contenido = struct.pack('<' + 'h'*len(muestras), *muestras)
    (salida / (nombre + '.pcm')).write_bytes(contenido)
    resumen.append({'nombre':nombre,'muestras':len(muestras),'frecuencia':SR,'bytes':len(contenido)})
guardar('tajo', .24, lambda t,k,n,b: n * math.sin(k*math.pi)**2 * .35 + math.sin(2*math.pi*(170*t-180*t*t))*.09*(1-k))
guardar('impacto', .42, lambda t,k,n,b: (math.sin(2*math.pi*(80*t-48*t*t))*.65+b*.9+n*.12)*math.exp(-12*t))
guardar('parry', .45, lambda t,k,n,b: (math.sin(2*math.pi*1260*t)*.3+math.sin(2*math.pi*2047*t)*.17+n*.07)*math.exp(-12*t))
guardar('disparo', .16, lambda t,k,n,b: (n*.65+b+math.sin(2*math.pi*96*t)*.24)*math.exp(-37*t))
guardar('salto', .65, lambda t,k,n,b: (b*2+n*.16+math.sin(2*math.pi*(55*t-20*t*t))*.6)*math.exp(-8*t))
guardar('muerte', .6, lambda t,k,n,b: (b*1.4+n*.12+math.sin(2*math.pi*(100*t-75*t*t))*.22)*math.exp(-7*t))
guardar('magia', .95, lambda t,k,n,b: (math.sin(2*math.pi*(220*t+160*t*t))*.16+math.sin(2*math.pi*330*t)*.12+b*.8)*math.sin(math.pi*k)**2)
guardar('paso', .09, lambda t,k,n,b: (n*.23+b*.6)*math.exp(-45*t))
guardar('trueno', 2.0, lambda t,k,n,b: (b*2+math.sin(2*math.pi*37*t)*.14+n*.035)*(1-math.exp(-9*t))*math.exp(-2*t))
guardar('lluvia', 4.0, lambda t,k,n,b: n*.13+b*.8)
(salida/'manifiesto.json').write_text(json.dumps({'formato':'PCM16LE mono','origen':'Síntesis original de Caoz ARPG, determinista','archivos':resumen},ensure_ascii=False,indent=2)+'\n')
print('Audio 3DS:',sum(x['bytes'] for x in resumen),'bytes en',len(resumen),'sonidos')
