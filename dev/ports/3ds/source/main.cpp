/* Edición nativa para Nintendo 3DS/2DS original: una escena arriba y el HUD abajo. */
#include <3ds.h>
#include <citro3d.h>
#include <algorithm>
#include <cmath>
#include <cstdio>
#include "juego.hpp"
#include "dibujo.hpp"
#include "hud.hpp"
#include "audio.hpp"
using namespace Grietas;
namespace {
void elegir(Juego& j,int heroe){j.iniciar(heroe?MOHAMED:ADREIDA);j.menu=true;j.seleccionHeroe=heroe;}
void esperarSalida(){while(aptMainLoop()){hidScanInput();if(hidKeysDown()&KEY_START)break;gspWaitForVBlank();}}
}
int main(){
 gfxInitDefault();gfxSet3D(false);
 const Result rom=romfsInit();const bool gpu=C3D_Init(C3D_DEFAULT_CMDBUF_SIZE*2);
 const bool interfaz=gpu&&iniciarHUD();
 if(R_FAILED(rom)||!gpu||!interfaz){consoleInit(GFX_BOTTOM,nullptr);std::printf("CAOZ ARPG\nNo se pudo iniciar la edicion 3DS.\nComprueba el archivo .3dsx completo.\nSTART: salir\n");esperarSalida();if(gpu){cerrarHUD();C3D_Fini();}if(R_SUCCEEDED(rom))romfsExit();gfxExit();return 1;}
 cargaHUD(.01f,"Abriendo las puertas de la plaza…");
 if(!iniciarDibujo(cargaHUD)){errorHUD("No se pudieron cargar los recursos. START: salir");esperarSalida();cerrarDibujo();cerrarHUD();C3D_Fini();romfsExit();gfxExit();return 1;}
 cargaHUD(.97f,"Preparando la tormenta y el sonido…");
 bool sonido=iniciarAudio(),metricas=false,esperaSoltar=true;
 cargaHUD(1,"La plaza está lista");
 Juego juego;u64 anterior=osGetTime();float segundosFPS=0,fps=0;unsigned cuadros=0;int palancaMenu=0;
 while(aptMainLoop()){
  hidScanInput();const u32 abajo=hidKeysDown(),sostenido=hidKeysHeld();
  if((sostenido&(KEY_L|KEY_R))==(KEY_L|KEY_R)&&(abajo&KEY_START))break;
  const u64 ahora=osGetTime();const float transcurrido=(ahora-anterior)/1000.f;anterior=ahora;
  const float dt=std::min(.05f,transcurrido);segundosFPS+=transcurrido;cuadros++;
  if(segundosFPS>=.7f){fps=cuadros/segundosFPS;cuadros=0;segundosFPS=0;}
  touchPosition toque{};hidTouchRead(&toque);const bool pulsa=(abajo&KEY_TOUCH)!=0;
  const int tactil=(sostenido&KEY_TOUCH)?tocarHUD(toque.px,toque.py):-1;
  circlePosition palanca{};hidCircleRead(&palanca);const int lado=palanca.dx>90?1:palanca.dx< -90?-1:0;
  const bool derecha=(abajo&KEY_DRIGHT)||(lado==1&&palancaMenu!=1),izquierda=(abajo&KEY_DLEFT)||(lado==-1&&palancaMenu!=-1);palancaMenu=lado;
  bool consumir=false;
  if(juego.secuencia==FIN_ALPHA){if(abajo&KEY_START){elegir(juego,juego.seleccionHeroe);esperaSoltar=true;}consumir=true;}
  else if(juego.menu){
   if(izquierda||derecha)elegir(juego,1-juego.seleccionHeroe);
   if(pulsa&&toque.py>=91&&toque.py<156)elegir(juego,toque.px<160?0:1);
   if((abajo&(KEY_A|KEY_Y))||(pulsa&&toque.py>=201)){juego.iniciarNivel((abajo&KEY_Y)?2:1);esperaSoltar=true;}
   consumir=true;
  }else if(juego.pausa||juego.derrota){
   if(abajo&KEY_B){elegir(juego,juego.seleccionHeroe);esperaSoltar=true;}
   else if(abajo&(KEY_A|KEY_START)){if(juego.derrota)juego.iniciarNivel(juego.nivel);else juego.pausa=false;esperaSoltar=true;}
   if(abajo&KEY_X){sonido=audioDisponible()&&!sonido;activarAudio(sonido);}
   if(abajo&KEY_Y)metricas=!metricas;
   consumir=true;
  }else if(juego.cartas){
   if(!juego.tirando&&!juego.resuelto){if(izquierda)juego.elegida=(juego.elegida+2)%3;if(derecha)juego.elegida=(juego.elegida+1)%3;if(pulsa&&toque.py>=54&&toque.py<161)juego.elegida=std::min(2,std::max(0,(int(toque.px)-10)/102));}
   if((abajo&KEY_A)||(pulsa&&toque.py>=165)){if(juego.resuelto)juego.continuarCarta();else juego.tirar(juego.elegida);esperaSoltar=true;}
   consumir=true;
  }else if((abajo&KEY_START)||(pulsa&&tactil==7)){juego.pausa=true;consumir=true;esperaSoltar=true;}
  if(abajo&KEY_SELECT)metricas=!metricas;
  constexpr u32 acciones=KEY_A|KEY_B|KEY_X|KEY_Y|KEY_L|KEY_R|KEY_DUP|KEY_TOUCH;
  if(!(sostenido&acciones))esperaSoltar=false;
  Entrada entrada{};
  if(!consumir&&!esperaSoltar){
   const float x=palanca.dx/156.f,z=-palanca.dy/156.f,mag=std::sqrt(x*x+z*z);
   if(mag>.18f)entrada.mov=unidad({x,z})*limite((mag-.18f)/.82f,0,1);
   entrada.ataque=(sostenido&KEY_A)||tactil==0;
   entrada.parry=(abajo&KEY_L)||(pulsa&&tactil==1);
   entrada.dash=(abajo&KEY_B)||(pulsa&&tactil==2);
   entrada.salto=(abajo&KEY_X)||(pulsa&&tactil==3);
   entrada.giro=(abajo&KEY_Y)||(pulsa&&tactil==4);
   entrada.provoca=(abajo&KEY_DUP)||(pulsa&&tactil==5);
   entrada.ulti=(abajo&KEY_R)||(pulsa&&tactil==6);
  }
  juego.paso(dt,entrada);pasoAudio(juego,dt);metricasHUD(fps,metricas,sonido);dibujar(juego);
  // C3D_FRAME_SYNCDRAW ya espera la pantalla; otro VBlank reduciría la frecuencia.
 }
 cerrarAudio();cerrarDibujo();cerrarHUD();C3D_Fini();romfsExit();gfxExit();return 0;
}
