/* Interfaz de latón y obsidiana para ambas pantallas. La partida conserva todo
   el espacio superior; las esferas, el mapa y las acciones viven abajo. */
#include "hud.hpp"
#include <citro2d.h>
#include <cstdio>
#include <algorithm>
#include <cmath>
#include <string>
namespace Grietas {
namespace {
C3D_RenderTarget* inferior=nullptr;
C3D_RenderTarget* cargaSuperior=nullptr;
C2D_TextBuf letras=nullptr;
bool iniciado=false,verMetricas=false,audioActivo=false;
float cuadros=0,escalaFuente=1;
const u32 fondo=C2D_Color32(8,16,22,255),panel=C2D_Color32(20,31,36,255),laton=C2D_Color32(187,155,96,255),marfil=C2D_Color32(237,225,199,255),gris=C2D_Color32(143,166,172,255);
u32 color(unsigned rgb,int a=255){return C2D_Color32((rgb>>16)&255,(rgb>>8)&255,rgb&255,a);}
void rect(float x,float y,float w,float h,u32 c){C2D_DrawRectSolid(x,y,0,w,h,c);}
void linea(float x,float y,float X,float Y,u32 c,float ancho=1){C2D_DrawLine(x,y,c,X,Y,c,ancho,0);}
// Los círculos triangulados funcionan también en emuladores sin textura procedural.
void circulo(float x,float y,float z,float radio,u32 c){
 const int pasos=radio>8?32:12;
 for(int i=0;i<pasos;i++){float a=TAU*i/pasos,b=TAU*(i+1)/pasos;C2D_DrawTriangle(x,y,c,x+std::cos(a)*radio,y+std::sin(a)*radio,c,x+std::cos(b)*radio,y+std::sin(b)*radio,c,z);}
}
void texto(const std::string& s,float x,float y,float tam=.42f,u32 c=marfil,bool centro=false,float maximo=300){
 tam*=escalaFuente;
 C2D_Text t;C2D_TextParse(&t,letras,s.c_str());float w,h;C2D_TextGetDimensions(&t,tam,tam,&w,&h);if(w>maximo){tam*=maximo/w;w=maximo;}
 C2D_DrawText(&t,C2D_WithColor,x-(centro?w*.5f:0),y,0,tam,tam,c);
}
void placa(float x,float y,float w,float h,bool activa=false){rect(x,y,w,h,activa?laton:color(0x435058));rect(x+1,y+1,w-2,h-2,panel);}
void titulo(const char* s){texto(s,160,7,.51f,marfil,true);linea(16,28,304,28,laton);}
void orbe(float x,float y,float cantidad,float maximo,bool alma,float tiempo){
 const float r=31;circulo(x,y,0,r+3,laton);circulo(x,y,0,r+1,color(0x070a11));
 circulo(x,y,0,r,color(alma?0x28131e:0x24201c));const float k=limite(cantidad/std::max(1.f,maximo),0,1),nivel=y+r-2*r*k;
 for(float yy=y-r;yy<y+r;yy+=2){float dy=yy-y+1,ancho=std::sqrt(std::max(0.f,r*r-dy*dy));if(yy+2<nivel)continue;const float brillo=(y+r-yy)/(2*r);int a=alma?int(125+65*brillo):int(130+80*brillo),b=alma?int(23+20*brillo):int(71+60*brillo),c=alma?int(54+30*brillo):int(13+24*brillo);rect(x-ancho,std::max(yy,nivel),ancho*2,yy+2-std::max(yy,nivel),C2D_Color32(a,b,c,255));}
 if(k>.04f&&k<.97f){float dy=nivel-y,ancho=std::sqrt(std::max(0.f,r*r-dy*dy));linea(x-ancho,nivel,x+ancho,nivel,color(alma?0xd97184:0xf4cf78,155));}
 circulo(x-10,y-13,0,5,color(0xffffff,15));char s[40];std::snprintf(s,sizeof(s),"%.0f",std::ceil(cantidad));texto(s,x+1,y-10,.59f,color(0x000000),true,54);texto(s,x,y-11,.59f,marfil,true,54);std::snprintf(s,sizeof(s),"de %.0f",maximo);texto(s,x,y+12,.28f,marfil,true,54);
 texto(alma?"ALMA":"FURIA",x,y+r+7,.31f,laton,true);(void)tiempo;
}
void mapa(const Juego& j){const float x=160,y=73,r=32;circulo(x,y,0,r+1,color(0x5a625b));circulo(x,y,0,r,panel);const float escala=1.03f;
 for(const auto&o:j.choques){if(largo(o.p)>25)continue;circulo(x+o.p.x*escala,y+o.p.z*escala,0,std::max(1.f,o.r*.65f),color(0x626452));}
 for(const auto&e:j.enemigos)if(e.estado!=CAIDO&&e.estado!=HUYENDO&&largo(e.p)<29)circulo(x+e.p.x*escala,y+e.p.z*escala,0,e.tipo==CAN||e.tipo==TROLL?2.2f:1.2f,color(0xca6354));
 for(const auto&o:j.objetos)if(o.tipo==1||o.tipo==2)circulo(x+o.p.x*escala,y+o.p.z*escala,0,1.4f,laton);
 const float hx=x+j.h.p.x*escala,hy=y+j.h.p.z*escala;circulo(hx,hy,0,2,color(0xe4e7d9));V v=frente(j.h.dir);linea(hx,hy,hx+v.x*5,hy+v.z*5,color(0xe4e7d9));
 texto(j.nivel==1?"EL ASEDIO":"COBRO DE PISO",160,113,.28f,gris,true);
}
void boton(int n,const char* tecla,const char* nombre,float cd,float total,bool sinRecurso=false){float x=12+(n%4)*75,y=135+(n/4)*37;placa(x,y,71,32);texto(tecla,x+5,y+3,.33f,laton);texto(nombre,x+37,y+5,.3f,sinRecurso?gris:marfil,true,46);
 if(cd>0){rect(x+3,y+24,65,3,color(0x0a1014));rect(x+3,y+24,65*limite(cd/total,0,1),3,laton);char s[12];std::snprintf(s,sizeof(s),"%.0f",std::ceil(cd));texto(s,x+62,y+15,.27f,gris,true);}else linea(x+5,y+27,x+65,y+27,color(sinRecurso?0x354449:0x568775));}
const char* atributos[]={"BÁSICOS","HABILIDADES","VIDA MÁXIMA","DASH","RITMO"};
void cartas(const Juego& j){titulo("EL DESTINO TIENE UN PRECIO");texto("Elige una carta; después tira el d20",160,33,.32f,gris,true);
 for(int n=0;n<3;n++){const Carta& c=j.opciones[n];float x=10+n*102;placa(x,54,96,107,n==j.elegida);texto(n==0?"PRUDENTE":n==1?"TEMERARIA":"DESCOMUNAL",x+48,61,.29f,n==j.elegida?laton:gris,true,88);circulo(x+48,92,0,16,color(0x354348));texto(std::to_string(c.atributo+1),x+48,82,.6f,laton,true);texto(atributos[c.atributo],x+48,115,.29f,marfil,true,88);char s[48];std::snprintf(s,sizeof(s),"%d–20: %c%.0f%%",c.umbral,c.atributo==3?'-':'+',c.premio*100);texto(s,x+48,129,.31f,color(0xa4cda6),true);if(c.umbral>2){std::snprintf(s,sizeof(s),"2–%d: %c%.0f%%",c.umbral-1,c.atributo==3?'+':'-',c.castigo*100);texto(s,x+48,143,.28f,color(0xde9b8d),true);}else texto("2–20 siempre suma",x+48,143,.27f,color(0xa4cda6),true);}
 const float cy=184,rr=17;for(int i=0;i<6;i++){float a=TAU*i/6-PI/2,b=TAU*(i+1)/6-PI/2;linea(160+std::cos(a)*rr,cy+std::sin(a)*rr,160+std::cos(b)*rr,cy+std::sin(b)*rr,laton);}
 texto(j.tirando||j.resuelto?std::to_string(j.dado):"?",160,172,.6f,marfil,true);texto("1: pierdes los buffs; conservas los riesgos",160,207,.28f,color(0xde9b8d),true,310);
 texto(j.resuelto?"A · Continuar":j.tirando?"El d20 está rodando…":"← / → · Elegir     A · Tirar",160,223,.31f,marfil,true,310);
}
void menu(const Juego& j){titulo("CAOZ ARPG");texto("ALPHA .01 · EDICIÓN 3DS",160,34,.31f,laton,true);texto("Una ciudad. Dos destinos.",160,60,.44f,marfil,true);
 for(int n=0;n<2;n++){float x=15+n*151;placa(x,91,139,65,n==j.seleccionHeroe);texto(n==0?"ADREIDA":"MOHAMED",x+69,103,.45f,marfil,true);texto(n==0?"Hacha, furia y parry":"Pólvora y sombras",x+69,129,.31f,gris,true);}
 texto("← / → · Elegir     Y · Etapa 2",160,176,.33f,gris,true);placa(67,201,186,28,true);texto("A · Entrar a Tomsage",160,205,.41f,marfil,true);
}
void pausa(const Juego& j){titulo(j.derrota?"HAS CAÍDO":"UN RESPIRO");texto(j.derrota?"La plaza aún te necesita.":"La tormenta puede esperar.",160,49,.44f,marfil,true);texto(j.derrota?"START · Volver a intentarlo":"A / START · Continuar",160,91,.43f,marfil,true);texto("B · Elegir personaje",160,119,.4f,gris,true);texto(audioActivo?"X · Silenciar sonido":"X · Activar sonido",160,148,.36f,gris,true);texto(verMetricas?"Y · Ocultar rendimiento":"Y · Ver rendimiento",160,175,.36f,gris,true);texto("L + R + START · Salir",160,214,.32f,laton,true);}
}
bool iniciarHUD(){iniciado=C2D_Init(2048);if(!iniciado)return false;letras=C2D_TextBufNew(4096);inferior=C2D_CreateScreenTarget(GFX_BOTTOM,GFX_LEFT);cargaSuperior=C2D_CreateScreenTarget(GFX_TOP,GFX_LEFT);if(!letras||!inferior||!cargaSuperior)return false;
 // La fuente de sustitución del emulador puede tener otra altura que la consola.
 CFNT_s* fuente=fontGetSystemFont();const float celda=fontGetGlyphInfo(fuente)->cellHeight,altura=fontGetInfo(fuente)->height;escalaFuente=limite(1.2f*celda/(altura>0?altura:celda),1.1f,1.6f);return true;}
void cerrarHUD(){if(letras)C2D_TextBufDelete(letras);if(inferior)C3D_RenderTargetDelete(inferior);if(cargaSuperior)C3D_RenderTargetDelete(cargaSuperior);if(iniciado)C2D_Fini();letras=nullptr;inferior=cargaSuperior=nullptr;iniciado=false;}
void metricasHUD(float fps,bool visible,bool sonido){cuadros=fps;verMetricas=visible;audioActivo=sonido;}
int tocarHUD(int x,int y){if(x<12||x>=308||y<135||y>=204)return -1;int fila=(y-135)/37,col=(x-12)/75;if((y-135)%37>=32||(x-12)%75>=71)return -1;return fila*4+col;}
void cargaHUD(float progreso,const char* mensaje){if(!iniciado||!inferior||!cargaSuperior||!letras)return;C3D_FrameBegin(C3D_FRAME_SYNCDRAW);C2D_Prepare();C2D_TextBufClear(letras);C2D_TargetClear(cargaSuperior,fondo);C2D_SceneBegin(cargaSuperior);texto("CAOZ ARPG",200,76,.98f,marfil,true);texto("AL OTRO LADO DE LA MURALLA",200,119,.37f,laton,true);rect(72,166,256,3,panel);rect(72,166,256*limite(progreso,0,1),3,laton);C2D_TargetClear(inferior,fondo);C2D_SceneBegin(inferior);titulo("PREPARANDO TOMSAGE");texto(mensaje,160,101,.43f,marfil,true,294);texto("Modelos, texturas y sonido desde tu SD",160,202,.3f,gris,true);C3D_FrameEnd(0);}
void errorHUD(const char* mensaje){cargaHUD(0,mensaje);}
void dibujarHUDSuperior(Juego& j,C3D_RenderTarget* pantalla){C2D_Prepare();C2D_TextBufClear(letras);C2D_SceneBegin(pantalla);
 if(j.secuencia==FIN_ALPHA){rect(0,0,400,240,color(0x000000));texto("Fin de Alpha .01",200,105,.8f,marfil,true);return;}
 if(j.menu){rect(0,0,400,30,color(0x060d12,180));texto("LA PLAZA DE TOMSAGE",200,8,.39f,marfil,true);return;}
 if(j.secuencia==ENTRADA_TROLL||j.secuencia==EPILOGO_MAGO){rect(0,0,400,15,color(0x020306));rect(0,225,400,15,color(0x020306));return;}
 const Actor* jefe=nullptr;for(const auto&e:j.enemigos)if((e.tipo==CAN||e.tipo==TROLL)&&e.estado!=CAIDO)jefe=&e;
 if(jefe){rect(89,7,222,27,color(0x050d12,215));texto(jefe->tipo==CAN?"CAN, EL DE LOS GOBLINS":jefe->segunda?"EL RECAUDADOR · ARMADURA":"EL RECAUDADOR",200,9,.3f,marfil,true);rect(95,26,210,3,color(0x443d3e));rect(95,26,210*limite(jefe->vida/jefe->maxVida,0,1),3,color(jefe->segunda&&jefe->expuesto<=0?0x9188bd:0xc95a53));}
 if(j.multiplicador>0){texto("×"+std::to_string(j.multiplicador),370,43,.54f,laton,true);rect(338,65,55*limite(j.comboT/3,0,1),2,laton);}
 if(j.anuncioT>0){rect(40,212,320,20,color(0x080e16,200));texto(j.anuncio,200,216,.32f,marfil,true,310);}
}
void dibujarHUD(Juego& j){C2D_TargetClear(inferior,fondo);C2D_SceneBegin(inferior);
 if(j.secuencia==FIN_ALPHA){titulo("CAOZ ARPG");texto("Gracias por jugar",160,86,.65f,marfil,true);texto("START · Volver a Tomsage",160,169,.4f,gris,true);return;}
 if(j.menu){menu(j);return;}if(j.pausa||j.derrota){pausa(j);return;}if(j.cartas){cartas(j);return;}
 texto(j.h.tipo==ADREIDA?"ADREIDA":"MOHAMED",12,7,.46f,marfil);char s[80];std::snprintf(s,sizeof(s),"%06d",j.score);texto(s,260,8,.4f,laton,true);linea(12,28,308,28,color(0x5b604f));orbe(51,74,j.h.vida,j.h.maxVida,true,j.tiempo);orbe(269,74,j.furia,100,false,j.tiempo);mapa(j);
 boton(0,"A",j.h.tipo==ADREIDA?"Ataque":"Disparo",j.cadencia,.24f);boton(1,"L","Parry",j.cds[0],.5f);boton(2,"B","Dash",j.cds[1],1.05f*j.bonus[3]);boton(3,"X","Salto",j.cds[2],5,j.furia<25);boton(4,"Y",j.h.tipo==ADREIDA?"Giro":"Abanico",j.cds[3],1,j.furia<30);boton(5,"↑",j.h.tipo==ADREIDA?"Búmeran":"Provocar",j.cds[4],10);boton(6,"R",j.h.tipo==ADREIDA?"Adreidos":"Sigilo",j.ultiRestante,j.h.tipo==ADREIDA?100:90);boton(7,"ST","Pausa",0,1);
 if(j.secuencia==CASA_GOBLIN)texto("A · Un golpe     Puerta · Salir",160,216,.33f,gris,true,307);
 else if(j.secuencia==PLAZA_LIBRE)texto("La llave abre una casa de la plaza",160,216,.33f,laton,true,307);
 else if(j.fuegoT>0)texto("EN LLAMAS · Haz dash para apagarte",160,216,.33f,color(0xf4a86d),true,307);
 else{std::snprintf(s,sizeof(s),"Nivel %d  ·  Oleada %d  ·  Cartas %d / 3",j.nivel,std::max(1,j.nivel==1?j.oleada+1:j.oleada-3),j.mano);texto(s,160,216,.32f,gris,true);}
 if(verMetricas){rect(0,0,320,26,color(0x02070a));std::snprintf(s,sizeof(s),"%.0f fps | CPU %.1f / GPU %.1f ms | %.1f MB libres",cuadros,C3D_GetProcessingTime(),C3D_GetDrawingTime(),linearSpaceFree()/1048576.f);texto(s,160,7,.29f,marfil,true,312);}
}
}
