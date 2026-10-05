/* Sonido PCM precalculado. NDSP mezcla seis voces; sin síntesis en el cuadro. */
#include "audio.hpp"
#include <3ds.h>
#include <array>
#include <cstdio>
#include <cstring>
#include <algorithm>
namespace Grietas {
namespace {
struct Muestra {s16* datos=nullptr;u32 n=0;};
struct Voz {ndspWaveBuf buffer{};int muestra=-1;};
std::array<Muestra,10> muestras{};
std::array<Voz,7> voces{};
bool listo=false,activo=true;
int siguiente=1,parrys=0,bajas=0,balas=6,estado=GUARDIA,secuencia=0;
float pasos=0,ultimaFase=0,ultimoTrueno=-20,vida=120,ultimoUlti=0,tiempoAnterior=-1;
const char* nombres[]={"tajo","impacto","parry","disparo","salto","muerte","magia","paso","trueno","lluvia"};
void volumen(int canal,float valor){float mix[12]={};mix[0]=mix[1]=valor;ndspChnSetMix(canal,mix);}
void sonar(int id,float nivel=.65f,int canal=-1,bool bucle=false){if(!listo||!activo||!muestras[id].datos)return;
 if(canal<0){canal=siguiente++;if(siguiente>6)siguiente=1;}
 ndspChnWaveBufClear(canal);auto& v=voces[canal];std::memset(&v.buffer,0,sizeof(v.buffer));v.muestra=id;v.buffer.data_vaddr=muestras[id].datos;v.buffer.nsamples=muestras[id].n;v.buffer.looping=bucle;volumen(canal,nivel);ndspChnWaveBufAdd(canal,&v.buffer);
}
}
bool iniciarAudio(){if(R_FAILED(ndspInit()))return false;listo=true;ndspSetOutputMode(NDSP_OUTPUT_STEREO);
 for(int canal=0;canal<7;canal++){ndspChnReset(canal);ndspChnSetInterp(canal,NDSP_INTERP_LINEAR);ndspChnSetRate(canal,22050);ndspChnSetFormat(canal,NDSP_FORMAT_MONO_PCM16);}
 for(size_t i=0;i<muestras.size();i++){char ruta[96];std::snprintf(ruta,sizeof(ruta),"romfs:/audio/%s.pcm",nombres[i]);FILE* f=std::fopen(ruta,"rb");if(!f)continue;std::fseek(f,0,SEEK_END);long tam=std::ftell(f);std::rewind(f);if(tam>0&&tam<300000&&tam%2==0){auto& m=muestras[i];m.datos=(s16*)linearAlloc(tam);if(m.datos){if(std::fread(m.datos,1,tam,f)==(size_t)tam){m.n=tam/2;DSP_FlushDataCache(m.datos,tam);}else{linearFree(m.datos);m.datos=nullptr;}}}std::fclose(f);}
 return true;
}
void activarAudio(bool valor){activo=valor;if(!listo)return;for(int i=0;i<7;i++)ndspChnSetPaused(i,!activo);}
bool audioDisponible(){return listo;}
void cerrarAudio(){if(listo){for(int i=0;i<7;i++)ndspChnWaveBufClear(i);ndspExit();listo=false;}for(auto&m:muestras){if(m.datos)linearFree(m.datos);m={};}}
void pasoAudio(const Juego& j,float dt){if(!listo)return;bool quieto=j.menu||j.pausa||j.cartas||j.secuencia==FIN_ALPHA;
 for(int i=0;i<7;i++)ndspChnSetPaused(i,quieto||!activo);
 const bool reinicio=j.tiempo<tiempoAnterior;tiempoAnterior=j.tiempo;
 if(j.menu||reinicio){estado=j.h.estado;vida=j.h.vida;parrys=j.parrys;bajas=j.bajas;balas=j.balas;ultimoUlti=j.ultiActivo;ultimaFase=j.h.fase;pasos=0;ultimoTrueno=j.tiempo-5;secuencia=j.secuencia;return;}
 if(quieto||!activo)return;
 if(voces[0].muestra!=9||voces[0].buffer.status==NDSP_WBUF_DONE)sonar(9,.18f,0,true);
 volumen(0,j.secuencia==CASA_GOBLIN?.045f:j.secuencia==EPILOGO_MAGO?.27f:.16f);
 if(j.parrys>parrys)sonar(2,.6f);
 if(j.h.vida<vida)sonar(1,.45f);
 if(j.balas<balas)sonar(3,.5f);
 if(j.bajas>bajas)sonar(5,.38f);
 if(j.h.estado!=estado){if(j.h.estado==ATAQUE)sonar(j.h.carga>.8f?1:0,j.h.carga>.8f?.7f:.5f);if(estado==SALTANDO&&j.h.estado==GUARDIA)sonar(4,.75f);if(j.h.estado==ESQUIVA)sonar(0,.28f);}
 if(j.ultiActivo>ultimoUlti+.5f||j.secuencia!=secuencia)sonar(6,.4f);
 if(j.h.anim==CORRER&&j.h.estado==GUARDIA){pasos+=std::fabs(j.h.fase-ultimaFase);if(pasos>.48f){sonar(7,.34f);pasos=0;}}
 if(j.tiempo-ultimoTrueno>13+std::sin(ultimoTrueno*2.73f)*4){sonar(8,.3f);ultimoTrueno=j.tiempo;}
 estado=j.h.estado;vida=j.h.vida;parrys=j.parrys;bajas=j.bajas;balas=j.balas;ultimoUlti=j.ultiActivo;ultimaFase=j.h.fase;secuencia=j.secuencia;(void)dt;
}
}
