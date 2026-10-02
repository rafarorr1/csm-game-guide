# Convierte el shader compilado a datos C, sin herramientas externas adicionales.
import pathlib,sys
b=pathlib.Path(sys.argv[1]).read_bytes()
pathlib.Path(sys.argv[2]).write_text('const unsigned char vshader_shbin[] __attribute__((aligned(4))) = {'+','.join(map(str,b))+'};\nconst unsigned int vshader_shbin_size = '+str(len(b))+';\n')
