/* Adaptación homebrew para Nintendo 3DS/2DS original. */
#include <3ds.h>
#include <citro3d.h>
#include <cstdio>
#include <algorithm>
#include "juego.hpp"
#include "dibujo.hpp"
using namespace Grietas;
static const char* atributos[]={"danio basico","habilidades","vida maxima","recarga de dash","velocidad"};
static void mostrarCarta(const Carta& c, bool elegida) {
 const char premio = c.atributo == 3 ? '-' : '+';
 const char castigo = c.atributo == 3 ? '+' : '-';
 printf("%s %s\n  %d-20: %c%.0f%%", elegida ? ">" : " ", atributos[c.atributo], c.umbral, premio, c.premio * 100);
 if (c.umbral > 2) printf(" | 2-%d: %c%.0f%%", c.umbral - 1, castigo, c.castigo * 100);
 printf("\n");
 if (c.umbral == 2) printf("  Todo 2-20 es positivo\n");
}
static void interfaz(Juego&j){printf("\x1b[H\x1b[2J");printf("   CAOZ ARPG\n   Adaptacion 3DS - prototipo\n\n");
 if(j.menu){printf("Elige personaje con izquierda/derecha\n\n%s Adreida - hacha a dos manos\n%s Mohamed - pistola y daga\n\nA: comenzar\n",j.seleccionHeroe==0?">":" ",j.seleccionHeroe==1?">":" ");}
 else if(j.cartas){printf("CARTAS PARA EL SIGUIENTE NIVEL\n1 critico: elimina todos los buffs\n\n");for(int n=0;n<3;n++)mostrarCarta(j.opciones[n],j.elegida==n);printf("\nD20: %s %d\n",j.tirando?"rodando...":j.resuelto?"resultado":"listo",j.dado);printf(j.resuelto?"A: seguir al cobro de piso\n":"Izq/der: carta   A: tirar\n");if(j.resuelto)printf("%s\n",j.anuncio.c_str());}
 else {printf("%s | Nivel %d | Oleada %d\n",j.h.tipo==ADREIDA?"Adreida":"Mohamed",j.nivel,j.oleada+1);printf("Alma %3.0f / %.0f    Furia %.0f\n",j.h.vida,j.h.maxVida,j.furia);printf("Enemigos %d    Cartas %d/3\n",j.vivos(),j.mano);if(j.h.tipo==MOHAMED)printf("Balas %d/6  %s\n",j.balas,j.recarga>0?"Recargando":"");printf("\nParry %.1f  Dash %.1f  Salto %.1f\n",j.cds[0],j.cds[1],j.cds[2]);printf("Ulti %.0f s   Parrys %d\n",j.ultiRestante,j.parrys);if(j.anuncioT>0||j.derrota||j.victoria)printf("\n%s\n",j.anuncio.c_str());if(j.pausa)printf("\nEN PAUSA - START para continuar\n");}
 printf("\nCircle Pad: mover / orientar\nA: basico (mantener: cargar)\nB: dash     L: Parry\nX: salto    Y: torbellino/abanico\nR: ulti     Arriba: provocar\nSTART: pausa   SELECT: personajes\nL + R + START: salir al launcher\n");}
int main(){gfxInitDefault();gfxSet3D(false);consoleInit(GFX_BOTTOM,nullptr);Result rom=romfsInit();bool gpu=C3D_Init(C3D_DEFAULT_CMDBUF_SIZE*2);if(R_FAILED(rom)||!gpu||!iniciarDibujo()){printf("No se pudieron cargar los datos 3DS.\nComprueba el archivo .3dsx completo.\nSTART: salir\n");while(aptMainLoop()){hidScanInput();if(hidKeysDown()&KEY_START)break;gspWaitForVBlank();}if(gpu){cerrarDibujo();C3D_Fini();}if(R_SUCCEEDED(rom))romfsExit();gfxExit();return 1;}
 Juego juego;u64 anterior=osGetTime();float ui=0;
 while(aptMainLoop()){hidScanInput();u32 abajo=hidKeysDown(),sostenido=hidKeysHeld();if((sostenido&(KEY_L|KEY_R))==(KEY_L|KEY_R)&&(abajo&KEY_START))break;u64 ahora=osGetTime();float dt=std::min(.05f,(ahora-anterior)/1000.f);anterior=ahora;
  if(abajo&KEY_SELECT){juego.menu=true;juego.pausa=false;}
  if(juego.menu){if(abajo&(KEY_DLEFT|KEY_DRIGHT))juego.seleccionHeroe=1-juego.seleccionHeroe;if(abajo&KEY_A)juego.iniciar(juego.seleccionHeroe?MOHAMED:ADREIDA);}
  else if(juego.cartas){if(!juego.tirando&&!juego.resuelto){if(abajo&KEY_DLEFT)juego.elegida=(juego.elegida+2)%3;if(abajo&KEY_DRIGHT)juego.elegida=(juego.elegida+1)%3;}if(abajo&KEY_A){if(juego.resuelto){juego.cartas=false;juego.nivel=2;juego.mano=juego.bajas=0;juego.descanso=3;juego.h.vida=std::min(juego.h.maxVida,juego.h.vida+40);juego.avisar("Cobro de piso",3);}else juego.tirar(juego.elegida);}}
  else if(abajo&KEY_START){if(juego.derrota||juego.victoria)juego.iniciar(juego.h.tipo);else juego.pausa=!juego.pausa;}
  circlePosition palanca;hidCircleRead(&palanca);float x=palanca.dx/156.f,z=-palanca.dy/156.f;float mag=std::sqrt(x*x+z*z);V mov{};if(mag>.18f)mov=unidad({x,z})*limite((mag-.18f)/.82f,0,1);
  Entrada entrada{mov,(bool)(sostenido&KEY_A),(bool)(abajo&KEY_L),(bool)(abajo&KEY_B),(bool)(abajo&KEY_X),(bool)(abajo&KEY_Y),(bool)(abajo&KEY_DUP),(bool)(abajo&KEY_R)};juego.paso(dt,entrada);
  ui+=dt;if(ui>.15f||abajo){interfaz(juego);ui=0;}dibujar(juego);gspWaitForVBlank();
 }
 cerrarDibujo();C3D_Fini();romfsExit();gfxExit();return 0;}
