/* Pruebas de la simulación nativa con el mismo código que se compila para ARM11. */
#include "juego.hpp"
#include <cassert>
#include <cstdio>
using namespace Grietas;
int main(){
 Juego j;j.iniciar(ADREIDA);Entrada e;e.mov={1,0};V antes=j.h.p;for(int i=0;i<20;i++)j.pasoHeroe(.05f,e);assert(distancia(j.h.p,antes)>4.5f);
 e.ataque=true;e.mov={};j.pasoHeroe(.05f,e);antes=j.h.p;e.mov={1,0};for(int i=0;i<21;i++)j.pasoHeroe(.05f,e);assert(j.h.carga==1);assert(distancia(antes,j.h.p)<.001f);e.ataque=false;e.mov={};j.pasoHeroe(.016f,e);for(int i=0;i<12;i++)j.pasoHeroe(.016f,e);assert(j.h.estado==RECUPERA);antes=j.h.p;e.mov={1,0};for(int i=0;i<10;i++)j.pasoHeroe(.016f,e);assert(distancia(antes,j.h.p)<.001f);
 j.iniciar(ADREIDA);j.cds.fill(9);j.ultiRestante=55;j.h.estado=PARRANDO;j.h.t=.1f;j.invocar(TROLL,{0,3});auto&boss=j.enemigos[0];boss.segunda=true;float vida=boss.vida;j.danar(boss,100,j.h.p);assert(boss.vida==vida);j.herir(30,{0,3},&boss);assert(j.parrys==1);for(float cd:j.cds)assert(cd==0);assert(j.ultiRestante==54);j.danar(boss,100,j.h.p);assert(boss.vida<vida);
 j.iniciar(ADREIDA);j.h.p={-5,3};j.invocar(GOBLIN,{-5,-6});j.enemigos[0].dentro=true;j.enemigos[0].cd=100;for(int i=0;i<900;i++){j.pasoEnemigos(1.f/60);assert(distancia(j.enemigos[0].p,{-5,-3})>1.55f);}assert(distancia(j.enemigos[0].p,j.h.p)<3);
 j.iniciar(MOHAMED);j.h.p={0,0};j.invocar(GOBLIN,{0,-2});j.disparar(PI,9);for(int i=0;i<6;i++)j.pasoProyectiles(.016f);assert(j.enemigos[0].vida<34);
 j.iniciar(ADREIDA);j.oleada=3;j.descanso=0;j.paso(.05f,{});assert(j.cartas);assert(j.opciones[0].umbral==2);assert(j.opciones[0].castigo==0);j.tirar(0);for(int i=0;i<40;i++)j.paso(.05f,{});assert(j.resuelto&&j.dado>=1&&j.dado<=20);
 j.iniciar(ADREIDA);j.pausa=true;float t=j.tiempo;j.paso(.05f,e);assert(j.tiempo==t);
 int partidos=0;for(int i=0;i<1000;i++){Actor g;g.tipo=GOBLIN;g.vida=1;j.danar(g,100,{},true);partidos+=g.partido;}assert(partidos>270&&partidos<390);
 std::puts("OK: control, carga inmovil, recuperacion, parry, armadura, pozo, disparos, cartas, pausa y muerte partida");
}
