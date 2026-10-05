#pragma once
#include "juego.hpp"
#include <citro3d.h>
namespace Grietas {
bool iniciarHUD();
void cerrarHUD();
void dibujarHUD(Juego& juego);
void dibujarHUDSuperior(Juego& juego,C3D_RenderTarget* pantalla);
void cargaHUD(float progreso,const char* mensaje);
void errorHUD(const char* mensaje);
int tocarHUD(int x,int y);
void metricasHUD(float fps,bool visible,bool sonido);
}
