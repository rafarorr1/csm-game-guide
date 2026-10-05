#pragma once
#include <array>
#include <vector>
#include <cmath>
#include <cstdint>
#include <string>
namespace Grietas {
constexpr float PI=3.14159265359f,TAU=PI*2;
constexpr size_t MAX_ENEMIGOS=24,MAX_PROYECTILES=64,MAX_EFECTOS=80,MAX_OBJETOS=16;
struct V {float x=0,z=0;V operator+(V b)const{return{x+b.x,z+b.z};}V operator-(V b)const{return{x-b.x,z-b.z};}V operator*(float s)const{return{x*s,z*s};}};
inline float largo(V a){return std::sqrt(a.x*a.x+a.z*a.z);}inline float distancia(V a,V b){return largo(a-b);}inline V unidad(V a){float l=largo(a);return l>.0001f?a*(1/l):V{};}inline V frente(float a){return{std::sin(a),std::cos(a)};}inline float angulo(V a){return std::atan2(a.x,a.z);}inline float delta(float a,float b){return std::atan2(std::sin(b-a),std::cos(b-a));}inline float limite(float a,float lo,float hi){return std::fmax(lo,std::fmin(hi,a));}
// El orden de modelos y clips es parte del formato de los recursos exportados.
enum Tipo{ADREIDA,MOHAMED,GOBLIN,KOBOLD,ESCUDO,CAN,TROLL,COBRADOR};
enum Anim{REPOSO,CORRER,GOLPE,CARGADO,SALTO,PARRY,GIRO,DOLOR,MUERTE,AVISO,PARTIDO,REVES,REMATE};
enum Estado{GUARDIA,CARGA,ATAQUE,SALTANDO,ESQUIVA,PARRANDO,GIRANDO,ATURDIDO,CAIDO,PREPARA,RECUPERA,LLAMA,HUYENDO};
enum Secuencia{COMBATE,ENTRADA_TROLL,PLAZA_LIBRE,CASA_GOBLIN,EPILOGO_MAGO,FIN_ALPHA};
struct Entrada {V mov;bool ataque=false,parry=false,dash=false,salto=false,giro=false,provoca=false,ulti=false;};
struct Actor {Tipo tipo=GOBLIN;Estado estado=GUARDIA;V p,origen,destino,empuje,rutaMeta,rutaPaso;float dir=PI,t=0,fase=0,vida=34,maxVida=34,carga=0,cd=0,invul=0,expuesto=0,flash=0,espera=0,rutaT=0,escala=1;int combo=0,numero=0,variante=0,id=0;bool impacto=false,segunda=false,llamado=false,partido=false,dentro=false;int anim=REPOSO;float k=0;};
struct Proyectil {V p,origen,destino,vel;float t=0,dur=1,alto=0,radio=.25f,dano=9;int dueno=-1;bool enemigo=false,devuelto=false;int tipo=0;uint64_t tocados=0;};
struct Efecto {V p;float t=0,dur=.3f,radio=1;uint32_t color=0xffcf69;int tipo=0;};
struct Objeto {V p;int tipo=0;};
struct Carta {int atributo=0,umbral=2;float premio=.08f,castigo=0;};
struct Choque {V p;float r;};
struct Juego {
 Actor h,aliado,mago;std::array<Actor,2> familia{};bool tieneAliado=false,pausa=false,menu=true,derrota=false,victoria=false,cartas=false,tirando=false,resuelto=false;
 std::vector<Actor> enemigos;std::vector<Proyectil> proyectiles;std::vector<Efecto> efectos;std::vector<Objeto> objetos;std::vector<Choque> choques;std::vector<Tipo> cola;
 std::array<Carta,3> opciones{};std::array<float,5> bonus{{1,1,1,1,1}},ventajas{{1,1,1,1,1}},penalidades{{1,1,1,1,1}},cds{};
 float tiempo=0,furia=0,ultiRestante=0,ultiActivo=0,sacudida=0,paron=0,proximaEntrada=0,descanso=1,tiroT=0,anuncioT=0,recarga=0,cadencia=0;
 float fuegoT=0,fuegoTick=0,giroRestante=0,comboT=0,secuenciaT=0,lluviaNarrativa=1,meteorito=0,crater=0,negro=0;
 int oleada=-1,nivel=1,mano=0,bajas=0,parrys=0,elegida=0,dado=0,balas=6,seleccionHeroe=0,score=0,multiplicador=0,golpesCombo=0,plano=0,siguienteId=0;
 uint32_t semilla=8731;std::string anuncio;Secuencia secuencia=COMBATE;bool llave=false,familiaViva=true,bumeran=false;V puertaCasa{17.3f,0},llaveP,ultimaBaja;
 Juego();float azar();void iniciar(Tipo tipo);void iniciarNivel(int etapa);void paso(float dt,const Entrada& in);void cambiar(Actor& a,Estado e);void invocar(Tipo t,V p);void danar(Actor& a,float dano,V origen,bool fuerte=false);void herir(float dano,V origen,Actor* enemigo=nullptr,bool imparable=false);void parry(Actor* e);void atacar(bool cargado);void area(float radio,float apertura,float dano,float fuerza,bool fuerte=false);void onda(float radio,float dano);void disparar(float direccion,float dano);float apuntar(float direccion)const;void habilidad(const Entrada& in);void pasoHeroe(float dt,const Entrada& in);void pasoEnemigos(float dt);void pasoProyectiles(float dt);void siguienteOleada();void finNivel();void tirar(int indice);void aplicarCarta();void resolverCarta(int resultado);void continuarCarta();void mover(Actor& a,V paso,bool borde=true);V rodear(Actor& a,V destino,float dt,float vel,int lado);void animar(Actor& a,bool heroe=false);float alto(const Actor& a)const;void efecto(V p,int tipo,float radio,float dur,uint32_t color);int vivos()const;void avisar(const std::string& s,float dur=2);bool libre(V a,V b,float r)const;
 float avisoDur(const Actor& a)const;float avisoRadio(const Actor& a)const;bool imparable(const Actor& a)const;void sumarGolpe();void comenzarTroll();void entrarCasa();void salirCasa();void pasoSecuencia(float dt,const Entrada& in);void lanzarBumeran();V ruta(V inicio,V fin,float radio)const;
};
}
