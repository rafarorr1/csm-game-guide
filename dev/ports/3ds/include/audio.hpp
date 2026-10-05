#pragma once
#include "juego.hpp"
namespace Grietas {
bool iniciarAudio();
void cerrarAudio();
void activarAudio(bool activo);
bool audioDisponible();
void pasoAudio(const Juego& juego,float dt);
}
