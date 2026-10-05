/* Combate nativo de Caoz ARPG. La simulación no depende de la GPU ni de 3DS. */
#include "juego.hpp"
#include <algorithm>
#include <limits>
namespace Grietas {
struct Datos {float vida,dano,vel,aviso,recupera,cd,alcance;};
static const Datos datos[]={{120,12,5,.3f,.3f,0,2.05f},{100,9,5,.24f,1.1f,0,15},{34,13,2.85f,.85f,.8f,1.35f,2},{26,16,2.65f,1.1f,.8f,2.4f,11},{100,24,2.85f,.85f,.8f,1.15f,2.5f},{800,32,2.5f,1.05f,1.05f,1.35f,4.6f},{1100,30,1.85f,1.3f,1.5f,1.6f,3.8f},{46,15,2.7f,.95f,.9f,1.5f,2}};
static const float calles[]={-PI/2,PI/6,PI*5/6};
static bool vivo(const Actor& a){return a.estado!=CAIDO&&a.estado!=HUYENDO;}
static bool goblin(const Actor& a){return a.tipo==GOBLIN||a.tipo==COBRADOR;}
static float segmento(V a,V b,V p){V d=b-a;float l=d.x*d.x+d.z*d.z;float k=l>0?limite(((p.x-a.x)*d.x+(p.z-a.z)*d.z)/l,0,1):0;return distancia(p,a+d*k);}
Juego::Juego(){enemigos.reserve(MAX_ENEMIGOS);proyectiles.reserve(MAX_PROYECTILES);efectos.reserve(MAX_EFECTOS);objetos.reserve(MAX_OBJETOS);cola.reserve(32);iniciar(ADREIDA);menu=true;}
float Juego::azar(){semilla=semilla*1664525u+1013904223u;return(semilla>>8)*(1.f/16777216.f);}
void Juego::avisar(const std::string&s,float d){anuncio=s;anuncioT=d;}
void Juego::iniciar(Tipo tipo){
 h=Actor{};h.tipo=tipo==MOHAMED?MOHAMED:ADREIDA;h.vida=h.maxVida=datos[h.tipo].vida;h.p={0,4};h.dir=PI;h.dentro=true;aliado=Actor{};mago=Actor{};mago.tipo=KOBOLD;mago.p={0,-1};
 tieneAliado=false;tiempo=furia=ultiRestante=ultiActivo=sacudida=paron=recarga=cadencia=0;fuegoT=fuegoTick=giroRestante=comboT=secuenciaT=meteorito=crater=negro=0;lluviaNarrativa=1;
 cds.fill(0);bonus.fill(1);ventajas.fill(1);penalidades.fill(1);enemigos.clear();proyectiles.clear();objetos.clear();efectos.clear();cola.clear();choques={{{-5,-3},1.3f},{{-2.82f,-2.51f},.55f},{{6.5f,-5.5f},1.5f},{{-8.3f,5.5f},1.1f},{{8.5f,4.8f},1},{{-3.5f,7.5f},.4f},{{4.5f,-10},.4f}};
 for(int i=0;i<15;i++){float a=i*TAU/15;bool puerta=false;for(float c:calles)if(std::fabs(delta(a,c))<.3f)puerta=true;if(!puerta)choques.push_back({{std::cos(a)*19.2f,std::sin(a)*19.2f},3.1f});}
 oleada=-1;nivel=1;mano=bajas=parrys=score=multiplicador=golpesCombo=plano=siguienteId=0;descanso=1.8f;proximaEntrada=0;menu=pausa=derrota=victoria=cartas=tirando=resuelto=false;balas=6;secuencia=COMBATE;llave=bumeran=false;familiaViva=true;puertaCasa={15.45f,0};ultimaBaja={0,0};avisar("Caoz ARPG",3);
}
void Juego::iniciarNivel(int etapa){Tipo tipo=h.tipo;iniciar(tipo);if(etapa>=2){nivel=2;oleada=3;furia=50;descanso=1;avisar("Cobro de piso",3);}}
int Juego::vivos()const{return std::count_if(enemigos.begin(),enemigos.end(),[](const Actor&e){return vivo(e);});}
void Juego::cambiar(Actor&a,Estado e){a.estado=e;a.t=0;a.impacto=false;}
void Juego::efecto(V p,int tipo,float radio,float dur,uint32_t color){if(efectos.size()>=MAX_EFECTOS)efectos.erase(efectos.begin());efectos.push_back({p,0,dur,radio,color,tipo});}
void Juego::invocar(Tipo t,V p){if(enemigos.size()>=MAX_ENEMIGOS)return;Actor e;e.tipo=t;e.p=p;e.dir=angulo(h.p-p);e.vida=e.maxVida=datos[t].vida;e.cd=.7f;e.numero=(int)(azar()*1000);e.id=siguienteId++;e.variante=e.id%4;e.escala=1;e.dentro=largo(p)<24.5f;enemigos.push_back(e);}
bool Juego::libre(V a,V b,float r)const{for(const auto&o:choques)if(segmento(a,b,o.p)<o.r+r)return false;return true;}
void Juego::mover(Actor&a,V paso,bool borde){
 // Subpasos también en los golpes y el dash: no se atraviesa un poste a bajo FPS.
 int n=std::max(1,(int)std::ceil(largo(paso)/.25f));n=std::min(n,64);paso=paso*(1.f/n);
 for(int k=0;k<n;k++){V p=a.p+paso;for(int j=0;j<2;j++)for(const auto&o:choques){V d=p-o.p;float l=largo(d),r=o.r+(a.tipo==TROLL?.7f:.3f);if(l<r)p=o.p+(l>.001f?d*(r/l):V{r,0});}if(borde){float l=largo(p);if(l>25.4f)p=p*(25.4f/l);}a.p=p;}
}
V Juego::ruta(V inicio,V fin,float radio)const{
 // A* con ocho vecinos y memoria fija. El mapa de obstáculos se comparte entre
 // perseguidores; nunca se vuelve a probar cada casa en cada nodo de cada ruta.
 constexpr int N=59,T=N*N;
 static std::array<int16_t,T> padres,abiertos,indiceMonticulo;
 static std::array<uint16_t,T> costes,prioridad;
 static std::array<std::array<uint8_t,T>,2> mapas;
 static uint32_t selloAnterior=0;
 uint32_t sello=2166136261u;for(const auto&o:choques){for(float v:{o.p.x,o.p.z,o.r}){sello^=uint32_t(int(v*1000));sello*=16777619u;}}
 if(sello!=selloAnterior){for(auto&m:mapas)m.fill(2);selloAnterior=sello;}
 auto& mapa=mapas[radio>.5f?1:0];
 auto punto=[](int n){return V{float(n%N-29),float(n/N-29)};};
 auto indice=[](V p){int x=int(std::lround(limite(p.x,-29,29))),z=int(std::lround(limite(p.z,-29,29)));return(z+29)*N+x+29;};
 auto abierto=[&](int n){if(mapa[n]==2){V p=punto(n);mapa[n]=libre(p,p,radio)?1:0;}return mapa[n]==1;};
 int inicioN=indice(inicio),finN=indice(fin);
 if(!abierto(finN)){
  float distanciaMejor=1e9f;int elegida=-1;
  for(int z=-4;z<=4;z++)for(int x=-4;x<=4;x++){int X=finN%N+x,Z=finN/N+z;if(X<0||X>=N||Z<0||Z>=N)continue;int n=Z*N+X;if(abierto(n)){float d=distancia(punto(n),fin);if(d<distanciaMejor){elegida=n;distanciaMejor=d;}}}
  if(elegida<0){return inicio;}
  finN=elegida;
 }
 auto heuristica=[&](int n){int x=std::abs(n%N-finN%N),z=std::abs(n/N-finN/N);return uint16_t(10*std::max(x,z)+4*std::min(x,z));};
 padres.fill(-2);indiceMonticulo.fill(-1);costes.fill(65535);int cantidad=0;
 auto intercambiar=[&](int a,int b){std::swap(abiertos[a],abiertos[b]);indiceMonticulo[abiertos[a]]=a;indiceMonticulo[abiertos[b]]=b;};
 auto subir=[&](int i){while(i>0){int padre=(i-1)/2;if(prioridad[abiertos[padre]]<=prioridad[abiertos[i]])break;intercambiar(i,padre);i=padre;}};
 auto poner=[&](int n){int i=indiceMonticulo[n];if(i<0){i=cantidad++;abiertos[i]=n;indiceMonticulo[n]=i;}subir(i);};
 auto sacar=[&](){int n=abiertos[0];indiceMonticulo[n]=-2;cantidad--;if(cantidad){abiertos[0]=abiertos[cantidad];indiceMonticulo[abiertos[0]]=0;int i=0;while(2*i+1<cantidad){int hijo=2*i+1;if(hijo+1<cantidad&&prioridad[abiertos[hijo+1]]<prioridad[abiertos[hijo]])hijo++;if(prioridad[abiertos[i]]<=prioridad[abiertos[hijo]])break;intercambiar(i,hijo);i=hijo;}}return n;};
 padres[inicioN]=-1;costes[inicioN]=0;prioridad[inicioN]=heuristica(inicioN);poner(inicioN);int mejor=inicioN;uint16_t menor=heuristica(inicioN);
 const int dx[]={1,-1,0,0,1,1,-1,-1},dz[]={0,0,1,-1,1,-1,1,-1};
 while(cantidad){int n=sacar();uint16_t h=heuristica(n);if(h<menor){menor=h;mejor=n;}if(n==finN){mejor=n;break;}
  for(int d=0;d<8;d++){int x=n%N+dx[d],z=n/N+dz[d];if(x<0||x>=N||z<0||z>=N)continue;int m=z*N+x;
   if(indiceMonticulo[m]==-2||!abierto(m)){continue;}
   if(d>=4&&(!abierto(n+dx[d])||!abierto(n+dz[d]*N))){continue;}
   if(n==inicioN&&!libre(inicio,punto(m),radio)){continue;}
   uint16_t coste=costes[n]+(d<4?10:14);if(coste>=costes[m])continue;
   padres[m]=n;costes[m]=coste;prioridad[m]=coste+heuristica(m);poner(m);
  }
 }
 V resultado=inicio;for(int n=mejor;n>=0&&n!=inicioN;n=padres[n])if(libre(inicio,punto(n),radio)){resultado=punto(n);break;}return resultado;
}
V Juego::rodear(Actor&a,V destino,float dt,float vel,int lado){
 if(distancia(a.p,destino)<.08f){return{};}
 float radio=a.tipo==TROLL?.73f:.34f;a.rutaT-=dt;V meta=destino;
 if(!libre(a.p,destino,radio)){
  if(a.rutaT<=0||distancia(destino,a.rutaMeta)>2||distancia(a.rutaPaso,a.p)<.35f||!libre(a.p,a.rutaPaso,radio)){
   a.rutaPaso=ruta(a.p,destino,radio);a.rutaMeta=destino;a.rutaT=.65f+(a.id%4)*.04f;
  }meta=a.rutaPaso;
 }
 V d=unidad(meta-a.p);V antes=a.p;float avance=std::min(distancia(a.p,meta),dt*vel);mover(a,d*avance,a.dentro);if(largo(a.p)<24.5f)a.dentro=true;V mov=a.p-antes;
 // La orientación sigue el desplazamiento y no la pared detrás de la cual está el blanco.
 if(largo(mov)>.001f){a.fase+=largo(mov)/1.3f;a.dir+=delta(a.dir,angulo(mov))*std::min(1.f,dt*9);}else a.rutaT=0;
 (void)lado;return mov;
}
void Juego::sumarGolpe(){comboT=3;golpesCombo++;multiplicador=std::min(8,1+(golpesCombo-1)/3);}
void Juego::danar(Actor&a,float dano,V origen,bool fuerte){
 if(!vivo(a)||dano<=0){return;}
 if(a.tipo==TROLL&&a.segunda&&a.expuesto<=0){efecto(a.p,1,1,.2f,0x8877ff);return;}if(a.expuesto>0)dano*=2;if(a.tipo==TROLL&&!a.segunda&&a.vida-dano<a.maxVida*.5f)dano=std::max(0.f,a.vida-a.maxVida*.5f);
 a.vida-=dano;a.flash=.16f;a.empuje=unidad(a.p-origen)*(fuerte?13.f:2.f);furia=std::min(100.f,furia+4);paron=std::max(paron,fuerte?.055f:.035f);efecto(a.p,1,fuerte?1:.5f,.25f,0xffd28a);sumarGolpe();
 if(a.vida<=0){a.vida=0;cambiar(a,CAIDO);a.partido=fuerte&&goblin(a)&&azar()<.33f;bajas++;ultimaBaja=a.p;score+=(a.tipo==TROLL||a.tipo==CAN?1000:a.tipo==ESCUDO?150:50)*std::max(1,multiplicador);
  V botin=a.p;if(largo(botin)>24)botin=botin*(24/largo(botin));if(!libre(botin,botin,.35f))botin=h.p;
  if(objetos.size()<MAX_OBJETOS&&(bajas==1||bajas==3||bajas==5)){objetos.push_back({botin,1});}
  if(objetos.size()<MAX_OBJETOS&&azar()<.1f){objetos.push_back({botin,0});}
  if(a.tipo==CAN){avisar("Can ha caido. Los goblins huyen",3);cola.clear();for(auto&e:enemigos)if(&e!=&a&&vivo(e)){cambiar(e,HUYENDO);float mejor=1e9f;for(float c:calles){V puerta={std::cos(c)*29,std::sin(c)*29};float d=distancia(e.p,puerta);if(d<mejor){mejor=d;e.destino=puerta;}}}}
 }else if(a.tipo==TROLL&&!a.segunda&&a.vida<=a.maxVida*.5f){a.segunda=true;a.cd=.3f;avisar("Armadura: haz Parry para herirlo",3);}
 else if(a.tipo!=CAN&&a.tipo!=TROLL&&a.tipo!=ESCUDO){cambiar(a,ATURDIDO);a.espera=fuerte?.6f:.2f;}
}
void Juego::parry(Actor*e){parrys++;furia=std::min(100.f,furia+20);cds.fill(0);ultiRestante=std::max(0.f,ultiRestante-1);h.flash=.3f;sacudida=.2f;efecto(h.p,2,2,.25f,0xffda55);avisar("Parry",.75f);if(e&&vivo(*e)){cambiar(*e,ATURDIDO);e->espera=e->tipo==TROLL?2.5f:e->tipo==CAN?1.f:2.f;e->expuesto=e->espera;}}
void Juego::herir(float dano,V origen,Actor*e,bool golpeImparable){if(h.invul>0||h.vida<=0)return;bool deFrente=std::fabs(delta(h.dir,angulo(origen-h.p)))<1.8f;if(!golpeImparable&&h.estado==PARRANDO&&deFrente){if(h.t<=.18f){parry(e);return;}dano*=.3f;}h.vida-=dano;h.flash=.2f;h.invul=.28f;h.empuje=unidad(h.p-origen)*3;sacudida=.25f;furia=std::min(100.f,furia+8);if(h.vida<=0){h.vida=0;derrota=true;cambiar(h,CAIDO);avisar("Has caido. START: reiniciar",10);}}
void Juego::area(float radio,float apertura,float dano,float fuerza,bool fuerte){bool impacto=false;for(auto&e:enemigos)if(vivo(e)&&distancia(e.p,h.p)<radio+.3f&&std::fabs(delta(h.dir,angulo(e.p-h.p)))<=apertura&&libre(h.p,e.p,.05f)){float antes=e.vida;danar(e,dano,h.p,fuerte);if(e.vida<antes){e.empuje=unidad(e.p-h.p)*fuerza;impacto=true;}}if(impacto||fuerte)sacudida=std::max(sacudida,fuerte?.6f:.17f);}
void Juego::onda(float radio,float dano){for(auto&e:enemigos)if(vivo(e)&&distancia(e.p,h.p)<radio&&libre(h.p,e.p,.05f))danar(e,dano,h.p);efecto(h.p,2,radio,.35f,0xd7b985);}
float Juego::apuntar(float dir)const{float mejor=1e9f,salida=dir;for(const auto&e:enemigos)if(vivo(e)){float d=distancia(h.p,e.p),a=angulo(e.p-h.p),giro=std::fabs(delta(dir,a));if(d<15&&giro<.38f&&libre(h.p,e.p,.06f)){float coste=giro*4+d*.025f;if(coste<mejor){mejor=coste;salida=a;}}}return salida;}
void Juego::disparar(float dir,float dano){if(proyectiles.size()>=MAX_PROYECTILES)return;Proyectil p;p.p=h.p+frente(dir)*.5f;p.origen=p.p;p.vel=frente(dir)*30;p.dur=.5f;p.dano=dano;proyectiles.push_back(p);}
void Juego::atacar(bool cargado){h.carga=cargado?limite((h.t-.18f)/.72f,0,1):0;cambiar(h,ATAQUE);h.t=.228f;h.combo=h.carga>=.5f?0:h.combo%3;}
void Juego::lanzarBumeran(){if(bumeran||proyectiles.size()>=MAX_PROYECTILES)return;Proyectil p;p.tipo=4;p.p=h.p;p.origen=h.p;p.destino=h.p+frente(h.dir)*4;p.vel=frente(h.dir)*16;p.dur=1.3f;p.dano=18*bonus[1];p.radio=.8f;proyectiles.push_back(p);bumeran=true;}
void Juego::habilidad(const Entrada&i){if(h.vida<=0)return;
 if(i.parry&&cds[0]<=0&&h.estado!=SALTANDO&&h.estado!=ESQUIVA){if(largo(i.mov)>.1f)h.dir=angulo(i.mov);h.carga=0;giroRestante=0;cambiar(h,PARRANDO);cds[0]=.5f;return;}
 if(i.dash&&cds[1]<=0&&h.estado!=SALTANDO&&h.estado!=RECUPERA){if(h.estado==GIRANDO)giroRestante=std::max(.23f,1.1f-h.t);h.destino=unidad(i.mov);if(largo(h.destino)<.1f)h.destino=frente(h.dir);cambiar(h,ESQUIVA);h.invul=.23f;cds[1]=1.05f*bonus[3];fuegoT=fuegoTick=0;return;}
 bool libreH=h.estado==GUARDIA||h.estado==CARGA;if(!libreH)return;
 if(i.salto&&cds[2]<=0&&furia>=25){if(largo(i.mov)>.1f)h.dir=angulo(i.mov);h.origen=h.p;h.destino=h.p+frente(h.dir)*5;cambiar(h,SALTANDO);h.invul=.73f;furia-=25;cds[2]=5;}
 else if(i.giro&&!bumeran&&cds[3]<=0&&furia>=30){furia-=30;cds[3]=1;if(h.tipo==MOHAMED){for(int k=-3;k<=3;k++)disparar(h.dir+k*.13f,9*bonus[0]);}else cambiar(h,GIRANDO);}
 else if(i.provoca&&cds[4]<=0&&!bumeran){if(largo(i.mov)>.1f)h.dir=angulo(i.mov);cds[4]=10;if(h.tipo==ADREIDA)lanzarBumeran();else{for(auto&e:enemigos)if(vivo(e)&&distancia(e.p,h.p)<7)e.empuje=unidad(h.p-e.p)*6;efecto(h.p,2,7,.4f,0xffdc55);}}
 else if(i.ulti&&ultiRestante<=0){ultiRestante=h.tipo==ADREIDA?100:90;ultiActivo=h.tipo==ADREIDA?15:10;if(h.tipo==ADREIDA){aliado=h;aliado.p.x+=1.5f;aliado.vida=120;aliado.estado=GUARDIA;aliado.t=0;aliado.rutaT=0;tieneAliado=true;avisar("Adreidos: 15 segundos",2);}else avisar("Sigilo: busca sus espaldas",2);}
}
void Juego::pasoHeroe(float dt,const Entrada&i){
 h.t+=dt*(h.estado==ATAQUE?bonus[4]:1.f);h.flash=std::max(0.f,h.flash-dt);h.invul=std::max(0.f,h.invul-dt);for(auto&cd:cds)cd=std::max(0.f,cd-dt);ultiRestante=std::max(0.f,ultiRestante-dt);ultiActivo=std::max(0.f,ultiActivo-dt);if(ultiActivo<=0)tieneAliado=false;
 if(largo(h.empuje)>.05f){mover(h,h.empuje*dt);h.empuje=h.empuje*std::exp(-dt*9);}habilidad(i);
 if(fuegoT>0){float activo=std::min(dt,fuegoT);fuegoT=std::max(0.f,fuegoT-dt);fuegoTick+=activo;if(fuegoTick>=1){fuegoTick-=1;herir(3,h.p,nullptr,true);}if((int)(tiempo*12)!=(int)((tiempo-dt)*12))efecto(h.p,6,.2f,.5f,0xff702a);}
 if(h.estado==GUARDIA){V mov=i.mov;if(largo(mov)>.1f){h.dir=angulo(mov);V antes=h.p;mover(h,mov*(5*dt));h.fase+=distancia(h.p,antes)/2.55f;h.anim=CORRER;}else h.anim=REPOSO;
  if(i.ataque){if(h.tipo==ADREIDA){if(!bumeran)cambiar(h,CARGA);}else if(cadencia<=0&&recarga<=0){if(ultiActivo>0){Actor*blanco=nullptr;for(auto&e:enemigos)if(vivo(e)&&distancia(e.p,h.p)<2&&libre(h.p,e.p,.05f)){blanco=&e;break;}if(blanco){bool espalda=std::fabs(delta(blanco->dir,angulo(h.p-blanco->p)))>PI*.6f;danar(*blanco,9*bonus[0]*(espalda?5:1.5f),h.p);efecto(h.p,1,1,.3f,0x69baff);}cadencia=.4f/bonus[4];}
   else if(balas>0){h.dir=apuntar(h.dir);disparar(h.dir,9*bonus[0]);balas--;cadencia=.24f/bonus[4];if(!balas)recarga=1.1f;}}}
 }else if(h.estado==CARGA){h.carga=limite((h.t-.18f)/.72f,0,1);if(largo(i.mov)>.1f)h.dir=angulo(i.mov);if(!i.ataque)atacar(true);}
 else if(h.estado==ATAQUE){float dur=h.combo==2?.8f:.6f,imp=h.combo==2?.39f:.3f;if(h.carga>.5f)mover(h,frente(h.dir)*(dt*2.5f*h.carga));if(!h.impacto&&h.t>=imp){h.impacto=true;area((h.combo==2?2.7f:2.05f)+h.carga*.65f,h.combo==2?.5f:1.1f,12*bonus[0]*(h.combo==2?1.8f:1)*(1+2*h.carga),2+16*h.carga,h.carga>=1);efecto(h.p,3,2+h.carga,.24f,0xe6af51);}if(h.t>=dur*.64f&&h.carga>=1)cambiar(h,RECUPERA);else if(h.t>=dur){h.combo=(h.combo+1)%3;cambiar(h,GUARDIA);}}
 else if(h.estado==RECUPERA){if(h.t>=.3f){h.combo=0;h.carga=0;cambiar(h,GUARDIA);}}
 else if(h.estado==PARRANDO){if(h.t>=.35f)cambiar(h,GUARDIA);}
 else if(h.estado==ESQUIVA){mover(h,h.destino*(17*dt));if(giroRestante>0){h.dir+=dt*15;giroRestante=std::max(0.f,giroRestante-dt);if((int)(h.t*12)!=(int)((h.t-dt)*12))onda(2.8f,9*bonus[1]);}if(h.t>=.23f){if(giroRestante>0){float restante=giroRestante;giroRestante=0;cambiar(h,GIRANDO);h.t=1.1f-restante;}else cambiar(h,GUARDIA);}}
 else if(h.estado==SALTANDO){float k=limite(h.t/.72f,0,1);V n=unidad(h.destino-h.origen);float atraso=limite(-(i.mov.x*n.x+i.mov.z*n.z),0,1);V destino=h.destino-n*(atraso*.8f);V p=h.origen+(destino-h.origen)*k;mover(h,p-h.p);if(k>=1){if(h.tipo==ADREIDA){onda(3,30*bonus[1]);efecto(h.p,4,1.05f,5,0x201a17);for(int j=0;j<12;j++)efecto(h.p+frente(j*TAU/12)*(.8f+azar()*1.5f),5,.18f,.6f+azar(),0x7c7165);sacudida=.8f;paron=.07f;}else for(auto&e:enemigos)if(distancia(e.p,h.p)<6&&vivo(e)){cambiar(e,ATURDIDO);e.espera=e.tipo==CAN?1.2f:2.6f;}cambiar(h,GUARDIA);}}
 else if(h.estado==GIRANDO){h.dir+=dt*15;mover(h,i.mov*(dt*2));if((int)(h.t*6)!=(int)((h.t-dt)*6))onda(2.8f,9*bonus[1]);if(h.t>=1.1f)cambiar(h,GUARDIA);}
 cadencia=std::max(0.f,cadencia-dt);if(recarga>0){recarga-=dt;if(recarga<=0)balas=6;}
 for(auto it=objetos.begin();it!=objetos.end();){if(it->tipo<2&&distancia(it->p,h.p)<.85f){if(it->tipo==1){mano=std::min(3,mano+1);avisar("Carta encontrada",1);}else h.vida=std::min(h.maxVida,h.vida+h.maxVida*.18f);it=objetos.erase(it);}else ++it;}
 animar(h,true);
}
float Juego::avisoDur(const Actor&a)const{if(a.tipo==CAN)return imparable(a)?1.45f:a.combo==1?.55f:1.05f;float d=datos[a.tipo].aviso;if(goblin(a)&&a.combo==2)d=1.1f;return d*(a.segunda?.85f:1.f);}
float Juego::avisoRadio(const Actor&a)const{return a.tipo==CAN&&imparable(a)?5.3f:a.tipo==TROLL&&imparable(a)?3.8f:datos[a.tipo].alcance;}
bool Juego::imparable(const Actor&a)const{return(a.tipo==CAN&&a.numero%3==2)||(a.tipo==TROLL&&a.numero%3==1);}
void Juego::pasoEnemigos(float dt){
 int presion=0;for(auto&e:enemigos)if(e.estado==PREPARA||e.estado==ATAQUE)presion++;
 for(auto&e:enemigos){auto d=datos[e.tipo];e.t+=dt;e.cd-=dt;e.flash=std::max(0.f,e.flash-dt);e.expuesto=std::max(0.f,e.expuesto-dt);
  if(e.estado==CAIDO){mover(e,e.empuje*dt);e.empuje=e.empuje*std::exp(-dt*4);if(largo(e.empuje)>2&&e.t<.7f&&((int)(e.t*10)!=(int)((e.t-dt)*10)))efecto(e.p,5,.13f,.35f,0x8a867b);animar(e);continue;}
  if(e.estado==HUYENDO){e.dentro=false;rodear(e,e.destino,dt,4.7f,e.id%2?1:-1);e.anim=CORRER;e.k=std::fmod(e.fase,1.f);if(largo(e.p)>27.5f||(e.t>5&&distancia(e.p,h.p)>18)){cambiar(e,CAIDO);e.t=3;}continue;}
  if(largo(e.empuje)>.1f){mover(e,e.empuje*dt);e.empuje=e.empuje*std::exp(-dt*7);}if(e.segunda){d.vel*=1.2f;d.recupera*=.85f;}
  float dist=distancia(e.p,h.p);bool sigilo=h.tipo==MOHAMED&&ultiActivo>0;
  if(e.estado==GUARDIA){
   if(e.tipo==CAN&&!e.llamado&&e.vida<e.maxVida*.5f){e.llamado=true;cambiar(e,LLAMA);avisar("A mi, goblins!",2);}
   else if(!sigilo){
    // Los luchadores mantienen su espacio tras golpear. Los que esperan rodean
    // al objetivo sin la retirada repetitiva de la primera implementación.
    float radio=e.tipo==KOBOLD?6.f:(presion<2?d.alcance*.65f:3.5f+(e.id%3)*.45f);V destino=h.p+unidad(e.p-h.p)*radio;
    if(h.estado==CARGA&&h.carga>.6f&&dist<3&&goblin(e))destino=e.p+frente(h.dir+(e.id%2?1:-1)*PI*.5f)*1.4f;
    V mov{};if(dist>radio+.3f||presion>=2)mov=rodear(e,destino,dt,d.vel,e.id%2?1:-1);e.anim=largo(mov)>.001f?CORRER:REPOSO;
    bool lanza=goblin(e)&&e.variante<2&&e.numero%4==0&&dist>3.3f&&dist<8;
    float alcance=lanza?8:avisoRadio(e);
    if(dist<alcance&&e.cd<=0&&presion<2&&libre(e.p,h.p,.04f)){e.dir=angulo(h.p-e.p);e.combo=lanza?2:0;cambiar(e,PREPARA);presion++;e.origen=h.p;}
   }
  }else if(e.estado==LLAMA){if(e.t>=.9f){for(int j=0;j<12&&cola.size()<32;j++)cola.push_back(GOBLIN);proximaEntrada=0;cambiar(e,GUARDIA);}}
  else if(e.estado==PREPARA){float aviso=avisoDur(e);if(e.t<aviso*.5f&&!(e.tipo==CAN&&e.combo==1))e.dir+=delta(e.dir,angulo(h.p-e.p))*std::min(1.f,dt*3);
   if(e.t>=aviso){
    if(e.tipo==KOBOLD||(goblin(e)&&e.combo==2)){if(proyectiles.size()<MAX_PROYECTILES){Proyectil p;p.enemigo=true;p.p=e.p;p.origen=e.p;p.vel=frente(e.dir)*(e.tipo==KOBOLD?11:9);p.dur=e.tipo==KOBOLD?1.7f:.85f;p.dano=d.dano;p.dueno=e.id;if(e.tipo!=KOBOLD){p.tipo=3;p.destino=h.p;p.radio=.4f;}proyectiles.push_back(p);}}
    else if(e.tipo==TROLL&&e.numero%3==2){if(proyectiles.size()<MAX_PROYECTILES){Proyectil p;p.enemigo=true;p.p=e.p;p.origen=e.p;p.destino=h.p;p.tipo=2;p.dur=1.4f;p.radio=1;p.dano=24;p.dueno=e.id;proyectiles.push_back(p);}}
    else{
     float ang=std::fabs(delta(e.dir,angulo(h.p-e.p)));bool centro=e.tipo==CAN&&e.combo==0,lados=e.tipo==CAN&&e.combo==1,mazazo=imparable(e);
     bool impacto=dist<avisoRadio(e)&&(mazazo||(lados?(ang>PI/6&&ang<PI/2):ang<(centro?PI/6:1.1f)))&&libre(e.p,h.p,.05f);
     if(mazazo){efecto(e.p,2,avisoRadio(e),.35f,0xe38b59);if(e.tipo==TROLL)for(int j=0;j<7&&proyectiles.size()<MAX_PROYECTILES;j++){Proyectil p;p.enemigo=true;p.origen=e.p;p.p=e.p;float a=j*TAU/7+e.dir;float radio=2.1f+(j%3)*1.2f;p.destino=e.p+frente(a)*radio;p.tipo=1;p.dur=1.05f+(j%3)*.13f;p.radio=.85f;p.dano=22;p.dueno=e.id;proyectiles.push_back(p);}}
     if(impacto){float vida=h.vida;herir(d.dano,e.p,&e,mazazo);if(h.vida<vida){if(goblin(e)&&e.variante==3){fuegoT=5;fuegoTick=0;}if(e.tipo==ESCUDO)h.empuje=unidad(h.p-e.p)*10;}}
    }
    if(e.estado==PREPARA)cambiar(e,ATAQUE);
   }
  }else if(e.estado==ATAQUE&&e.t>.22f){if(e.tipo==CAN&&e.combo==0&&!imparable(e)){e.combo=1;cambiar(e,PREPARA);}else{e.combo=0;e.numero++;cambiar(e,RECUPERA);}}
  else if(e.estado==RECUPERA&&e.t>=d.recupera){e.cd=d.cd;cambiar(e,GUARDIA);}
  else if(e.estado==ATURDIDO&&e.t>=e.espera)cambiar(e,GUARDIA);
  animar(e);
 }
 for(size_t i=0;i<enemigos.size();i++)for(size_t j=i+1;j<enemigos.size();j++){auto&a=enemigos[i];auto&b=enemigos[j];if(!vivo(a)||!vivo(b))continue;V v=b.p-a.p;float d=largo(v);if(d>.001f&&d<.65f){V emp=v*((.65f-d)*.5f/d);mover(a,emp*-1,a.dentro);mover(b,emp,b.dentro);}}
 enemigos.erase(std::remove_if(enemigos.begin(),enemigos.end(),[](const Actor&e){return e.estado==CAIDO&&e.t>2.5f;}),enemigos.end());
 if(tieneAliado){aliado.t+=dt;aliado.cd-=dt;Actor*blanco=nullptr;for(auto&e:enemigos)if(vivo(e)&&(!blanco||distancia(e.p,aliado.p)<distancia(blanco->p,aliado.p)))blanco=&e;
  if(blanco){if(aliado.estado==ATAQUE){aliado.anim=GOLPE;aliado.k=limite(aliado.t/.6f,0,1);if(aliado.t>.6f)cambiar(aliado,GUARDIA);}
   else if(distancia(aliado.p,blanco->p)>2||!libre(aliado.p,blanco->p,.05f)){rodear(aliado,blanco->p,dt,5,1);aliado.anim=CORRER;aliado.k=std::fmod(aliado.fase,1.f);}
   else if(aliado.cd<=0){aliado.dir=angulo(blanco->p-aliado.p);danar(*blanco,16,aliado.p);aliado.cd=.8f;cambiar(aliado,ATAQUE);}
  }else{aliado.anim=REPOSO;if(distancia(aliado.p,h.p)>2.5f){rodear(aliado,h.p,dt,4.5f,1);aliado.anim=CORRER;aliado.k=std::fmod(aliado.fase,1.f);}}
 }
}
void Juego::pasoProyectiles(float dt){
 for(auto it=proyectiles.begin();it!=proyectiles.end();){auto&p=*it;V antes=p.p;p.t+=dt;bool borrar=p.t>=p.dur;
  if(p.tipo==4){
   float ida=.25f;if(p.t<=ida){p.p=p.origen+(p.destino-p.origen)*(p.t/ida);}
   else{if(!p.devuelto){p.devuelto=true;p.tocados=0;}float u=limite((p.t-ida)/(p.dur-ida),0,1),v=1-u;V lateral=frente(h.dir+PI*.5f);V c1=p.destino+lateral*2.7f,c2=h.p+lateral*2.1f;
    p.p=p.destino*(v*v*v)+c1*(3*v*v*u)+c2*(3*v*u*u)+h.p*(u*u*u);}
   p.alto=1.15f;for(auto&e:enemigos)if(vivo(e)){uint64_t bit=uint64_t(1)<<(e.id&63);if(!(p.tocados&bit)&&segmento(antes,p.p,e.p)<p.radio&&libre(antes,e.p,.04f)){danar(e,p.dano,h.p);p.tocados|=bit;}}
   if(borrar)bumeran=false;
  }else if(p.tipo==1||p.tipo==2){float k=limite(p.t/p.dur,0,1);p.p=p.origen+(p.destino-p.origen)*k;p.alto=4*(p.tipo==2?2.5f:4.5f)*k*(1-k);
   if(borrar){bool devuelto=false;if(p.enemigo&&distancia(p.p,h.p)<p.radio+.3f){if(h.estado==PARRANDO&&h.t<=.25f){Actor*boss=nullptr;for(auto&e:enemigos)if(e.tipo==TROLL&&vivo(e)&&e.id==p.dueno){boss=&e;break;}parry(boss);if(boss)danar(*boss,45,h.p);devuelto=true;}else herir(p.dano,p.origen);}
    if(p.tipo==2&&!devuelto&&vivos()<14&&enemigos.size()<MAX_ENEMIGOS){invocar(COBRADOR,p.p);cambiar(enemigos.back(),ATURDIDO);enemigos.back().espera=1.2f;}efecto(p.p,2,p.radio,.25f,0xe5b375);}
  }else{
   if(p.tipo==3&&!p.devuelto){float k=limite(p.t/p.dur,0,1);p.p=p.origen+(p.destino-p.origen)*k;p.alto=.8f+4*2.1f*k*(1-k);}else{p.p=p.p+p.vel*dt;p.alto=1.05f;}
   if(!libre(antes,p.p,.08f))borrar=true;
   auto toca=[&](V q,float radio){return segmento(antes,p.p,q)<radio;};
   bool alcanzable=p.tipo!=3||p.alto<1.8f;
   if(!borrar&&p.enemigo&&alcanzable&&toca(h.p,.5f)){if(h.estado==PARRANDO&&h.t<=.25f&&std::fabs(delta(h.dir,angulo(p.origen-h.p)))<1.8f){parry(nullptr);p.enemigo=false;p.devuelto=true;p.vel=unidad(p.origen-p.p)*16;p.dano*=3;p.t=0;p.dur=1.5f;}else{herir(p.dano,p.origen);borrar=true;}}
   else if(!borrar&&!p.enemigo)for(auto&e:enemigos)if(vivo(e)&&toca(e.p,e.tipo==TROLL?.8f:.45f)){danar(e,p.dano,p.origen);borrar=true;break;}
  }
  if(borrar)it=proyectiles.erase(it);else ++it;
 }
}
void Juego::animar(Actor&a,bool esHeroe){if(a.estado==CAIDO){a.anim=a.partido?PARTIDO:MUERTE;a.k=limite(a.t/1.35f,0,1);}else if(a.estado==CARGA){a.anim=CARGADO;a.k=std::min(.38f,a.t/.6f);}else if(a.estado==ATAQUE||a.estado==RECUPERA){a.anim=esHeroe?(a.carga>=.5f?CARGADO:a.combo==1?REVES:a.combo==2?REMATE:GOLPE):GOLPE;a.k=a.estado==RECUPERA?.64f:limite(esHeroe?a.t/(a.combo==2?.8f:.6f):.38f+.26f*a.t/.22f,0,1);}else if(a.estado==SALTANDO){a.anim=SALTO;a.k=limite(a.t/.72f,0,1);}else if(a.estado==PARRANDO){a.anim=PARRY;a.k=limite(a.t/.35f,0,1);}else if(a.estado==PREPARA){a.anim=AVISO;a.k=limite(a.t/avisoDur(a),0,1);}else if(a.estado==ATURDIDO){a.anim=DOLOR;a.k=limite(a.t/.3f,0,1);}else if(a.estado==GIRANDO||(a.estado==ESQUIVA&&giroRestante>0)){a.anim=GIRO;a.k=std::fmod(a.t,1.f);}else a.k=std::fmod(a.fase,1.f);}
float Juego::alto(const Actor&a)const{if(secuencia==EPILOGO_MAGO && &a==&h&&secuenciaT>=17.2f)return-std::min(14.f,(secuenciaT-17.2f)*(secuenciaT-17.2f)*4);if(secuencia==ENTRADA_TROLL&&a.tipo==TROLL)return std::max(0.f,(6.2f-secuenciaT)*13);return a.estado==SALTANDO?std::sin(limite(a.t/.72f,0,1)*PI)*2.4f:0;}
void Juego::siguienteOleada(){oleada++;if(oleada>=7){secuencia=PLAZA_LIBRE;secuenciaT=0;proyectiles.clear();bumeran=false;llave=true;avisar("La llave abre la casa al este",8);return;}int n=0;switch(oleada){case 0:n=6;break;case 1:n=8;break;case 2:n=10;break;case 3:cola.push_back(CAN);n=4;break;case 4:n=6;break;case 5:n=6;break;case 6:cola.push_back(TROLL);n=6;break;}for(int j=0;j<n;j++){Tipo t=oleada>=4?COBRADOR:GOBLIN;if((oleada==1&&j%4==3)||(oleada==2&&j%5==4)||(oleada==5&&j>=4))t=KOBOLD;if(oleada==2&&j%5==3)t=ESCUDO;cola.push_back(t);}proximaEntrada=.5f;avisar(oleada<4?"El asedio: oleada "+std::to_string(oleada+1):"Cobro de piso: fase "+std::to_string(oleada-3),2.5f);}
void Juego::finNivel(){cartas=true;resuelto=false;tirando=false;elegida=0;for(int i=0;i<3;i++){int atributo=(int)(azar()*5);float premio=atributo==3?(i==0?.08f:i==1?.3f:.6f):(i==0?.1f:i==1?.5f:2.f);opciones[i]={atributo,i==0?2:i==1?17:19,premio,i==0?0.f:i==1?.1f:.15f};}avisar("Elige una carta y tira el d20",3);}
void Juego::tirar(int i){if(!cartas||tirando||resuelto)return;elegida=std::max(0,std::min(2,i));tirando=true;tiroT=0;dado=1;}
void Juego::resolverCarta(int resultado){tirando=false;resuelto=true;dado=std::max(1,std::min(20,resultado));auto c=opciones[elegida];float porcentaje=h.maxVida>0?h.vida/h.maxVida:0;
 if(dado==1){ventajas.fill(1);avisar("1 critico: pierdes los beneficios",5);}
 else{bool exito=dado>=c.umbral;float cambio=exito?c.premio:-c.castigo;if(c.atributo==3)cambio=-cambio;auto& origen=exito?ventajas:penalidades;origen[c.atributo]=limite(origen[c.atributo]*(1+cambio),.2f,5);avisar(exito?"El destino te favorece":"El riesgo tiene un precio",5);}
 for(int k=0;k<5;k++){bonus[k]=limite(ventajas[k]*penalidades[k],.35f,5);}
 h.maxVida=datos[h.tipo].vida*bonus[2];h.vida=h.maxVida*porcentaje;
}
void Juego::aplicarCarta(){resolverCarta(1+(int)(azar()*20));}
void Juego::continuarCarta(){if(!cartas||!resuelto)return;cartas=false;nivel=2;mano=bajas=0;descanso=3;objetos.clear();enemigos.clear();proyectiles.clear();bumeran=false;h.vida=std::min(h.maxVida,h.vida+h.maxVida*.25f);avisar("Cobro de piso",3);}
void Juego::comenzarTroll(){secuencia=ENTRADA_TROLL;secuenciaT=0;plano=0;llaveP=ultimaBaja+V{1.7f,.7f};if(largo(llaveP)>12)llaveP=llaveP*(12/largo(llaveP));if(!libre(llaveP,llaveP,.6f))llaveP={0,0};if(objetos.size()>=MAX_OBJETOS)objetos.erase(objetos.begin());objetos.push_back({llaveP,2});proyectiles.clear();bumeran=false;h.origen=h.p;h.empuje={};tieneAliado=false;ultiActivo=0;avisar("Una llave entre los restos",3);}
void Juego::entrarCasa(){secuencia=CASA_GOBLIN;secuenciaT=0;h.p={0,3.8f};h.dir=PI;h.empuje={};cambiar(h,GUARDIA);enemigos.clear();objetos.clear();proyectiles.clear();efectos.clear();fuegoT=giroRestante=0;bumeran=false;tieneAliado=false;
 for(int k=0;k<2;k++){familia[k]=Actor{};familia[k].tipo=GOBLIN;familia[k].p={-.6f+k*1.2f,-2.3f};familia[k].dir=0;familia[k].escala=k?.6f:1.05f;familia[k].variante=k?2:3;}avisar("Una madre y su hijo. Puedes salir",8);
}
void Juego::salirCasa(){secuencia=EPILOGO_MAGO;secuenciaT=0;plano=0;h.p=puertaCasa;h.dir=-PI/2;h.origen=h.p;h.empuje={};cambiar(h,GUARDIA);mago.p={0,-1};mago.dir=PI*.5f;mago.anim=AVISO;lluviaNarrativa=0;meteorito=crater=negro=0;avisar("",0);}
void Juego::pasoSecuencia(float dt,const Entrada&i){secuenciaT+=dt;
 if(secuencia==PLAZA_LIBRE){pasoHeroe(dt,i);pasoEnemigos(dt);pasoProyectiles(dt);if(llave&&distancia(h.p,puertaCasa)<1.1f)entrarCasa();return;}
 if(secuencia==CASA_GOBLIN){
  if(h.estado==ATAQUE){h.t+=dt;animar(h,true);if(h.t>.6f)cambiar(h,GUARDIA);}else{h.anim=largo(i.mov)>.1f?CORRER:REPOSO;if(largo(i.mov)>.1f){h.dir=angulo(i.mov);h.p=h.p+i.mov*(dt*3.5f);h.p.x=limite(h.p.x,-3.7f,3.7f);h.p.z=limite(h.p.z,-3.4f,4.6f);h.fase+=largo(i.mov)*dt*2;}h.k=std::fmod(h.fase,1.f);
   if(i.ataque&&familiaViva&&distancia(h.p,{0,-2.3f})<3.1f){familiaViva=false;h.dir=PI;cambiar(h,ATAQUE);for(auto&a:familia)cambiar(a,CAIDO);avisar("",0);}}
  for(auto&a:familia){if(a.estado==CAIDO){a.t=std::min(1.35f,a.t+dt);animar(a);}else{a.anim=DOLOR;a.k=.15f+.08f*std::sin(secuenciaT*8);}}
  if(h.p.z>4.35f&&std::fabs(h.p.x)<1.7f&&secuenciaT>.5f){salirCasa();}
  return;
 }
 if(secuencia==ENTRADA_TROLL){
  if(plano==0){V mov=rodear(h,llaveP,dt,4.5f,1);h.anim=CORRER;h.k=std::fmod(h.fase,1.f);if(distancia(h.p,llaveP)<.4f||secuenciaT>9){plano=1;secuenciaT=0;h.p=llaveP;h.anim=REPOSO;h.origen=h.p;}(void)mov;return;}
  // Desde la recogida: mirar la llave, sombra creciente, evasión y aterrizaje.
  if(secuenciaT<1.2f){h.anim=CARGADO;h.k=.2f;}else if(secuenciaT<4.8f){h.anim=REPOSO;h.k=0;llave=true;objetos.erase(std::remove_if(objetos.begin(),objetos.end(),[](const Objeto&o){return o.tipo==2;}),objetos.end());}
  if(secuenciaT>=4.8f&&secuenciaT<5.5f){h.estado=SALTANDO;h.t=secuenciaT-4.8f;h.dir=-PI*.5f;h.p=h.origen+V{-4.5f*limite(h.t/.7f,0,1),0};animar(h,true);}
  if(secuenciaT>=5.5f){h.estado=GUARDIA;h.anim=REPOSO;h.k=0;}
  if(secuenciaT>=5.45f&&secuenciaT-dt<5.45f){efecto(llaveP,2,5,.7f,0x9e917d);efecto(llaveP,4,2,5,0x272427);sacudida=1;}
  if(secuenciaT>=6.2f){secuencia=COMBATE;secuenciaT=0;oleada=6;invocar(TROLL,llaveP);for(int n=0;n<6;n++)cola.push_back(COBRADOR);proximaEntrada=.7f;descanso=3;avisar("El recaudador",3);}return;
 }
 if(secuencia==EPILOGO_MAGO){float t=secuenciaT;
  // Planos nativos acotados: salida, revelación, carrera, salto, portal, cielo,
  // impacto y caída. El renderer elige las cámaras; la actuación queda aquí.
  plano=t<2?0:t<4?1:t<7?2:t<8.4f?3:t<12?4:t<15.2f?5:6;
  if(t<2){h.p=puertaCasa+V{-t*1.6f,0};h.dir=-PI*.5f;h.anim=CORRER;h.fase+=dt*1.5f;h.k=std::fmod(h.fase,1.f);}
  else if(t<4){h.anim=REPOSO;h.dir=angulo(mago.p-h.p);}
  else if(t<7){V inicio=puertaCasa+V{-3.2f,0},fin=mago.p+V{3.6f,0};h.p=inicio+(fin-inicio)*std::pow((t-4)/3,1.6f);h.dir=-PI*.5f;h.anim=CORRER;h.fase+=dt*2.7f;h.k=std::fmod(h.fase,1.f);h.origen=h.p;}
  else if(t<7.72f){h.estado=SALTANDO;h.t=t-7;h.p=h.origen+V{-4*limite(h.t/.72f,0,1),0};h.anim=SALTO;h.k=limite(h.t/.72f,0,1);}
  else{h.estado=GUARDIA;h.anim=t<8.2f?CARGADO:REPOSO;h.k=t<8.2f?.64f:0;}
  if(t>=7.5f&&t-dt<7.5f){for(int n=0;n<18;n++)efecto(mago.p+frente(n*TAU/18)*1.5f,7,.12f,3,0x69ed85);lluviaNarrativa=1;}
  if(t>=8.4f&&t<12){h.dir+=dt*.3f*std::sin(t*3);mago.p={15.5f,0};mago.anim=AVISO;mago.k=limite((t-10.2f)/1.8f,0,1);}
  if(t>=12){h.dir=angulo(mago.p-h.p);lluviaNarrativa=1.5f;mago.anim=GOLPE;mago.k=limite((t-12)/3,0,1);}
  if(t>=15.2f){meteorito=limite((t-15.2f)/1.8f,0,1);h.anim=CARGADO;h.k=.2f;}
  if(t>=17){crater=limite((t-17)/1.3f,0,1);if(t-dt<17){sacudida=1.8f;efecto(h.p,2,23,1.3f,0x65fca1);for(int n=0;n<28;n++)efecto(h.p+frente(n*TAU/28)*(3+n%5),5,.45f,1.7f,0x716e5e);}h.anim=DOLOR;h.k=.5f;}
  if(t>=19)negro=limite((t-19)/1.8f,0,1);
  if(t>=20.8f){secuencia=FIN_ALPHA;negro=1;victoria=true;avisar("Fin de Alpha .01",999);}return;
 }
}
void Juego::paso(float dt,const Entrada&i){if(menu||pausa||victoria)return;dt=limite(dt,0,.05f);
 if(derrota){h.t=std::min(1.35f,h.t+dt);h.flash=std::max(0.f,h.flash-dt);mover(h,h.empuje*dt);h.empuje=h.empuje*std::exp(-dt*9);sacudida*=std::exp(-dt*9);animar(h,true);return;}
 if(cartas){if(tirando){tiroT+=dt;dado=1+(int)(azar()*20);if(tiroT>=1.6f)aplicarCarta();}return;}
 tiempo+=dt;anuncioT=std::max(0.f,anuncioT-dt);sacudida*=std::exp(-dt*9);for(auto&e:efectos)e.t+=dt;efectos.erase(std::remove_if(efectos.begin(),efectos.end(),[](const Efecto&e){return e.t>=e.dur;}),efectos.end());comboT=std::max(0.f,comboT-dt);if(comboT<=0){multiplicador=golpesCombo=0;}
 if(secuencia!=COMBATE){pasoSecuencia(dt,i);return;}
 if(paron>0){paron-=dt;dt*=.18f;}pasoHeroe(dt,i);if(derrota)return;pasoEnemigos(dt);pasoProyectiles(dt);
 if(!cola.empty()){proximaEntrada-=dt;int cap=oleada==3?14:10;if(proximaEntrada<=0&&vivos()<cap&&enemigos.size()<MAX_ENEMIGOS){float a=calles[(int)(azar()*3)];invocar(cola.front(),{std::cos(a)*28,std::sin(a)*28});cola.erase(cola.begin());proximaEntrada=.45f;}}
 else if(vivos()==0){descanso-=dt;if(descanso<=0){if(oleada==3&&nivel==1){if(mano<3){int encontradas=mano;for(const auto&o:objetos)encontradas+=o.tipo==1;while(encontradas<3){if(objetos.size()>=MAX_OBJETOS)objetos.erase(objetos.begin());objetos.push_back({h.p+frente(encontradas*TAU/3)*.6f,1});encontradas++;}if(anuncioT<=0)avisar("Nivel despejado: recoge las tres cartas",3);return;}finNivel();return;}if(oleada==5){comenzarTroll();return;}siguienteOleada();descanso=3;}}
}
}
