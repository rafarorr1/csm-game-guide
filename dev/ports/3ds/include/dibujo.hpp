#pragma once
#include "juego.hpp"
namespace Grietas {
using ProgresoDibujo=void(*)(float,const char*);
bool iniciarDibujo(ProgresoDibujo progreso=nullptr);
void dibujar(Juego&j);
void cerrarDibujo();
}
