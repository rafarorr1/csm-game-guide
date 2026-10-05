# Construcción reproducible para ARM11 de la 3DS original.
DEVKITPRO ?= /opt/devkitpro
DEVKITARM ?= $(DEVKITPRO)/devkitARM
PREFIX := $(DEVKITARM)/bin/arm-none-eabi-
CC := $(PREFIX)gcc
CXX := $(PREFIX)g++
TARGET := CaozARPG
ARCH := -march=armv6k -mtune=mpcore -mfloat-abi=hard -mtp=soft
FLAGS := $(ARCH) -O2 -g -Wall -Wextra -ffunction-sections -fdata-sections -D__3DS__ -Iinclude -I$(DEVKITPRO)/libctru/include
CXXFLAGS := $(FLAGS) -std=gnu++17 -fno-rtti -fno-exceptions
LDFLAGS := $(ARCH) -specs=3dsx.specs -Wl,--gc-sections -Wl,-Map,build/$(TARGET).map -L$(DEVKITPRO)/libctru/lib
OBJECTS := build/main.o build/juego.o build/dibujo.o build/hud.o build/audio.o build/vshader.o
# Un cambio de recursos debe reconstruir el contenedor aunque el ELF sea idéntico.
ROMFS_FILES := $(shell find romfs -type f)
.PHONY: all clean paquete
all: $(TARGET).3dsx $(TARGET).smdh
build:
	mkdir -p build
build/%.o: source/%.cpp | build
	$(CXX) $(CXXFLAGS) -MMD -MP -c $< -o $@
build/vshader.shbin: source/vshader.v.pica | build
	$(DEVKITPRO)/tools/bin/picasso -o $@ $<
build/vshader.c: build/vshader.shbin tools/incrustar.py
	python3 tools/incrustar.py $< $@
build/vshader.o: build/vshader.c
	$(CC) $(FLAGS) -c $< -o $@
build/audio.stamp: tools/audio.py | build
	python3 tools/audio.py
	touch $@
build/icono.png: tools/icono.py | build
	python3 tools/icono.py $@
$(TARGET).elf: $(OBJECTS) Makefile
	$(CXX) $(LDFLAGS) $(OBJECTS) -lcitro2d -lcitro3d -lctru -lm -o $@
$(TARGET).smdh: build/icono.png Makefile
	$(DEVKITPRO)/tools/bin/smdhtool --create "Caoz ARPG" "La plaza de Tomsage - Old 3DS" "Caoz" build/icono.png $@
$(TARGET).3dsx: $(TARGET).elf $(TARGET).smdh $(ROMFS_FILES) build/audio.stamp
	$(DEVKITPRO)/tools/bin/3dsxtool $< $@ --smdh=$(TARGET).smdh --romfs=romfs
paquete: all
	python3 tools/empaquetar.py
clean:
	rm -rf build $(TARGET).elf $(TARGET).3dsx $(TARGET).smdh
-include build/*.d
