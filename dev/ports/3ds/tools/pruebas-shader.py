#!/usr/bin/env python3
"""Comprueba el contrato PICA del binario que se incorpora al ejecutable.

Se exige una escritura por componente declarado en DVLE, incluidos los
componentes de relleno de texcoord0. Es una precaución deliberadamente más
estricta que contar sólo las componentes semánticas del outmap de libctru;
que un binario incumpla esta regla no demuestra por sí solo un cuelgue físico.

El port usa un VSH lineal. Se rechaza flujo no soportado en lugar de afirmar
que todas sus rutas han sido verificadas. No se simula la GPU ni el hardware.

Formato: devkitPro/picasso source/{picasso_frontend.cpp,picasso_assembler.cpp}.
Restricciones PICA: https://docs.mikage.app/GPU/Pitfalls/
"""

import argparse
from pathlib import Path
import struct
import subprocess
import sys
import tempfile


class ShaderInvalido(ValueError):
    pass


def comprobar(datos):
    def leer(formato, inicio):
        cantidad = struct.calcsize(formato)
        if inicio < 0 or inicio + cantidad > len(datos):
            raise ShaderInvalido("contenedor SHBIN truncado")
        return struct.unpack_from(formato, datos, inicio)

    def firma(inicio, esperada):
        if leer("4s", inicio)[0] != esperada:
            raise ShaderInvalido(f"firma {esperada.decode()} ausente")

    firma(0, b"DVLB")
    numero = leer("<I", 4)[0]
    if numero != 1:
        raise ShaderInvalido("se requiere exactamente un VSH, sin geometría")
    dvle = leer("<I", 8)[0]
    dvlp = 8 + numero * 4
    firma(dvlp, b"DVLP")
    codigo_rel, cantidad, operandos_rel, n_operandos = leer("<4I", dvlp + 8)
    if not 1 <= cantidad <= 512 or not 1 <= n_operandos <= 128:
        raise ShaderInvalido("tamaño de código o tabla de operandos inválido")
    codigo = leer(f"<{cantidad}I", dvlp + codigo_rel)
    operandos = [leer("<Q", dvlp + operandos_rel + i * 8)[0]
                 for i in range(n_operandos)]
    firma(dvle, b"DVLE")
    if leer("<B", dvle + 6)[0] != 0:
        raise ShaderInvalido("sólo se admite vertex shader")
    inicio, fin = leer("<2I", dvle + 8)
    if not 0 <= inicio < fin <= cantidad:
        raise ShaderInvalido("límites de main inválidos")
    mascara_registros = leer("<H", dvle + 18)[0]
    salida_rel, n_salidas = leer("<2I", dvle + 40)
    if not 1 <= n_salidas <= 16:
        raise ShaderInvalido("tabla de salidas inválida")
    declarados = {}
    for i in range(n_salidas):
        _, registro, mascara = leer("<HHI", dvle + salida_rel + i * 8)
        if registro >= 16 or not 0 < mascara <= 15:
            raise ShaderInvalido("registro o máscara de salida inválido")
        if declarados.get(registro, 0) & mascara:
            raise ShaderInvalido("componentes de salida declaradas dos veces")
        declarados[registro] = declarados.get(registro, 0) | mascara
    if sum(1 << registro for registro in declarados) != mascara_registros:
        raise ShaderInvalido("máscara DVLE y tabla de salidas no coinciden")

    escrituras = {registro: [0] * 4 for registro in declarados}
    anterior_mova = False
    encontro_fin = False
    aritmeticas = set(range(0x10)) | {0x13, 0x18, 0x19, 0x1A, 0x1B}
    for pc in range(inicio, fin):
        palabra = codigo[pc]
        opcode = palabra >> 26
        if opcode == 0x12:
            if anterior_mova:
                raise ShaderInvalido(f"MOVA consecutivos en instrucciones {pc - 1} y {pc}")
            anterior_mova = True
            continue
        anterior_mova = False
        if opcode == 0x22:
            if pc != fin - 1:
                raise ShaderInvalido("instrucciones sin verificar después de END")
            encontro_fin = True
            continue
        if opcode in (0x21, 0x2E, 0x2F):
            continue
        if opcode >= 0x30:
            registro = (palabra >> 24) & 31
            descriptor = palabra & 31
        elif opcode in aritmeticas:
            registro = (palabra >> 21) & 31
            descriptor = palabra & 127
        else:
            raise ShaderInvalido(f"flujo u opcode 0x{opcode:02x} no soportado en {pc}")
        if descriptor >= n_operandos:
            raise ShaderInvalido(f"descriptor inexistente en instrucción {pc}")
        if registro >= 16:
            continue
        if registro not in declarados:
            raise ShaderInvalido(f"escritura de salida o{registro} no declarada")
        mascara = operandos[descriptor] & 15
        # DVLE ordena xyzw como bits 0..3; el descriptor lo hace como 3..0.
        for componente in range(4):
            if mascara & (1 << (3 - componente)):
                if not declarados[registro] & (1 << componente):
                    raise ShaderInvalido(f"escritura fuera de la máscara de o{registro}")
                escrituras[registro][componente] += 1
    if not encontro_fin:
        raise ShaderInvalido("main carece de END")
    fallos = []
    for registro, mascara in declarados.items():
        for componente, nombre in enumerate("xyzw"):
            if mascara & (1 << componente) and escrituras[registro][componente] != 1:
                fallos.append(f"o{registro}.{nombre}: {escrituras[registro][componente]} escrituras")
    if fallos:
        raise ShaderInvalido("salidas incompletas o repetidas: " + ", ".join(fallos))
    return f"{fin - inicio} instrucciones, {len(declarados)} salidas; componentes únicas y MOVA separados"


def regresiones(picasso):
    # Casos compilados independientes del shader real: detectan fallos de
    # decodificación, incluida la máscara xy que dejaba zw sin escribir.
    cabecera = ".out posicion position\n.out uv texcoord0\n.proc main\n"
    casos = [
        ("completo", "mova a0.x,v0.x\nnop\nmova a0.x,v0.y\nmov posicion,v0\nmov uv,v1\n", None),
        ("uv-parcial", "mov posicion,v0\nmov uv.xy,v1\n", "o1.z: 0 escrituras"),
        ("salida-repetida", "mov posicion,v0\nmov posicion.x,v0.x\nmov uv,v1\n", "o0.x: 2 escrituras"),
        ("mova-adyacentes", "mova a0.x,v0.x\nmova a0.x,v0.y\nmov posicion,v0\nmov uv,v1\n", "MOVA consecutivos"),
        ("mad-salida", "mov r0,v0\nmov r1,v1\nmad posicion,r0,r1,v2\nmov uv,v1\n", None),
    ]
    with tempfile.TemporaryDirectory(prefix="caoz-shader-") as directorio:
        for nombre, cuerpo, esperado in casos:
            fuente = Path(directorio) / f"{nombre}.v.pica"
            binario = fuente.with_suffix(".shbin")
            fuente.write_text(cabecera + cuerpo + "end\n.end\n", encoding="utf-8")
            subprocess.run([str(picasso), "-o", str(binario), str(fuente)], check=True)
            try:
                comprobar(binario.read_bytes())
            except ShaderInvalido as error:
                if esperado is None or esperado not in str(error):
                    raise AssertionError(f"regresión {nombre}: {error}") from error
            else:
                if esperado is not None:
                    raise AssertionError(f"regresión {nombre}: aceptó un shader inválido")
    return len(casos)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("binario", type=Path)
    parser.add_argument("--picasso", type=Path, help="compila además cinco casos de regresión")
    args = parser.parse_args()
    print("Shader:", comprobar(args.binario.read_bytes()))
    if args.picasso:
        print(f"Regresiones compiladas: {regresiones(args.picasso)} aprobadas")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ShaderInvalido, AssertionError, subprocess.CalledProcessError) as error:
        print(f"ERROR shader: {error}", file=sys.stderr)
        sys.exit(1)
