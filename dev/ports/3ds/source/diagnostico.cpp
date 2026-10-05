/* Registro acotado para los bloqueos que sólo se reproducen en la consola. */
#include "diagnostico.hpp"
#include <3ds.h>
#include <cstdio>
#include <sys/stat.h>
namespace Grietas {
namespace {
bool activo=false;
u64 comienzo=0;
constexpr const char* ruta="sdmc:/3ds/CaozARPG/arranque.log";
constexpr const char* anterior="sdmc:/3ds/CaozARPG/arranque-anterior.log";
}
void iniciarRegistro(){
 mkdir("sdmc:/3ds",0777);mkdir("sdmc:/3ds/CaozARPG",0777);
 // Conserva el intento anterior sin acumular archivos en cada partida.
 if(FILE* f=std::fopen(ruta,"r")){std::fclose(f);std::remove(anterior);std::rename(ruta,anterior);}
 if(FILE* f=std::fopen(ruta,"w")){std::fputs("Caoz ARPG Alpha .01 r1 — diagnóstico de arranque\n",f);std::fclose(f);activo=true;}
 comienzo=osGetTime();
}
void registrarInicio(const char* fase){
 if(!activo)return;
 if(FILE* f=std::fopen(ruta,"a")){
  std::fprintf(f,"%llu ms | %s | lineal libre: %lu bytes\n",(unsigned long long)(osGetTime()-comienzo),fase,(unsigned long)linearSpaceFree());
  std::fclose(f);
 }
}
void terminarRegistro(){registrarInicio("ARRANQUE COMPLETO: dos cuadros 3D confirmados por la GPU");activo=false;}
}
