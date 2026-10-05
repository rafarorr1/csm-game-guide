/* Se ejecuta en el anfitrión con ASan/UBSan y el mismo código que usa ARM11. */
#include "juego.hpp"
#include <cassert>
#include <cstdio>
#include <chrono>
using namespace Grietas;
static bool cerca(float a,float b,float eps=.001f){return std::fabs(a-b)<eps;}
static void avanzar(Juego&j,float segundos,const Entrada&i={}){for(int n=0;n<int(std::ceil(segundos*60));n++)j.paso(1.f/60,i);}
static void control(){
 Juego j;j.iniciar(ADREIDA);Entrada e;e.mov={1,0};V antes=j.h.p;for(int i=0;i<20;i++)j.pasoHeroe(.05f,e);assert(distancia(j.h.p,antes)>4.5f);
 e.ataque=true;e.mov={};j.pasoHeroe(.05f,e);antes=j.h.p;e.mov={1,0};for(int i=0;i<21;i++)j.pasoHeroe(.05f,e);assert(j.h.carga==1);assert(distancia(antes,j.h.p)<.001f);e.ataque=false;e.mov={};j.pasoHeroe(.016f,e);for(int i=0;i<12;i++)j.pasoHeroe(.016f,e);assert(j.h.estado==RECUPERA);antes=j.h.p;e.mov={1,0};for(int i=0;i<10;i++)j.pasoHeroe(.016f,e);assert(distancia(antes,j.h.p)<.001f);
 j.iniciar(ADREIDA);j.h.estado=ATAQUE;j.h.carga=1;e={};e.parry=true;j.habilidad(e);assert(j.h.estado==PARRANDO&&j.h.carga==0);
 j.iniciar(ADREIDA);j.h.p={0,0};j.h.dir=0;j.furia=100;e={};e.salto=true;j.habilidad(e);e={};for(int i=0;i<45;i++)j.pasoHeroe(1.f/60,e);assert(j.h.estado==GUARDIA);assert(cerca(j.h.p.z,5));
 j.iniciar(ADREIDA);j.h.p={0,0};j.h.dir=0;j.furia=100;e.salto=true;j.habilidad(e);e={};e.mov={0,-1};for(int i=0;i<45;i++)j.pasoHeroe(1.f/60,e);assert(j.h.estado==GUARDIA);assert(j.h.p.z<4.4f&&j.h.p.z>3.8f);
}
static void ultis(){
 Juego j;Entrada e;e.ulti=true;j.iniciar(ADREIDA);j.habilidad(e);assert(cerca(j.ultiActivo,15)&&cerca(j.ultiRestante,100)&&j.tieneAliado);j.parry(nullptr);assert(cerca(j.ultiRestante,99));for(int i=0;i<899;i++)j.pasoHeroe(1.f/60,{});assert(j.tieneAliado);for(int i=0;i<3;i++)j.pasoHeroe(1.f/60,{});assert(!j.tieneAliado&&j.ultiActivo==0);
 j.iniciar(MOHAMED);j.habilidad(e);assert(j.ultiActivo==10&&j.ultiRestante==90&&!j.tieneAliado);j.h.p={0,0};j.invocar(GOBLIN,{0,1});j.enemigos[0].dir=0;j.enemigos[0].vida=100;Entrada a;a.ataque=true;j.pasoHeroe(.01f,a);assert(cerca(j.enemigos[0].vida,55));
}
static void navegación(){
 Juego j;j.iniciar(ADREIDA);j.h.p={-5,3};j.invocar(GOBLIN,{-5,-6});j.enemigos[0].dentro=true;j.enemigos[0].cd=100;for(int i=0;i<900;i++){j.pasoEnemigos(1.f/60);assert(distancia(j.enemigos[0].p,{-5,-3})>1.55f);}assert(distancia(j.enemigos[0].p,j.h.p)<3);
 // Obstáculo ancho entre agente y destino, donde el giro local se quedaba atrapado.
 j.choques={{{0,0},3.1f},{{1,-5},1.2f}};Actor a;a.p={0,-7};a.dentro=true;V fin{0,7};for(int k=0;k<1200;k++){j.rodear(a,fin,1.f/60,5,1);assert(distancia(a.p,{0,0})>=3.399f);}assert(distancia(a.p,fin)<.3f);
 // Adreidos también debe alcanzar a un enemigo al otro lado del pozo.
 j.iniciar(ADREIDA);j.tieneAliado=true;j.aliado=j.h;j.aliado.p={-5,-6};j.h.p={-5,4};j.invocar(ESCUDO,{-5,2});j.enemigos[0].cd=100;for(int k=0;k<450;k++)j.pasoEnemigos(1.f/60);assert(j.enemigos[0].vida<100);
}
static void bosses(){
 Juego j;j.iniciar(ADREIDA);j.cds.fill(9);j.ultiRestante=55;j.h.estado=PARRANDO;j.h.t=.1f;j.invocar(TROLL,{0,3});auto&boss=j.enemigos[0];boss.segunda=true;float vida=boss.vida;j.danar(boss,100,j.h.p);assert(boss.vida==vida);j.herir(30,{0,3},&boss);assert(j.parrys==1);for(float cd:j.cds)assert(cd==0);assert(j.ultiRestante==54);j.danar(boss,100,j.h.p);assert(boss.vida<vida);
 j.iniciar(ADREIDA);j.h.p={8,8};j.invocar(TROLL,{0,0});auto&t=j.enemigos[0];t.numero=1;t.estado=PREPARA;t.t=2;j.pasoEnemigos(.01f);assert(j.proyectiles.size()==7);for(const auto&p:j.proyectiles){assert(p.tipo==1);float r=distancia(p.destino,{0,0});assert(r>=2.09f&&r<=4.51f);}assert(j.avisoDur(t)>1.2f);t.segunda=true;assert(j.avisoDur(t)<1.2f);
 // Una piedra devuelta abre la armadura y daña al jefe que la lanzó.
 j.proyectiles.resize(1);auto&p=j.proyectiles[0];j.h.p=p.destino;j.h.estado=PARRANDO;j.h.t=.1f;p.t=p.dur-.01f;j.pasoProyectiles(.02f);assert(j.parrys==1&&t.expuesto>0&&t.vida<t.maxVida);
 j.iniciar(ADREIDA);j.h.p={0,0};j.invocar(CAN,{0,3});auto&can=j.enemigos[0];can.numero=2;can.dir=PI;can.estado=PREPARA;can.t=2;j.h.estado=PARRANDO;j.h.t=.05f;j.pasoEnemigos(.01f);assert(j.h.vida<j.h.maxVida&&j.parrys==0&&j.imparable(can));assert(cerca(j.avisoRadio(can),5.3f));
 j.iniciar(ADREIDA);j.h.p={0,0};j.invocar(CAN,{0,3});auto&c=j.enemigos[0];c.numero=0;c.dir=PI;c.estado=PREPARA;c.t=2;j.pasoEnemigos(.01f);assert(c.estado==ATAQUE);c.t=.3f;j.pasoEnemigos(.01f);assert(c.combo==1&&c.estado==PREPARA);assert(cerca(j.avisoDur(c),.55f));
 j.invocar(GOBLIN,{4,2});j.danar(j.enemigos[0],10000,j.h.p);assert(j.enemigos[1].estado==HUYENDO&&j.vivos()==0);for(int k=0;k<1000;k++)j.pasoEnemigos(1.f/60);assert(j.enemigos.empty());
}
static void armas(){
 Juego j;j.iniciar(MOHAMED);j.h.p={0,0};j.invocar(GOBLIN,{0,-2});j.disparar(PI,9);for(int i=0;i<6;i++)j.pasoProyectiles(.016f);assert(j.enemigos[0].vida<34);
 j.iniciar(MOHAMED);j.h.p={0,0};j.invocar(GOBLIN,{.8f,6});float dir=j.apuntar(0);assert(dir>.1f&&dir<.2f);j.choques={{{.4f,3},.8f}};assert(cerca(j.apuntar(0),0));
 j.iniciar(ADREIDA);j.h.p={0,0};j.h.dir=0;j.invocar(GOBLIN,{0,2.5f});j.enemigos[0].vida=100;j.lanzarBumeran();assert(j.bumeran);for(int i=0;i<15;i++)j.pasoProyectiles(1.f/60);assert(cerca(j.proyectiles[0].p.z,4));assert(cerca(j.enemigos[0].vida,82));j.h.dir=-PI*.5f;for(int i=0;i<15;i++)j.pasoProyectiles(1.f/60);assert(std::fabs(j.proyectiles[0].p.x)>.05f||j.proyectiles[0].p.z>4);for(int i=0;i<60;i++)j.pasoProyectiles(1.f/60);assert(!j.bumeran&&j.proyectiles.empty());
 // El dash mantiene daño y giro, y apaga el fuego en el mismo instante.
 j.iniciar(ADREIDA);j.h.p={0,0};j.h.estado=GIRANDO;j.h.t=.3f;j.fuegoT=5;j.fuegoTick=.8f;j.invocar(ESCUDO,{1.8f,0});Entrada e;e.dash=true;e.mov={1,0};j.habilidad(e);assert(j.h.estado==ESQUIVA&&j.giroRestante>0&&j.fuegoT==0);e={};for(int i=0;i<10;i++)j.pasoHeroe(1.f/60,e);assert(j.h.anim==GIRO&&j.enemigos[0].vida<100);assert(j.h.p.x>2.5f);
 // Una antorcha prende durante cinco segundos; un parry no debe prender al héroe.
 j.iniciar(ADREIDA);j.h.p={0,0};j.invocar(GOBLIN,{0,1});auto&a=j.enemigos[0];a.variante=3;a.numero=1;a.estado=PREPARA;a.t=2;a.dir=PI;j.pasoEnemigos(.01f);assert(j.fuegoT==5);float v=j.h.vida;for(int i=0;i<65;i++)j.pasoHeroe(1.f/60,{});assert(j.h.vida<v);
 j.iniciar(ADREIDA);j.h.p={0,0};j.h.dir=0;j.h.estado=PARRANDO;j.h.t=.05f;j.invocar(GOBLIN,{0,1});auto&b=j.enemigos[0];b.variante=3;b.numero=1;b.estado=PREPARA;b.t=2;b.dir=PI;j.pasoEnemigos(.01f);assert(j.fuegoT==0&&j.parrys==1);
 j.iniciar(ADREIDA);j.h.p={0,0};j.invocar(GOBLIN,{0,6});auto&g=j.enemigos[0];g.variante=0;g.numero=0;g.cd=0;j.pasoEnemigos(.01f);assert(g.combo==2&&g.estado==PREPARA);g.t=2;j.pasoEnemigos(.01f);assert(j.proyectiles.size()==1&&j.proyectiles[0].tipo==3);j.pasoProyectiles(.4f);assert(j.proyectiles[0].alto>2.5f);
}
static void cartasPuntos(){
 Juego j;j.iniciar(ADREIDA);for(int n=0;n<5;n++){Actor a;a.vida=1;a.p={float(n),0};j.danar(a,100,{});}int cartas=0;for(const auto&o:j.objetos)cartas+=o.tipo==1;assert(cartas==3);assert(j.score>=250&&j.multiplicador==2);j.paron=0;j.descanso=100;avanzar(j,3.1f);assert(j.multiplicador==0&&j.comboT==0);
 j.oleada=3;j.mano=3;j.descanso=0;j.paso(.05f,{});assert(j.cartas);assert(j.opciones[0].umbral==2&&j.opciones[0].castigo==0);j.tirar(0);for(int i=0;i<40;i++)j.paso(.05f,{});assert(j.resuelto&&j.dado>=1&&j.dado<=20);
 // El 1 elimina sólo beneficios: los castigos se conservan incluso si un buff
 // anterior los había ocultado en el multiplicador final.
 j.iniciar(ADREIDA);j.h.vida=60;j.elegida=0;j.opciones[0]={0,17,.5f,.1f};j.resolverCarta(20);assert(cerca(j.bonus[0],1.5f));j.resolverCarta(2);assert(cerca(j.bonus[0],1.35f));j.resolverCarta(1);assert(cerca(j.bonus[0],.9f));
 j.opciones[0]={2,17,.5f,.1f};j.resolverCarta(20);assert(cerca(j.h.maxVida,180)&&cerca(j.h.vida,90));j.resolverCarta(2);assert(cerca(j.h.maxVida,162)&&cerca(j.h.vida,81));j.resolverCarta(1);assert(cerca(j.h.maxVida,108)&&cerca(j.h.vida,54));
 j.opciones[0]={3,2,.08f,0};j.resolverCarta(2);assert(j.bonus[3]<1);j.resolverCarta(1);assert(cerca(j.bonus[3],1));
 j.cartas=true;j.resuelto=true;j.continuarCarta();assert(j.nivel==2&&!j.cartas&&j.mano==0&&j.objetos.empty());
}
static void historia(){
 Juego j;j.iniciar(ADREIDA);j.iniciarNivel(2);assert(j.nivel==2&&j.oleada==3);j.oleada=5;j.descanso=0;j.ultimaBaja={0,0};j.paso(.01f,{});assert(j.secuencia==ENTRADA_TROLL&&j.objetos.back().tipo==2);for(int n=0;n<1300&&j.secuencia==ENTRADA_TROLL;n++)j.paso(1.f/60,{});assert(j.secuencia==COMBATE&&j.oleada==6&&j.llave);assert(j.enemigos.size()==1&&j.enemigos[0].tipo==TROLL&&j.cola.size()==6);
 // Termina el jefe, no quedan oleadas invisibles ni otra pantalla de recompensas.
 j.cola.clear();j.enemigos.clear();j.descanso=0;j.paso(.01f,{});assert(j.secuencia==PLAZA_LIBRE);j.h.p=j.puertaCasa;j.paso(.01f,{});assert(j.secuencia==CASA_GOBLIN&&j.familiaViva);
 j.h.p={0,4.5f};j.secuenciaT=1;j.paso(.01f,{});assert(j.secuencia==EPILOGO_MAGO&&j.familiaViva);avanzar(j,17.4f);assert(j.crater>0&&j.alto(j.h)<0);avanzar(j,4);assert(j.secuencia==FIN_ALPHA&&j.victoria&&j.anuncio=="Fin de Alpha .01"&&j.negro==1);
 j.iniciar(ADREIDA);j.entrarCasa();j.h.p={0,-1};Entrada e;e.ataque=true;j.paso(.01f,e);assert(!j.familiaViva&&j.familia[0].estado==CAIDO&&j.familia[1].estado==CAIDO);int puntos=j.score;avanzar(j,2,e);assert(j.score==puntos);j.h.p={0,4.5f};j.paso(.01f,{});assert(j.secuencia==EPILOGO_MAGO);
}
static void limitesPausaMuerte(){
 Juego j;j.iniciar(ADREIDA);j.pausa=true;float t=j.tiempo;j.paso(.05f,{});assert(j.tiempo==t);j.pausa=false;j.herir(1000,{0,3});assert(j.derrota);for(int i=0;i<40;i++)j.paso(.05f,{});assert(j.h.anim==MUERTE&&j.h.k==1);assert(j.tiempo==t&&j.vivos()==0);
 int partidos=0;for(int i=0;i<1000;i++){Actor g;g.tipo=GOBLIN;g.vida=1;j.danar(g,100,{},true);partidos+=g.partido;}assert(partidos>270&&partidos<390);assert(j.objetos.size()<=MAX_OBJETOS&&j.efectos.size()<=MAX_EFECTOS);
 j.iniciar(ADREIDA);for(int n=0;n<1000;n++){j.invocar(GOBLIN,{float(n%10),float(n%7)});j.disparar(0,1);j.efecto({},1,1,1,0);}assert(j.enemigos.size()==MAX_ENEMIGOS&&j.proyectiles.size()==MAX_PROYECTILES&&j.efectos.size()==MAX_EFECTOS);
 // Simulación prolongada con entradas alternas y todos los tipos de enemigo.
 j.iniciar(ADREIDA);j.descanso=1000;j.h.vida=j.h.maxVida=100000;for(int n=0;n<14;n++)j.invocar(Tipo(GOBLIN+n%6),{float(n%5)*2-5,float(n/5)*3-5});
 for(int n=0;n<30000;n++){Entrada e;e.mov=frente(n*.003f);e.ataque=n%70<35;e.parry=n%37==0;e.dash=n%80==0;e.salto=n%350==0;e.giro=n%200==0;e.provoca=n%500==0;e.ulti=n%6500==0;j.paso(1.f/60,e);assert(std::isfinite(j.h.p.x)&&std::isfinite(j.h.p.z)&&std::isfinite(j.h.vida));assert(j.enemigos.size()<=MAX_ENEMIGOS&&j.proyectiles.size()<=MAX_PROYECTILES&&j.efectos.size()<=MAX_EFECTOS&&j.objetos.size()<=MAX_OBJETOS);}
}
int main(){auto t=std::chrono::steady_clock::now();control();ultis();navegación();bosses();armas();cartasPuntos();historia();limitesPausaMuerte();double ms=std::chrono::duration<double,std::milli>(std::chrono::steady_clock::now()-t).count();std::printf("OK: control, carga, parry, salto, ultis, rutas, Can, Troll, piedras, hachas, fuego, cartas, puntuacion, historia completa, limites y muerte (%.0f ms anfitrion)\n",ms);}
