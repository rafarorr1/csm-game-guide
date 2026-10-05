#pragma once
namespace Grietas {
// Sólo durante el arranque: cada hito se cierra en la SD antes de continuar.
void iniciarRegistro();
void registrarInicio(const char* fase);
void terminarRegistro();
}
