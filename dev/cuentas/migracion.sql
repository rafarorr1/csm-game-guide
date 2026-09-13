-- Base independiente para jugadores. No aplicar a la base de los estudios.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS cuenta_usuarios (
  id TEXT PRIMARY KEY, entorno TEXT NOT NULL, correo TEXT NOT NULL,
  nombre TEXT NOT NULL, creado INTEGER NOT NULL,
  UNIQUE(entorno, correo)
);
CREATE TABLE IF NOT EXISTS cuenta_desafios (
  id TEXT PRIMARY KEY, entorno TEXT NOT NULL, correo TEXT NOT NULL, nombre TEXT NOT NULL,
  correo_hash TEXT NOT NULL, ip_hash TEXT NOT NULL, codigo_hash TEXT NOT NULL,
  creado INTEGER NOT NULL, vence INTEGER NOT NULL, intentos INTEGER NOT NULL DEFAULT 0,
  entregado INTEGER NOT NULL DEFAULT 0, consumido TEXT
);
CREATE INDEX IF NOT EXISTS cuenta_desafios_correo ON cuenta_desafios(entorno, correo_hash, creado);
CREATE INDEX IF NOT EXISTS cuenta_desafios_ip ON cuenta_desafios(entorno, ip_hash, creado);
CREATE TABLE IF NOT EXISTS cuenta_sesiones (
  hash TEXT PRIMARY KEY, usuario TEXT NOT NULL REFERENCES cuenta_usuarios(id),
  entorno TEXT NOT NULL, creado INTEGER NOT NULL, vence INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS cuenta_sesiones_usuario ON cuenta_sesiones(usuario, entorno, vence);
CREATE TABLE IF NOT EXISTS cuenta_progreso (
  usuario TEXT NOT NULL REFERENCES cuenta_usuarios(id), entorno TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0, progreso TEXT, actualizado INTEGER NOT NULL,
  operacion TEXT, PRIMARY KEY(usuario, entorno)
);
CREATE TABLE IF NOT EXISTS cuenta_operaciones (
  usuario TEXT NOT NULL REFERENCES cuenta_usuarios(id), entorno TEXT NOT NULL,
  operacion TEXT NOT NULL, solicitud_hash TEXT NOT NULL,
  revision INTEGER NOT NULL, creado INTEGER NOT NULL,
  PRIMARY KEY(usuario, entorno, operacion)
);
CREATE TABLE IF NOT EXISTS cuenta_respaldos (
  usuario TEXT NOT NULL REFERENCES cuenta_usuarios(id), entorno TEXT NOT NULL,
  operacion TEXT NOT NULL, nube TEXT, local TEXT, creado INTEGER NOT NULL,
  PRIMARY KEY(usuario, entorno, operacion)
);
