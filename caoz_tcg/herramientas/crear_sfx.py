"""Banco original del Domo: resonadores, fricción, percusión y reverberación.

Herramienta de autoría; NumPy sólo se usa aquí, nunca en el juego publicado.
No contiene muestras de otros juegos. Semilla fija para poder reproducirlo.
"""
import hashlib, json, math, wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / 'audio'
ROOT.mkdir(exist_ok=True)
SR = 32000
rng = np.random.default_rng(208)
CAT = []

def ruido(d, lo=120, hi=9000):
    n = max(8, int(d * SR)); f = np.fft.rfftfreq(n, 1/SR)
    w = np.fft.rfft(rng.normal(size=n))
    filtro = (1 - np.exp(-(f/max(lo,1))**4)) * np.exp(-(f/hi)**4)
    z = np.fft.irfft(w * filtro, n)
    return z / max(.001, np.sqrt(np.mean(z*z)))

def resonar(d, freq, dec=.2, material='madera'):
    t = np.arange(int(SR*d))/SR
    ratios = {'madera':[1,2.76,5.4,8.93], 'metal':[1,1.47,2.09,2.56,3.94,5.43],
              'cuerda':[1,2,3,4,5,6,7,8], 'cuerno':[1,2,3,4]}[material]
    z = np.zeros(len(t))
    for i,r in enumerate(ratios):
        z += np.sin(2*np.pi*freq*r*t + .012*np.sin(2*np.pi*3.1*t)) * np.exp(-t/(dec/(1+i*.35))) / (1+i)**1.35
    return z * (1-np.exp(-t/(.022 if material=='cuerno' else .0012)))

def envolvente(z, a=.006, dec=.1):
    t = np.arange(len(z))/SR
    return z*(1-np.exp(-t/a))*np.exp(-t/dec)

def fabricar(id, nombre, grupo, detalle, d, receta, ganancia=.75, intervalo=80):
    z = np.zeros(int(d*SR)); t = np.arange(len(z))/SR
    def sumar(s, en=0, peso=1):
        i=int(en*SR); n=min(len(s),len(z)-i)
        if n>0: z[i:i+n] += s[:n]*peso
    def golpe(en=0, f=160, peso=1, material='madera', dec=.1):
        sumar(resonar(min(d-en,1.5),f,dec,material),en,peso)
        sumar(envolvente(ruido(min(.06,d-en),300,6000),.001,.014),en,peso*.2)
    def soplo(en=0,dur=.3,peso=.3,lo=180,hi=6000,sube=False):
        q=ruido(dur,lo,hi); tt=np.linspace(0,1,len(q)); q*=np.sin(np.pi*tt)**(1.8 if sube else .7)
        q*= .75+.25*np.sin(2*np.pi*(13*tt+23*tt**2))
        sumar(q,en,peso)
    def nota(en,f,peso=.35,dec=.4,material='metal'):
        sumar(resonar(min(d-en,dec*5),f,dec,material),en,peso)
    if receta=='papel':
        soplo(.01,min(d*.7,.28),.38,900,11000)
        for j in range(7): golpe(.012+j*.023,2100+j*70,.026,dec=.004)
        if id=='card_play': golpe(.17,175,.85); golpe(.183,610,.18,dec=.035)
    elif receta=='interfaz':
        golpe(.005,360,.45,dec=.026); soplo(.002,min(.13,d*.6),.18,700,6500)
        nota(.027,920 if id=='ui_confirm' else 680,.1,.08)
    elif receta=='metal':
        golpes = [(.01,860,.55),(.16,1110,.4),(.28,790,.25),(.36,970,.17)] if id=='coin_flip' else [(.005,760,.75),(.048,1200,.25)]
        for en,f,peso in golpes: golpe(en,f,peso,'metal',.24)
    elif receta=='dados':
        for j,en in enumerate([.005,.057,.13,.227,.35,.50] if id=='dice_roll' else [.005,.041]):
            golpe(en,440+rng.uniform(-90,120),.65/(1+j*.16),dec=.025); golpe(en+.006,122,.25,dec=.05)
    elif receta=='aire':
        soplo(0,d*.78,.7,130,7000,True); soplo(d*.18,d*.5,.15,50,750,True)
    elif receta=='impacto':
        golpe(.006,87,.9,dec=.15); golpe(.011,210,.35,dec=.055)
        sumar(envolvente(ruido(.17,500,8500),.001,.033),.009,.3)
        if id in ('lethal','table_hit'):
            for j in range(7): golpe(.10+j*.042,180+j*145,.15/(j+1)**.45,dec=.04)
        if id=='attack_hit': nota(.018,740,.13,.1)
    elif receta=='alma':
        golpe(.004,62,.95,dec=.24); golpe(.012,143,.48,dec=.09)
        sumar(envolvente(ruido(.23,90,2600),.002,.055),.006,.4)
        nota(.022,460,.16,.18,'metal'); nota(.028,690,.08,.13,'metal')
    elif receta=='sello':
        golpe(.004,48,1.05,dec=.28); golpe(.009,96,.7,dec=.18)
        sumar(envolvente(ruido(.25,220,6400),.001,.042),.005,.45)
        for en,f in [(.014,196),(.02,293.66),(.026,392)]: nota(en,f,.20,.29,'metal')
        soplo(.07,.42,.12,80,1500)
    elif receta=='paso':
        golpe(.008,235,.7,dec=.035); golpe(.025,110,.4,dec=.052); soplo(.018,.09,.07,900,7000)
    elif receta=='oro':
        soplo(0,.36,.32,90,2800,True)
        for j,f in enumerate([196,293.66,392,587.33]): nota(.12+j*.018,f,.25,.25)
        golpe(.20,94,.28,dec=.17)
    elif receta in ('fuego','sombra','rayo','hielo','arcano','sagrado','cura','buff','niebla'):
        soplo(0,min(d*.48,.48),.22,150,3200,True)
        inicio=.20
        if receta=='fuego':
            sumar(envolvente(ruido(d-inicio,40,5200),.035,.36),inicio,.65)
            for j in range(16): golpe(inicio+rng.uniform(0,d-inicio-.09),900+rng.uniform(0,2400),.065,dec=.009)
            golpe(inicio,67,.7,dec=.17)
        elif receta=='rayo':
            for en in [.20,.235,.28,.38]: sumar(envolvente(ruido(.18,70,12000),.001,.025),en,.5 if en==.2 else .2)
            golpe(.21,52,.6,dec=.26); soplo(.26,.6,.2,40,1000)
        elif receta=='hielo':
            for j in range(17): nota(.18+j*.031,rng.uniform(1700,3900),.14,.09)
            sumar(envolvente(ruido(.33,1600,12000),.003,.12),.2,.2)
        elif receta=='sombra':
            for f in [55,58.3,110,164.8]: nota(.12,f,.18,.32)
            soplo(.08,.85,.38,100,1600)
        elif receta=='niebla': soplo(.02,d*.9,.24,180,2000)
        else:
            escala={'arcano':[196,233.08,293.66,392,466.16],'cura':[392,493.88,587.33,783.99],
                    'sagrado':[196,293.66,392,493.88,587.33], 'buff':[293.66,392,493.88]}[receta]
            for j,f in enumerate(escala): nota(.16+j*.06,f,.23,.35,'cuerda' if receta=='buff' else 'metal')
            soplo(.16,min(d-.2,.6),.08,1800,6500)
    elif receta=='laud':
        for j,f in enumerate([196,293.66,392,493.88,587.33]): nota(.005+j*.037,f,.32,.28,'cuerda')
        golpe(.02,140,.11,dec=.035)
    elif receta in ('victoria','derrota','versus','ascension','deseo'):
        if receta=='versus':
            soplo(0,.28,.3,60,2000,True); golpe(.26,58,.9,dec=.28)
            for f in [98,146.83,196]: nota(.27,f,.28,.35,'cuerno')
            nota(.27,590,.13,.4)
        elif receta=='ascension':
            for j,f in enumerate([98,146.83,196,246.94,293.66,392,493.88,587.33]):
                tt=np.arange(int((d-.2)*SR))/SR
                s=resonar(d-.2,f,5,'cuerno')*(1-np.exp(-tt/(.3+j*.08)))
                sumar(s,.1,.055)
            soplo(0,d*.95,.09,300,5000,True)
        else:
            acordes={'victoria':[(0,[196,293.66]),(.48,[246.94,392]),(.96,[293.66,392,493.88,587.33])],
                     'derrota':[(0,[146.83,174.61,220]),(.65,[110,138.59,164.81])],
                     'deseo':[(0,[293.66,392]),(.28,[493.88,587.33,783.99])]}[receta]
            for en,fs in acordes:
                golpe(en+.006,65,.18,dec=.2)
                for j,f in enumerate(fs): nota(en+j*.022,f,.2,.52,'cuerno' if receta!='deseo' else 'metal'); nota(en+.04+j*.025,f*2,.05,.32)
    # Pequeña sala de piedra: reflexiones dispersas, distintas en cada canal.
    stereo=np.column_stack([z.copy(),z.copy()]); reverb=.10 if grupo=='Interfaz' else .18
    for lado in range(2):
        for j in range(17):
            delay=int(SR*(.027+j*.0173+rng.uniform(0,.008))); n=len(z)-delay
            if n>0: stereo[delay:,lado]+=z[:n]*reverb*np.exp(-j*.21)*(-1 if j%3==0 else 1)
    stereo-=stereo.mean(axis=0)
    stereo=np.tanh(stereo*.65)
    pico=np.max(np.abs(stereo)); stereo*=.69/max(pico,.001)
    fade=min(int(SR*.06),len(z)//4); stereo[-fade:]*=np.linspace(1,0,fade)[:,None]
    stereo[:64]*=np.linspace(0,1,64)[:,None]
    pcm=(stereo*32767).astype('<i2')
    ruta=ROOT/(id+'.wav')
    with wave.open(str(ruta),'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    CAT.append(dict(id=id,nombre=nombre,grupo=grupo,detalle=detalle,archivo='audio/'+ruta.name,
                    duracion=d,volumen=ganancia,intervalo=intervalo,version=hashlib.sha256(ruta.read_bytes()).hexdigest()[:16]))

for args in [
 ('ui_hover','Rozar el pergamino','Interfaz','Al pasar sobre un botón. Fricción breve, sin campanilla.',.18,'papel',.17,110),
 ('ui_confirm','Confirmar','Interfaz','Madera, cuero y una resonancia pequeña.',.26,'interfaz',.42,100),
 ('ui_back','Regresar','Interfaz','Cierre suave al volver o cancelar.',.28,'interfaz',.34,140),
 ('menu_gold','Umbral dorado','Interfaz','El barrido dorado: aire y bronce.',.85,'oro',.52,420),
 ('card_draw','Robar carta','Cartas','Papel grueso rozando la baraja.',.35,'papel',.40,100),
 ('card_play','Carta en la mesa','Cartas','Papel, cuero y contacto de madera.',.46,'papel',.68,100),
 ('attack_wind','Preparar el ataque','Combate','Desplazamiento de arma y aire antes del contacto.',.27,'aire',.65,110),
 ('attack_hit','Impacto','Combate','Golpe seco, cuerpo grave y filo corto.',.52,'impacto',.84,70),
 ('counter','Contraataque','Combate','Un corte más corto para responder al rival.',.22,'aire',.55,110),
 ('lethal','Golpe letal','Combate','Impacto profundo y fragmentos que caen.',.90,'impacto',.86,180),
 ('shield','Protección','Combate','Resonancia protectora al lanzar Contrahechizo.',.90,'metal',.59,120),
 ('heal','Curación','Magia','Cristales cálidos que ascienden.',1.30,'cura',.56,140),
 ('buff','Potenciar','Magia','Tres resonancias de cuerda se abren.',1.05,'buff',.54,140),
 ('spell_fire','Fuego','Magia','Preparación, combustión y brasas.',1.45,'fuego',.73,140),
 ('spell_frost','Hielo','Magia','Aire helado y una fractura cristalina.',1.10,'hielo',.57,140),
 ('spell_lightning','Rayo','Magia','Descarga cortante seguida por trueno.',1.20,'rayo',.73,140),
 ('spell_arcane','Magia arcana','Magia','Un sello de piedra vibra y se abre.',1.25,'arcano',.61,140),
 ('spell_shadow','Sombra','Magia','Susurro de aire oscuro y resonancia grave.',1.35,'sombra',.59,140),
 ('spell_bard','Canción del bardo','Magia','Acorde de cuerdas pulsadas, breve y cercano.',1.10,'laud',.61,140),
 ('spell_holy','Magia sagrada','Magia','Bronce y armónicos luminosos.',1.50,'sagrado',.62,140),
 ('dice_roll','Rodar el dado','Rituales','Rebotes desiguales de hueso sobre madera.',.80,'dados',.62,150),
 ('dice_land','Resultado del dado','Rituales','Dos contactos breves antes de detenerse.',.25,'dados',.60,100),
 ('coin_flip','Lanzar la moneda','Rituales','Metal girando, con destellos distintos.',1.0,'metal',.62,300),
 ('coin_land','Cae la moneda','Rituales','Bronce contra la mesa y una cola corta.',.80,'metal',.62,200),
 ('vs','Entrar al duelo','Rituales','Aire, tambor grave y cuernos al aparecer VS.',1.80,'versus',.77,1000),
 ('turn','Comienza tu turno','Rituales','Un acorde corto anuncia el cambio de turno.',.90,'laud',.43,600),
 ('table_hop','Paso de miniatura','Campaña','Resina sobre madera, con un apoyo seco.',.24,'paso',.55,130),
 ('table_hit','Derribo en la mesa','Campaña','La miniatura golpea y el rival cae.',.78,'impacto',.72,400),
 ('fog_reveal','La niebla se abre','Campaña','Una respiración de aire descubre el camino.',1.20,'niebla',.36,800),
 ('victory','Victoria','Finales','Motivo de cuernos y bronce que se resuelve hacia arriba.',3.30,'victoria',.68,1200),
 ('defeat','Derrota','Finales','Un motivo grave desciende y se apaga.',2.50,'derrota',.64,1200),
 ('ascension','El haz del deseo','Finales','Armónicos que crecen con el rayo y la ascensión.',5.70,'ascension',.63,1200),
 ('wish_fire','El fuego del deseo','Finales','Una llamarada amplia con pequeñas brasas.',2.30,'fuego',.76,1200),
 ('wish_granted','Deseo concedido','Finales','Cristal y bronce abiertos, con espacio para el silencio.',2.70,'deseo',.61,1200),
 ('leader_hit','Golpe al protagonista','Combate','Golpe de cuerpo grave, cuero y una fractura arcana al perder Alma.',.85,'alma',.82,90),
 ('card_hover','Rozar carta en la mano','Cartas','Roce ligero de papel al explorar las cartas de tu mano.',.20,'papel',.22,90),
 ('victory_slam','Impacto de Victoria','Finales','Golpe profundo de piedra y bronce al aterrizar el título.',1.35,'sello',.80,1000),
]: fabricar(*args)
(ROOT/'catalogo.json').write_text(json.dumps({'version':1,'nombre':'El sonido del Domo','sonidos':CAT},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sonidos':len(CAT),'MB':round(sum(f.stat().st_size for f in ROOT.glob('*.wav'))/1e6,2)},ensure_ascii=False))
