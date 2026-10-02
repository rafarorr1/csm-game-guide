# Construcción reproducible para ARM11 de la 3DS original.
DEVKITPRO ?= /opt/devkitpro
DEVKITARM ?= $(DEVKITPRO)/devkitARM
PREFIX := $(DEVKITARM)/bin/arm-none-eabi-
CC := $(PREFIX)gcc
CXX := $(PREFIX)g++
TARGET := LasGrietas3DS
ARCH := -march=armv6k -mtune=mpcore -mfloat-abi=hard -mtp=soft
FLAGS := $(ARCH) -O2 -g -Wall -Wextra -ffunction-sections -fdata-sections -D__3DS__ -Iinclude -I$(DEVKITPRO)/libctru/include
CXXFLAGS := $(FLAGS) -std=gnu++17 -fno-rtti -fno-exceptions
LDFLAGS := $(ARCH) -specs=3dsx.specs -Wl,--gc-sections -Wl,-Map,build/$(TARGET).map -L$(DEVKITPRO)/libctru/lib
OBJECTS := build/main.o build/juego.o build/dibujo.o build/vshader.o
.PHONY: all clean
all: $(TARGET).3dsx $(TARGET).smdh
build:
	mkdir -p build
build/%.o: source/%.cpp include/juego.hpp include/dibujo.hpp | build
	$(CXX) $(CXXFLAGS) -MMD -MP -c $< -o $@
build/vshader.shbin: source/vshader.v.pica | build
	$(DEVKITPRO)/tools/bin/picasso -o $@ $<
build/vshader.c: build/vshader.shbin tools/incrustar.py
	python3 tools/incrustar.py $< $@
build/vshader.o: build/vshader.c
	$(CC) $(FLAGS) -c $< -o $@
$(TARGET).elf: $(OBJECTS)
	$(CXX) $(LDFLAGS) $(OBJECTS) -lcitro3d -lctru -lm -o $@
$(TARGET).smdh:
	$(DEVKITPRO)/tools/bin/smdhtool --create "Las Grietas del Editor" "Adaptacion 3DS - prototipo" "Caoz" $(DEVKITPRO)/libctru/default_icon.png $@
$(TARGET).3dsx: $(TARGET).elf $(TARGET).smdh
	$(DEVKITPRO)/tools/bin/3dsxtool $< $@ --smdh=$(TARGET).smdh --romfs=romfs
clean:
	rm -rf build $(TARGET).elf $(TARGET).3dsx $(TARGET).smdh
-include build/*.d
