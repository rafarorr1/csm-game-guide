/* Combate nativo de la adaptación 3DS. Simulación independiente del dibujado. */
#include "juego.hpp"
#include <algorithm>
namespace Grietas {
struct Datos {float vida,dano,vel,aviso,recupera,cd,alcance;};
static const Datos datos[]={{120,12,5,.3f,.3f,0,2.05f},{100,9,5,.24f,1.1f,0,15},{34,13,2.85f,.85f,.8f,1.35f,2},{26,16,2.65f,1.1f,.8f,2.4f,11},{100,24,2.85f,.85f,.8f,1.15f,2.5f},{800,32,2.5f,1.05f,1.05f,1.35f,4.6f},{1100,30,1.85f,1.3f,1.5f,1.6f,3.8f},{46,15,2.7f,.95f,.9f,1.5f,2}};
static const float calles[]={-PI/2,PI/6,PI*5/6};
Juego::Juego(){iniciar(ADREIDA);menu=true;}
float Juego::azar(){semilla=semilla*1664525u+1013904223u;return(semilla>>8)*(1.f/16777216.f);}
void Juego::avisar(const std::string&s,float d){anuncio=s;anuncioT=d;}
void Juego::iniciar(Tipo tipo){h=Actor{};h.tipo=tipo;h.vida=h.maxVida=datos[tipo].vida;h.p={0,4};h.dir=PI;h.dentro=true;aliado=Actor{};tieneAliado=false;tiempo=furia=ultiRestante=ultiActivo=sacudida=paron=recarga=cadencia=0;cds.fill(0);bonus.fill(1);enemigos.clear();proyectiles.clear();objetos.clear();efectos.clear();cola.clear();choques={{{-5,-3},1.3f},{{-2.82f,-2.51f},.55f},{{6.5f,-5.5f},1.5f},{{-8.3f,5.5f},1.1f},{{8.5f,4.8f},1},{{-3.5f,7.5f},.4f},{{4.5f,-10},.4f}};
 for(int i=0;i<15;i++){float a=i*TAU/15;bool puerta=false;for(float c:calles)if(std::fabs(delta(a,c))<.3f)puerta=true;if(!puerta)choques.push_back({{std::cos(a)*19.2f,std::sin(a)*19.2f},3.1f});}
 oleada=-1;nivel=1;mano=bajas=parrys=0;descanso=1.8f;proximaEntrada=0;menu=pausa=derrota=victoria=cartas=tirando=resuelto=false;balas=6;avisar("Las Grietas del Editor",3);}
int Juego::vivos()const{return std::count_if(enemigos.begin(),enemigos.end(),[](const Actor&e){return e.estado!=CAIDO;});}
void Juego::cambiar(Actor&a,Estado e){a.estado=e;a.t=0;a.impacto=false;}
void Juego::efecto(V p,int tipo,float radio,float dur,uint32_t color){if(efectos.size()>=80)efectos.erase(efectos.begin());efectos.push_back({p,0,dur,radio,color,tipo});}
void Juego::invocar(Tipo t,V p){Actor e;e.tipo=t;e.p=p;e.dir=angulo(h.p-p);e.vida=e.maxVida=datos[t].vida;e.cd=.7f;e.numero=(int)(azar()*1000);enemigos.push_back(e);}
bool Juego::libre(V a,V b,float r)const{V d=b-a;float l=d.x*d.x+d.z*d.z;for(const auto&o:choques){float u=l?limite(((o.p.x-a.x)*d.x+(o.p.z-a.z)*d.z)/l,0,1):0;if(distancia(a+d*u,o.p)<o.r+r)return false;}return true;}
void Juego::mover(Actor&a,V paso,bool borde){V p=a.p+paso;for(const auto&o:choques){V d=p-o.p;float l=largo(d),r=o.r+(a.tipo==TROLL?.7f:.3f);if(l<r)p=o.p+(l>.001f?d*(r/l):V{r,0});}if(borde){float l=largo(p);if(l>25.4f)p=p*(25.4f/l);}a.p=p;}
V Juego::rodear(Actor&a,V destino,float dt,float vel,int lado){V d=unidad(destino-a.p);if(largo(d)<.1f)return{};float rumbo=angulo(d),mejor=1e9f;V salida{};for(float giro:{0.f,.4f,-.4f,.8f,-.8f,1.3f,-1.3f,1.8f,-1.8f}){V v=frente(rumbo+giro),p=a.p+v*.75f;if(!libre(a.p,p,.35f))continue;float coste=distancia(p,destino)+std::fabs(giro)*.06f+(giro*lado<0?.05f:0);for(const auto&o:enemigos)if(&o!=&a&&o.estado!=CAIDO)coste+=std::fmax(0.f,.8f-distancia(p,o.p))*.5f;if(coste<mejor){mejor=coste;salida=v;}}V antes=a.p;mover(a,salida*(dt*vel),a.dentro);if(largo(a.p)<24.5f)a.dentro=true;V mov=a.p-antes;a.fase+=largo(mov)/1.3f;a.dir+=delta(a.dir,angulo(destino-a.p))*std::fmin(1.f,dt*8);return mov;}
void Juego::danar(Actor&a,float dano,V origen,bool fuerte){if(a.estado==CAIDO)return;if(a.tipo==TROLL&&a.segunda&&a.expuesto<=0){efecto(a.p,1,1,.2f,0x8877ff);return;}if(a.expuesto>0)dano*=2;if(a.tipo==TROLL&&!a.segunda&&a.vida-dano<a.maxVida*.5f)dano=a.vida-a.maxVida*.5f;
 a.vida-=dano;a.flash=.16f;a.empuje=unidad(a.p-origen)*(fuerte?13.f:2.f);furia=std::fmin(100.f,furia+4);paron=std::fmax(paron,fuerte?.055f:.035f);efecto(a.p,1,fuerte?1:.5f,.25f,0xffd28a);
 if(a.vida<=0){a.vida=0;cambiar(a,CAIDO);a.partido=fuerte&&(a.tipo==GOBLIN||a.tipo==COBRADOR)&&azar()<.33f;bajas++;if(mano<3&&(bajas==1||bajas==3||bajas==5))objetos.push_back({a.p,1});if(azar()<.22f)objetos.push_back({a.p,0});if(a.tipo==CAN)avisar("Can ha caido");}
 else if(a.tipo==TROLL&&!a.segunda&&a.vida<=a.maxVida*.5f){a.segunda=true;a.cd=.3f;avisar("Armadura: haz Parry para herirlo",3);}
 else if(a.tipo!=CAN&&a.tipo!=TROLL&&a.tipo!=ESCUDO){cambiar(a,ATURDIDO);a.espera=fuerte?.6f:.2f;}}
void Juego::parry(Actor*e){parrys++;furia=std::fmin(100.f,furia+20);cds.fill(0);ultiRestante=std::fmax(0.f,ultiRestante-1);h.flash=.3f;sacudida=.2f;efecto(h.p,2,2,.25f,0xffda55);avisar("Parry",.75f);if(e&&e->estado!=CAIDO){cambiar(*e,ATURDIDO);e->espera=e->tipo==TROLL?2.5f:e->tipo==CAN?1.f:2.f;e->expuesto=e->espera;}}
void Juego::herir(float dano,V origen,Actor*e,bool imparable){if(h.invul>0||h.vida<=0)return;bool deFrente=std::fabs(delta(h.dir,angulo(origen-h.p)))<1.8f;if(!imparable&&h.estado==PARRANDO&&deFrente){if(h.t<=.18f){parry(e);return;}dano*=.3f;}h.vida-=dano;h.flash=.2f;h.invul=.28f;h.empuje=unidad(h.p-origen)*3;sacudida=.25f;furia=std::fmin(100.f,furia+8);if(h.vida<=0){h.vida=0;derrota=true;cambiar(h,CAIDO);avisar("Has caido. START: reiniciar",10);}}
void Juego::area(float radio,float apertura,float dano,float fuerza,bool fuerte){bool impacto=false;for(auto&e:enemigos)if(e.estado!=CAIDO&&distancia(e.p,h.p)<radio+.3f&&std::fabs(delta(h.dir,angulo(e.p-h.p)))<=apertura&&libre(h.p,e.p,.05f)){danar(e,dano,h.p,fuerte);e.empuje=unidad(e.p-h.p)*fuerza;impacto=true;}if(impacto||fuerte)sacudida=std::fmax(sacudida,fuerte?.6f:.17f);}
void Juego::onda(float radio,float dano){for(auto&e:enemigos)if(e.estado!=CAIDO&&distancia(e.p,h.p)<radio)danar(e,dano,h.p);efecto(h.p,2,radio,.35f,0xd7b985);}
void Juego::disparar(float dir,float dano){if(proyectiles.size()>=60)return;Proyectil p;p.p=h.p+frente(dir)*.5f;p.origen=p.p;p.vel=frente(dir)*30;p.dur=.5f;p.dano=dano;proyectiles.push_back(p);}
void Juego::atacar(bool cargado){h.carga=cargado?limite((h.t-.18f)/.72f,0,1):0;cambiar(h,ATAQUE);h.t=.228f;h.combo=h.carga>=.5f?0:h.combo%3;}
void Juego::habilidad(const Entrada&i){if(h.vida<=0)return;
 if(i.parry&&cds[0]<=0&&h.estado!=SALTANDO&&h.estado!=ESQUIVA){h.carga=0;cambiar(h,PARRANDO);cds[0]=.5f;return;}
 bool libreH=h.estado==GUARDIA||h.estado==CARGA;if(!libreH)return;
 if(i.dash&&cds[1]<=0){h.destino=unidad(i.mov);if(largo(h.destino)<.1f)h.destino=frente(h.dir);cambiar(h,ESQUIVA);h.invul=.23f;cds[1]=1.05f*bonus[3];}
 else if(i.salto&&cds[2]<=0&&furia>=25){h.origen=h.p;h.destino=h.p+frente(h.dir)*5;cambiar(h,SALTANDO);h.invul=.73f;furia-=25;cds[2]=5;}
 else if(i.giro&&cds[3]<=0&&furia>=30){furia-=30;cds[3]=1;if(h.tipo==MOHAMED){for(int k=-3;k<=3;k++)disparar(h.dir+k*.13f,9*bonus[0]);}else cambiar(h,GIRANDO);}
 else if(i.provoca&&cds[4]<=0){cds[4]=10;for(auto&e:enemigos)if(e.estado!=CAIDO&&distancia(e.p,h.p)<7)e.empuje=unidad(h.p-e.p)*6;efecto(h.p,2,7,.4f,0xffdc55);}
 else if(i.ulti&&ultiRestante<=0){ultiRestante=90;ultiActivo=h.tipo==ADREIDA?30:10;if(h.tipo==ADREIDA){aliado=h;aliado.p.x+=1.5f;aliado.vida=120;aliado.estado=GUARDIA;aliado.t=0;tieneAliado=true;avisar("Adreidos, a mi lado",2);}else avisar("Sigilo: busca sus espaldas",2);}}
void Juego::pasoHeroe(float dt,const Entrada&i){h.t+=dt;h.flash=std::fmax(0.f,h.flash-dt);h.invul=std::fmax(0.f,h.invul-dt);for(auto&cd:cds)cd=std::fmax(0.f,cd-dt);ultiRestante=std::fmax(0.f,ultiRestante-dt);ultiActivo=std::fmax(0.f,ultiActivo-dt);if(ultiActivo<=0)tieneAliado=false;
 if(largo(h.empuje)>.05f){mover(h,h.empuje*dt);h.empuje=h.empuje*std::exp(-dt*9);}habilidad(i);
 if(h.estado==GUARDIA){V mov=i.mov;if(largo(mov)>.1f){h.dir=angulo(mov);V antes=h.p;mover(h,mov*(5*bonus[4]*dt));h.fase+=distancia(h.p,antes)/2.55f;h.anim=CORRER;}else h.anim=REPOSO;
  if(i.ataque){if(h.tipo==ADREIDA)cambiar(h,CARGA);else if(cadencia<=0&&recarga<=0){if(ultiActivo>0){Actor*blanco=nullptr;for(auto&e:enemigos)if(e.estado!=CAIDO&&distancia(e.p,h.p)<2){blanco=&e;break;}if(blanco){bool espalda=std::fabs(delta(blanco->dir,angulo(h.p-blanco->p)))>PI*.6f;danar(*blanco,9*bonus[0]*(espalda?5:1.5f),h.p);efecto(h.p,1,1,.3f,0x69baff);}cadencia=.4f;}
   else{if(balas>0){disparar(h.dir,9*bonus[0]);balas--;cadencia=.24f;if(!balas)recarga=1.1f;}}}}
 }else if(h.estado==CARGA){h.carga=limite((h.t-.18f)/.72f,0,1);if(largo(i.mov)>.1f)h.dir=angulo(i.mov);if(!i.ataque)atacar(true);}
 else if(h.estado==ATAQUE){float dur=h.combo==2?.8f:.6f,imp=h.combo==2?.39f:.3f;if(h.carga>.5f)mover(h,frente(h.dir)*(dt*2.5f*h.carga));if(!h.impacto&&h.t>=imp){h.impacto=true;area((h.combo==2?2.7f:2.05f)+h.carga*.65f,h.combo==2?.5f:1.1f,12*bonus[0]*(h.combo==2?1.8f:1)*(1+2*h.carga),2+16*h.carga,h.carga>=1);efecto(h.p,3,2+h.carga,.24f,0xe6af51);}if(h.t>=dur*.64f&&h.carga>=1)cambiar(h,RECUPERA);else if(h.t>=dur){h.combo=(h.combo+1)%3;cambiar(h,GUARDIA);}}
 else if(h.estado==RECUPERA){if(h.t>=.3f){h.combo=0;h.carga=0;cambiar(h,GUARDIA);}}
 else if(h.estado==PARRANDO){if(h.t>=.35f)cambiar(h,GUARDIA);}
 else if(h.estado==ESQUIVA){mover(h,h.destino*(17*dt));if(h.t>=.23f)cambiar(h,GUARDIA);}
 else if(h.estado==SALTANDO){float k=limite(h.t/.72f,0,1);V n=frente(h.dir);float atraso=limite(-(i.mov.x*n.x+i.mov.z*n.z),0,1);V destino=h.destino-n*(atraso*.8f);V p=h.origen+(destino-h.origen)*k;mover(h,p-h.p);if(k>=1){if(h.tipo==ADREIDA){onda(3,30*bonus[1]);efecto(h.p,4,1.05f,5,0x201a17);for(int j=0;j<12;j++)efecto(h.p+frente(j*TAU/12)*(.8f+azar()*1.5f),5,.18f,.6f+azar(),0x7c7165);sacudida=.8f;paron=.07f;}else for(auto&e:enemigos)if(distancia(e.p,h.p)<6&&e.estado!=CAIDO){cambiar(e,ATURDIDO);e.espera=e.tipo==CAN?1.2f:2.6f;}cambiar(h,GUARDIA);}}
 else if(h.estado==GIRANDO){h.dir+=dt*15;mover(h,i.mov*(dt*2));if((int)(h.t*6)!=(int)((h.t-dt)*6))onda(2.8f,9*bonus[1]);if(h.t>=1.1f)cambiar(h,GUARDIA);}
 cadencia=std::fmax(0.f,cadencia-dt);if(recarga>0){recarga-=dt;if(recarga<=0)balas=6;}
 for(auto it=objetos.begin();it!=objetos.end();){if(distancia(it->p,h.p)<.85f){if(it->tipo==1){mano=std::min(3,mano+1);avisar("Carta encontrada",1);}else h.vida=std::fmin(h.maxVida,h.vida+22);it=objetos.erase(it);}else ++it;}
 animar(h,true);
}
void Juego::pasoEnemigos(float dt){int presion=0;for(auto&e:enemigos)if(e.estado==PREPARA||e.estado==ATAQUE)presion++;
 for(auto&e:enemigos){auto d=datos[e.tipo];e.t+=dt;e.cd-=dt;e.flash=std::fmax(0.f,e.flash-dt);e.expuesto=std::fmax(0.f,e.expuesto-dt);if(e.estado==CAIDO){mover(e,e.empuje*dt);e.empuje=e.empuje*std::exp(-dt*4);animar(e);continue;}
 if(largo(e.empuje)>.1f){mover(e,e.empuje*dt);e.empuje=e.empuje*std::exp(-dt*7);}if(e.segunda){d.vel*=1.2f;d.aviso*=.85f;d.recupera*=.85f;}
 float dist=distancia(e.p,h.p);bool sigilo=h.tipo==MOHAMED&&ultiActivo>0;
 if(e.estado==GUARDIA){if(e.tipo==CAN&&!e.llamado&&e.vida<e.maxVida*.5f){e.llamado=true;cambiar(e,LLAMA);avisar("A mi, goblins!",2);}else if(!sigilo){float radio=e.tipo==KOBOLD?6.f:(presion<2?d.alcance*.65f:4.4f);V destino=h.p+unidad(e.p-h.p)*radio;
   if(h.estado==CARGA&&h.carga>.6f&&dist<3&&e.tipo==GOBLIN)destino=e.p+frente(h.dir+(e.numero%2?1:-1)*PI*.5f)*1.4f;
   V mov{};if(distancia(destino,e.p)>.25f)mov=rodear(e,destino,dt,d.vel,e.numero%2?1:-1);e.anim=largo(mov)>.001f?CORRER:REPOSO;
   if(dist<d.alcance&&e.cd<=0&&presion<2&&libre(e.p,h.p,.04f)){e.dir=angulo(h.p-e.p);cambiar(e,PREPARA);presion++;e.origen=h.p;}}
 }else if(e.estado==LLAMA){if(e.t>=.9f){for(int j=0;j<12;j++)cola.push_back(GOBLIN);proximaEntrada=0;cambiar(e,GUARDIA);}}
 else if(e.estado==PREPARA){float aviso=e.tipo==CAN&&e.combo==1?.55f:d.aviso;if(e.t<aviso*.5f)e.dir+=delta(e.dir,angulo(h.p-e.p))*std::fmin(1.f,dt*3);if(e.t>=aviso){
   if(e.tipo==KOBOLD){Proyectil p;p.enemigo=true;p.p=e.p;p.origen=e.p;p.vel=frente(e.dir)*11;p.dur=1.7f;p.dano=d.dano;proyectiles.push_back(p);}
   else if(e.tipo==TROLL&&e.numero%3==2){Proyectil p;p.enemigo=true;p.p=e.p;p.origen=e.p;p.destino=h.p;p.tipo=2;p.dur=1.4f;p.radio=1;p.dano=24;proyectiles.push_back(p);}
   else {float ang=std::fabs(delta(e.dir,angulo(h.p-e.p)));bool centro=e.tipo==CAN&&e.combo==0,lad=e.tipo==CAN&&e.combo==1;bool impacto=dist<d.alcance&&(lad?(ang>PI/6&&ang<PI/2):ang<(centro?PI/6:1.1f));bool mazazo=e.tipo==TROLL&&e.numero%3==1;
    if(mazazo){impacto=dist<3.5f;for(int j=0;j<5;j++){Proyectil p;p.enemigo=true;p.origen=e.p;p.p=e.p;p.destino=h.p+frente(j*TAU/5)*(j?2.5f:0);p.tipo=1;p.dur=1.45f+j*.12f;p.radio=.85f;p.dano=22;proyectiles.push_back(p);}efecto(e.p,2,3.5f,.35f,0xe38b59);}
    if(impacto)herir(d.dano,e.p,&e,mazazo);
   }if(e.estado==PREPARA)cambiar(e,ATAQUE);}}
 else if(e.estado==ATAQUE&&e.t>.22f){if(e.tipo==CAN&&e.combo==0){e.combo=1;cambiar(e,PREPARA);}else{e.combo=0;e.numero++;cambiar(e,RECUPERA);}}
 else if(e.estado==RECUPERA&&e.t>=d.recupera){e.cd=d.cd;cambiar(e,GUARDIA);}
 else if(e.estado==ATURDIDO&&e.t>=e.espera)cambiar(e,GUARDIA);
 animar(e);
 }
 for(size_t i=0;i<enemigos.size();i++)for(size_t j=i+1;j<enemigos.size();j++){auto&a=enemigos[i];auto&b=enemigos[j];if(a.estado==CAIDO||b.estado==CAIDO)continue;V v=b.p-a.p;float d=largo(v);if(d>.001f&&d<.65f){V emp=v*((.65f-d)*.5f/d);mover(a,emp*-1,a.dentro);mover(b,emp,b.dentro);}}
 enemigos.erase(std::remove_if(enemigos.begin(),enemigos.end(),[](const Actor&e){return e.estado==CAIDO&&e.t>2.5f;}),enemigos.end());
 if(tieneAliado){aliado.t+=dt;aliado.cd-=dt;Actor*blanco=nullptr;for(auto&e:enemigos)if(e.estado!=CAIDO&&(!blanco||distancia(e.p,aliado.p)<distancia(blanco->p,aliado.p)))blanco=&e;
  if(blanco){aliado.dir=angulo(blanco->p-aliado.p);if(distancia(aliado.p,blanco->p)>2){rodear(aliado,blanco->p,dt,5,1);aliado.anim=CORRER;}else if(aliado.cd<=0){danar(*blanco,16,aliado.p);aliado.cd=.8f;cambiar(aliado,ATAQUE);}if(aliado.estado==ATAQUE){aliado.anim=GOLPE;aliado.k=limite(aliado.t/.6f,0,1);if(aliado.t>.6f)cambiar(aliado,GUARDIA);}}}
}
void Juego::pasoProyectiles(float dt){for(auto it=proyectiles.begin();it!=proyectiles.end();){auto&p=*it;p.t+=dt;bool borrar=p.t>=p.dur;
 if(p.tipo){float k=limite(p.t/p.dur,0,1);p.p=p.origen+(p.destino-p.origen)*k;p.alto=4*(p.tipo==2?2.5f:4.5f)*k*(1-k);if(borrar){bool devuelto=false;if(p.enemigo&&distancia(p.p,h.p)<p.radio+.3f){if(h.estado==PARRANDO&&h.t<=.25f){Actor*boss=nullptr;for(auto&e:enemigos)if(e.tipo==TROLL&&e.estado!=CAIDO){boss=&e;break;}parry(boss);if(boss)danar(*boss,45,h.p);devuelto=true;}else herir(p.dano,p.origen);}if(p.tipo==2&&!devuelto&&vivos()<14){invocar(COBRADOR,p.p);cambiar(enemigos.back(),ATURDIDO);enemigos.back().espera=1.2f;}efecto(p.p,2,p.radio,.25f,0xe5b375);}}
 else {V antes=p.p;p.p=p.p+p.vel*dt;if(!libre(antes,p.p,.08f))borrar=true;
  auto toca=[&](V q,float radio){V d=p.p-antes;float l=d.x*d.x+d.z*d.z,k=l?limite(((q.x-antes.x)*d.x+(q.z-antes.z)*d.z)/l,0,1):0;return distancia(q,antes+d*k)<radio;};
  if(p.enemigo&&toca(h.p,.5f)){if(h.estado==PARRANDO&&h.t<=.25f){parry(nullptr);p.enemigo=false;p.devuelto=true;p.vel=p.vel*-1;p.dano*=3;p.t=0;p.dur=1.5f;}else{herir(p.dano,p.origen);borrar=true;}}
  else if(!p.enemigo)for(auto&e:enemigos)if(e.estado!=CAIDO&&toca(e.p,e.tipo==TROLL?.8f:.45f)){danar(e,p.dano,p.origen);borrar=true;break;}
 }if(borrar)it=proyectiles.erase(it);else ++it;}
}
void Juego::animar(Actor&a,bool esHeroe){if(a.estado==CAIDO){a.anim=a.partido?PARTIDO:MUERTE;a.k=limite(a.t/1.35f,0,1);}else if(a.estado==CARGA){a.anim=CARGADO;a.k=std::fmin(.38f,a.t/.6f);}else if(a.estado==ATAQUE||a.estado==RECUPERA){a.anim=esHeroe?(a.carga>=.5f?CARGADO:a.combo==1?REVES:a.combo==2?REMATE:GOLPE):GOLPE;a.k=a.estado==RECUPERA?.64f:limite(esHeroe?a.t/(a.combo==2?.8f:.6f):.38f+.26f*a.t/.22f,0,1);}else if(a.estado==SALTANDO){a.anim=SALTO;a.k=limite(a.t/.72f,0,1);}else if(a.estado==PARRANDO){a.anim=PARRY;a.k=limite(a.t/.35f,0,1);}else if(a.estado==PREPARA){a.anim=AVISO;a.k=limite(a.t/datos[a.tipo].aviso,0,1);}else if(a.estado==ATURDIDO){a.anim=DOLOR;a.k=limite(a.t/.3f,0,1);}else if(a.estado==GIRANDO){a.anim=GIRO;a.k=std::fmod(a.t,1.f);}else {a.k=std::fmod(a.fase,1.f);}}
float Juego::alto(const Actor&a)const{return a.estado==SALTANDO?std::sin(limite(a.t/.72f,0,1)*PI)*2.4f:0;}
void Juego::siguienteOleada(){oleada++;if(oleada>=7){victoria=true;avisar("Tomsage resiste. Has vencido",20);return;}int n=0;switch(oleada){case 0:n=6;break;case 1:n=8;break;case 2:n=10;break;case 3:cola.push_back(CAN);n=4;break;case 4:n=6;break;case 5:n=6;break;case 6:cola.push_back(TROLL);n=6;break;}for(int j=0;j<n;j++){Tipo t=oleada>=4?COBRADOR:GOBLIN;if((oleada==1&&j%4==3)||(oleada==2&&j%5==4)||(oleada==5&&j>=4))t=KOBOLD;if(oleada==2&&j%5==3)t=ESCUDO;cola.push_back(t);}proximaEntrada=.5f;avisar(oleada<4?"El asedio: oleada "+std::to_string(oleada+1):"Cobro de piso: fase "+std::to_string(oleada-3),2.5f);}
void Juego::finNivel(){cartas=true;resuelto=false;tirando=false;elegida=0;for(int i=0;i<3;i++)opciones[i]={(int)(azar()*5),i==0?2:i==1?17:19,i==0?.08f:i==1?.5f:1.f,i==0?0.f:i==1?.1f:.15f};avisar("Elige una carta y tira el d20",3);}
void Juego::tirar(int i){if(!cartas||tirando||resuelto)return;elegida=std::max(0,std::min(2,i));tirando=true;tiroT=0;dado=1;}
void Juego::aplicarCarta(){tirando=false;resuelto=true;dado=1+(int)(azar()*20);auto c=opciones[elegida];if(dado==1){bonus.fill(1);avisar("1 critico: pierdes todos los buffs",5);}else {bool exito=dado>=c.umbral;float cambio=exito?c.premio:-c.castigo;if(c.atributo==3)cambio=-cambio;bonus[c.atributo]=limite(bonus[c.atributo]*(1+cambio),.35f,5);avisar(exito?"El destino te favorece":"El riesgo tiene un precio",5);}float anterior=h.maxVida;h.maxVida=datos[h.tipo].vida*bonus[2];h.vida=std::fmin(h.maxVida,h.vida+std::fmax(0.f,h.maxVida-anterior));}
void Juego::paso(float dt,const Entrada&i){if(menu||pausa||derrota||victoria)return;dt=limite(dt,0,.05f);if(cartas){if(tirando){tiroT+=dt;dado=1+(int)(azar()*20);if(tiroT>=1.6f)aplicarCarta();}return;}tiempo+=dt;anuncioT=std::fmax(0.f,anuncioT-dt);sacudida*=std::exp(-dt*9);for(auto&e:efectos)e.t+=dt;efectos.erase(std::remove_if(efectos.begin(),efectos.end(),[](const Efecto&e){return e.t>=e.dur;}),efectos.end());if(paron>0){paron-=dt;dt*=.18f;}
 pasoHeroe(dt,i);pasoEnemigos(dt);pasoProyectiles(dt);
 if(!cola.empty()){proximaEntrada-=dt;int cap=oleada==3?14:8;if(proximaEntrada<=0&&vivos()<cap){float a=calles[(int)(azar()*3)];invocar(cola.front(),{std::cos(a)*28,std::sin(a)*28});cola.erase(cola.begin());proximaEntrada=.45f;}}
 else if(vivos()==0){descanso-=dt;if(descanso<=0){if(oleada==3&&nivel==1){finNivel();return;}siguienteOleada();descanso=3;}}
}
}
