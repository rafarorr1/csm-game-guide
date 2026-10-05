/* PICA200: modelos Scenario, dos pesos de piel, texturas y efectos de coste acotado. */
#include "dibujo.hpp"
#include "hud.hpp"
#include "diagnostico.hpp"
#include <3ds.h>
#include <citro3d.h>
#include <citro2d.h>
#include <cstdio>
#include <cstring>
#include <algorithm>
#include "vshader_shbin.h"
namespace Grietas {
struct Vert {float x,y,z,r,g,b,nx,ny,nz,h0,h1,peso,u,v;};
struct Grupo {uint32_t inicio,cantidad;int32_t textura;};
struct Modelo {uint32_t nv=0,ni=0,nh=0,nc=0,nf=0;Vert* vertices=nullptr;u16* indices=nullptr;std::vector<float> poses;std::vector<Grupo> grupos;float minimo[3]={1e9f,1e9f,1e9f},maximo[3]={-1e9f,-1e9f,-1e9f};};
static constexpr int NUM_MODELOS=22, MAX_VERTICES_DINAMICOS=18000;
static Modelo modelos[NUM_MODELOS];
static const char*nombres[]={"adreida","mohamed","goblin","kobold","saqueador","can","troll","cobrador","entramada","piedra","taberna","pozo","carreta","piso","goblin-dosHachas","goblin-cuchillo","goblin-antorcha","kobold-capucha","kobold-acorazado","kobold-huesos","interior","mago"};
static std::vector<C3D_Tex> texturas;static C3D_Tex blanca;static bool blancaLista=false;
static C3D_RenderTarget* target=nullptr;static DVLB_s* shader=nullptr;static shaderProgram_s programa;
static bool programaListo=false;static int uProy,uModelo,uHuesos,uTinte;
static C3D_Mtx vistaProy;static Vert* dinamico=nullptr;static size_t cursorDinamico=0;
static u16* indicesPiso=nullptr;static std::vector<Vert> temporal;static float camX=0,camZ=4;static Modelo bosque;
static bool leer(Modelo&m,const char*nombre){
 char ruta[128];std::snprintf(ruta,sizeof(ruta),"romfs:/%s.bin",nombre);FILE*f=std::fopen(ruta,"rb");if(!f)return false;
 uint32_t cab[8];bool ok=fread(cab,4,8,f)==8&&cab[0]==0x34475241&&cab[1]>0&&cab[1]<65536&&cab[2]>0&&cab[2]<200000&&cab[3]>0&&cab[3]<=24&&cab[4]>0&&cab[4]<=16&&cab[5]>0&&cab[5]<=48&&cab[6]>0&&cab[6]<=16&&cab[7]==sizeof(Vert);
 if(!ok){fclose(f);return false;}m.nv=cab[1];m.ni=cab[2];m.nh=cab[3];m.nc=cab[4];m.nf=cab[5];m.grupos.resize(cab[6]);
 m.vertices=(Vert*)linearAlloc(m.nv*sizeof(Vert));size_t ib=(m.ni*2+3)&~3;m.indices=(u16*)linearAlloc(ib);if(!m.vertices||!m.indices){fclose(f);return false;}
 ok=fread(m.vertices,sizeof(Vert),m.nv,f)==m.nv&&fread(m.indices,1,ib,f)==ib&&fread(m.grupos.data(),sizeof(Grupo),m.grupos.size(),f)==m.grupos.size();
 m.poses.resize(m.nh*12*m.nc*m.nf);ok=ok&&fread(m.poses.data(),4,m.poses.size(),f)==m.poses.size();fclose(f);
 for(auto&g:m.grupos)if(g.inicio+g.cantidad>m.ni||g.cantidad%3)return false;
 for(uint32_t i=0;i<m.ni;i++)if(m.indices[i]>=m.nv)return false;
 for(uint32_t i=0;i<m.nv;i++){const float p[3]={m.vertices[i].x,m.vertices[i].y,m.vertices[i].z};for(int k=0;k<3;k++){m.minimo[k]=std::fmin(m.minimo[k],p[k]);m.maximo[k]=std::fmax(m.maximo[k],p[k]);}}
 GSPGPU_FlushDataCache(m.vertices,m.nv*sizeof(Vert));GSPGPU_FlushDataCache(m.indices,ib);return ok;
}
static bool leerTextura(C3D_Tex&t,int indice){
 char ruta[64];std::snprintf(ruta,sizeof(ruta),"romfs:/tex%d.bin",indice);FILE*f=fopen(ruta,"rb");if(!f)return false;
 uint32_t cab[3];bool ok=fread(cab,4,3,f)==3&&cab[0]==0x33584554&&cab[1]>=8&&cab[1]<=512&&cab[1]==cab[2]&&(cab[1]&(cab[1]-1))==0;
 if(!ok){fclose(f);return false;}const int maxLevel=C3D_TexCalcMaxLevel(cab[1],cab[2]);const size_t n=C3D_TexCalcTotalSize(cab[1]*cab[2]*2,maxLevel);std::vector<u8> datos(n);ok=fread(datos.data(),1,n,f)==n;fclose(f);if(!ok)return false;
 if(!C3D_TexInitMipmap(&t,cab[1],cab[2],GPU_RGB565))return false;
 size_t at=0;for(int nivel=0;nivel<=maxLevel;nivel++){C3D_TexLoadImage(&t,datos.data()+at,GPU_TEXFACE_2D,nivel);at+=(cab[1]>>nivel)*(cab[2]>>nivel)*2;}
 C3D_TexSetFilter(&t,GPU_LINEAR,GPU_LINEAR);C3D_TexSetFilterMipmap(&t,GPU_LINEAR);C3D_TexSetWrap(&t,GPU_REPEAT,GPU_REPEAT);C3D_TexFlush(&t);return true;
}
static void vert(float x,float y,float z,uint32_t c,float nx=0,float ny=1,float nz=0){temporal.push_back({x,y,z,((c>>16)&255)/255.f,((c>>8)&255)/255.f,(c&255)/255.f,nx,ny,nz,0,0,1,0,0});}
static void triangulo(float ax,float ay,float az,float bx,float by,float bz,float cx,float cy,float cz,uint32_t col){float ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,l=std::sqrt(nx*nx+ny*ny+nz*nz);if(l<.00001f)return;nx/=l;ny/=l;nz/=l;vert(ax,ay,az,col,nx,ny,nz);vert(bx,by,bz,col,nx,ny,nz);vert(cx,cy,cz,col,nx,ny,nz);}
static void caja(float x,float y,float z,float w,float h,float d,uint32_t c){float X[]={x-w/2,x+w/2},Y[]={y,y+h},Z[]={z-d/2,z+d/2};float v[8][3];for(int i=0;i<8;i++){v[i][0]=X[i&1];v[i][1]=Y[(i>>1)&1];v[i][2]=Z[(i>>2)&1];}const int caras[][4]={{0,4,6,2},{1,3,7,5},{0,1,5,4},{2,6,7,3},{0,2,3,1},{4,5,7,6}};for(auto&f:caras)for(int k=0;k<2;k++){auto&a=v[f[0]];auto&b=v[f[k+1]];auto&c2=v[f[k+2]];triangulo(a[0],a[1],a[2],b[0],b[1],b[2],c2[0],c2[1],c2[2],c);}}
static void cono(V p,float y,float r,float alto,uint32_t c,int n=7){for(int i=0;i<n;i++){V a=p+frente(i*TAU/n)*r,b=p+frente((i+1)*TAU/n)*r;triangulo(a.x,y,a.z,b.x,y,b.z,p.x,y+alto,p.z,c);}}
static void abanico(V p,float y,float radio,float dir,float apertura,uint32_t color){int n=std::max(3,(int)(apertura*6));for(int i=0;i<n;i++){V a=p+frente(dir-apertura+2*apertura*i/n)*radio,b=p+frente(dir-apertura+2*apertura*(i+1)/n)*radio;triangulo(p.x,y,p.z,a.x,y,a.z,b.x,y,b.z,color);}}
static void aro(V p,float y,float radio,float ancho,uint32_t color){for(int i=0;i<24;i++){float a=i*TAU/24,b=(i+1)*TAU/24;V p0=p+frente(a)*radio,p1=p+frente(b)*radio,p2=p+frente(b)*(radio-ancho),p3=p+frente(a)*(radio-ancho);triangulo(p0.x,y,p0.z,p1.x,y,p1.z,p2.x,y,p2.z,color);triangulo(p0.x,y,p0.z,p2.x,y,p2.z,p3.x,y,p3.z,color);}}
static void identidadHueso(){C3D_Mtx m;Mtx_Identity(&m);C3D_FVUnifMtx3x4(GPU_VERTEX_SHADER,uHuesos,&m);}
static void transformar(V p,float y,float dir,float escala=1){C3D_Mtx m;Mtx_Identity(&m);Mtx_Translate(&m,p.x,y,p.z,true);Mtx_RotateY(&m,dir,true);Mtx_Scale(&m,escala,escala,escala);C3D_FVUnifMtx4x4(GPU_VERTEX_SHADER,uModelo,&m);}
static void enviar(Vert*v,int n,u16*indices=nullptr,int ni=0){if(n<=0)return;C3D_BufInfo*buf=C3D_GetBufInfo();BufInfo_Init(buf);BufInfo_Add(buf,v,sizeof(Vert),5,0x43210);if(ni)C3D_DrawElements(GPU_TRIANGLES,ni,C3D_UNSIGNED_SHORT,indices);else C3D_DrawArrays(GPU_TRIANGLES,0,n);}
static void enviarModelo(Modelo&m,bool sinArma=false){for(const auto&g:m.grupos){if(sinArma && &g!=&m.grupos.front())continue;C3D_TexBind(0,g.textura>=0&&g.textura<(int)texturas.size()?&texturas[g.textura]:&blanca);enviar(m.vertices,m.nv,m.indices+g.inicio,g.cantidad);}}
static void objeto(int tipo,V p,float y,float dir,float alpha=1,float escala=1){Modelo&m=modelos[tipo];identidadHueso();transformar(p,y,dir,escala);C3D_FVUnifSet(GPU_VERTEX_SHADER,uTinte,.83f,.91f,1,alpha);enviarModelo(m);}
// La caja orientada incluye la altura real del tejado (hasta diez metros).
// Prueba varios rayos de la zona de combate, no sólo la posición del personaje.
static bool casaInterpuesta(const Modelo&m,V p,float y,float giro,C3D_FVec ojo,V objetivo,float alto){
 const float c=std::cos(giro),s=std::sin(giro),ox=ojo.x-p.x,oz=ojo.z-p.z,tx=objetivo.x-p.x,tz=objetivo.z-p.z;
 const float a[3]={c*ox-s*oz,ojo.y-y,s*ox+c*oz},b[3]={c*tx-s*tz,alto-y,s*tx+c*tz};
 float entrada=0,salida=.995f;
 for(int k=0;k<3;k++){const float margen=k==1?.25f:.55f,lo=m.minimo[k]-margen,hi=m.maximo[k]+margen,d=b[k]-a[k];
  if(std::fabs(d)<.0001f){if(a[k]<lo||a[k]>hi)return false;continue;}
  float t0=(lo-a[k])/d,t1=(hi-a[k])/d;if(t0>t1)std::swap(t0,t1);entrada=std::fmax(entrada,t0);salida=std::fmin(salida,t1);if(entrada>salida)return false;
 }return salida>=0&&entrada<.995f;
}
static bool camaraDentroCasa(const Modelo&m,V p,float y,float giro,C3D_FVec ojo){
 const float c=std::cos(giro),s=std::sin(giro),dx=ojo.x-p.x,dz=ojo.z-p.z,v[3]={c*dx-s*dz,ojo.y-y,s*dx+c*dz};
 for(int k=0;k<3;k++)if(v[k]<m.minimo[k]-.65f||v[k]>m.maximo[k]+.65f)return false;return true;
}
static std::array<float,15> opacidadCasas{{1,1,1,1,1,1,1,1,1,1,1,1,1,1,1}};
static void actor(const Actor&a,float y,float transparencia=1,float escala=1,bool sinArma=false){
 int tipo=a.tipo;if(a.tipo==GOBLIN){const int variante=a.variante%4;if(variante)tipo=13+variante;}if(a.tipo==KOBOLD){const int variante=a.variante%4;if(variante)tipo=16+variante;}
 Modelo&m=modelos[tipo];int anim=a.anim;if(anim==MUERTE&&(a.tipo==GOBLIN||a.tipo==COBRADOR||a.tipo==KOBOLD||a.tipo==ADREIDA)){int v=a.numero%(a.tipo==ADREIDA?2:4);if(v)anim=12+v;}int clip=std::max(0,std::min((int)m.nc-1,anim));float frame=limite(a.k,0,1)*(m.nf-1);int f=(int)frame,g=std::min((int)m.nf-1,f+1);float mezcla=frame-f;
 auto*dst=(float*)C3D_FVUnifWritePtr(GPU_VERTEX_SHADER,uHuesos,m.nh*3);int tam=m.nh*12;const float*A=m.poses.data()+(clip*m.nf+f)*tam,*B=m.poses.data()+(clip*m.nf+g)*tam;for(int n=0;n<tam;n++)dst[n]=A[n]+(B[n]-A[n])*mezcla;
 transformar(a.p,y,a.dir,escala*a.escala);float fade=a.estado==CAIDO?limite((2.5f-a.t)/.8f,0,1):1;float flash=a.flash>0?.5f:0;
 C3D_FVUnifSet(GPU_VERTEX_SHADER,uTinte,.95f+flash,.98f+flash*.5f,1,fade*transparencia);enviarModelo(m,sinArma);
}
static void lote(float alpha=1){if(temporal.empty())return;size_t n=std::min<size_t>(temporal.size(),MAX_VERTICES_DINAMICOS-cursorDinamico);n-=n%3;if(n){Vert* segmento=dinamico+cursorDinamico;std::memcpy(segmento,temporal.data(),n*sizeof(Vert));GSPGPU_FlushDataCache(segmento,n*sizeof(Vert));cursorDinamico+=n;identidadHueso();transformar({},0,0);C3D_FVUnifSet(GPU_VERTEX_SHADER,uTinte,1,1,1,alpha);C3D_TexBind(0,&blanca);enviar(segmento,n);}temporal.clear();}
// Citro2D cambia shaders, atributos, mezclado y combinadores al dibujar el HUD.
static void estado3D(){
 // El shader 3D sólo entrega UV0; no heredar el generador UV1 del HUD.
 C3D_ProcTexBind(0,nullptr);
 C3D_BindProgram(&programa);auto*a=C3D_GetAttrInfo();AttrInfo_Init(a);AttrInfo_AddLoader(a,0,GPU_FLOAT,3);AttrInfo_AddLoader(a,1,GPU_FLOAT,3);AttrInfo_AddLoader(a,2,GPU_FLOAT,3);AttrInfo_AddLoader(a,3,GPU_FLOAT,3);AttrInfo_AddLoader(a,4,GPU_FLOAT,2);
 for(int n=0;n<6;n++){C3D_TexEnvInit(C3D_GetTexEnv(n));}
 auto*env=C3D_GetTexEnv(0);C3D_TexEnvSrc(env,C3D_RGB,GPU_TEXTURE0,GPU_PRIMARY_COLOR,GPU_PRIMARY_COLOR);C3D_TexEnvFunc(env,C3D_RGB,GPU_MODULATE);C3D_TexEnvSrc(env,C3D_Alpha,GPU_PRIMARY_COLOR,GPU_PRIMARY_COLOR,GPU_PRIMARY_COLOR);C3D_TexEnvFunc(env,C3D_Alpha,GPU_REPLACE);
 C3D_CullFace(GPU_CULL_NONE);C3D_DepthTest(true,GPU_GREATER,GPU_WRITE_ALL);C3D_AlphaTest(false,GPU_ALWAYS,0);C3D_AlphaBlend(GPU_BLEND_ADD,GPU_BLEND_ADD,GPU_SRC_ALPHA,GPU_ONE_MINUS_SRC_ALPHA,GPU_ONE,GPU_ONE_MINUS_SRC_ALPHA);C3D_FogGasMode(GPU_NO_FOG,GPU_PLAIN_DENSITY,false);
}
bool iniciarDibujo(ProgresoDibujo progreso){
 auto informar=[&](float v,const char*s){if(progreso)progreso(v,s);};informar(.05f,"Preparando PICA200");
 shader=DVLB_ParseFile((u32*)vshader_shbin,vshader_shbin_size);if(!shader)return false;shaderProgramInit(&programa);programaListo=true;shaderProgramSetVsh(&programa,&shader->DVLE[0]);C3D_BindProgram(&programa);
 uProy=shaderInstanceGetUniformLocation(programa.vertexShader,"proyeccion");uModelo=shaderInstanceGetUniformLocation(programa.vertexShader,"modelo");uHuesos=shaderInstanceGetUniformLocation(programa.vertexShader,"huesos");uTinte=shaderInstanceGetUniformLocation(programa.vertexShader,"tinte");if(uHuesos<0||uHuesos+72>96)return false;
 if(!C3D_TexInit(&blanca,8,8,GPU_RGB565))return false;
 blancaLista=true;u16 pixeles[64];std::fill(pixeles,pixeles+64,0xffff);C3D_TexUpload(&blanca,pixeles);C3D_TexSetFilter(&blanca,GPU_NEAREST,GPU_NEAREST);C3D_TexFlush(&blanca);
 FILE*f=fopen("romfs:/texturas.bin","rb");uint32_t numero=0;if(!f)return false;bool correcto=fread(&numero,4,1,f)==1&&numero>0&&numero<64;fclose(f);if(!correcto)return false;texturas.resize(numero);
 for(uint32_t i=0;i<numero;i++){informar(.1f+.32f*i/numero,"Cargando los materiales de Tomsage");if(!leerTextura(texturas[i],i))return false;}
 for(int i=0;i<NUM_MODELOS;i++){informar(.42f+.45f*i/NUM_MODELOS,nombres[i]);if(!leer(modelos[i],nombres[i]))return false;}
 indicesPiso=(u16*)linearAlloc(modelos[13].ni*sizeof(u16));if(!indicesPiso)return false;
 dinamico=(Vert*)linearAlloc(MAX_VERTICES_DINAMICOS*sizeof(Vert));if(!dinamico)return false;temporal.reserve(MAX_VERTICES_DINAMICOS);
 // Bosque persistente en un único buffer: árboles de varias alturas y tres copas.
 // El césped sólo rodea la plaza; una lámina debajo taparía el cráter profundo.
 auto cesped=[](float x0,float z0,float x1,float z1){triangulo(x0,-.08f,z0,x0,-.08f,z1,x1,-.08f,z1,0x253d36);triangulo(x0,-.08f,z0,x1,-.08f,z1,x1,-.08f,z0,0x253d36);};
 cesped(-90,-90,-28,90);cesped(28,-90,90,90);cesped(-28,-90,28,-28);cesped(-28,28,28,90);
 for(int i=0;i<128;i++){float a=i*2.399963f,r=30+(i*17%24),alto=3.8f+(i*7%19)*.16f;V p{std::cos(a)*r,std::sin(a)*r};caja(p.x,0,p.z,.22f,alto*.72f,.22f,0x413d35);cono(p,alto*.20f,1.55f,alto*.59f,0x27443d);cono(p,alto*.43f,1.15f,alto*.55f,0x325447);cono(p,alto*.69f,.76f,alto*.43f,0x3a5c4f);}
 bosque.nv=temporal.size();bosque.vertices=(Vert*)linearAlloc(bosque.nv*sizeof(Vert));if(!bosque.vertices)return false;std::memcpy(bosque.vertices,temporal.data(),bosque.nv*sizeof(Vert));GSPGPU_FlushDataCache(bosque.vertices,bosque.nv*sizeof(Vert));temporal.clear();
 // El callback dibuja su propia pantalla antes de crear el target definitivo.
 informar(.98f,"Abriendo las puertas de la ciudad");
 target=C3D_RenderTargetCreate(240,400,GPU_RB_RGBA8,GPU_RB_DEPTH24_STENCIL8);if(!target)return false;C3D_RenderTargetSetOutput(target,GFX_TOP,GFX_LEFT,GX_TRANSFER_FLIP_VERT(0)|GX_TRANSFER_OUT_TILED(0)|GX_TRANSFER_RAW_COPY(0)|GX_TRANSFER_IN_FORMAT(GX_TRANSFER_FMT_RGBA8)|GX_TRANSFER_OUT_FORMAT(GX_TRANSFER_FMT_RGB8)|GX_TRANSFER_SCALING(GX_TRANSFER_SCALE_NO));return true;
}
static float fraccion(float v){return v-std::floor(v);}
static float azarVisual(int i){return fraccion(std::sin(i*127.1f+311.7f)*43758.5453f);}
static void cinta(V a,float ay,V b,float by,float ancho,uint32_t color){
 V lado=unidad(V{b.z-a.z,a.x-b.x})*ancho;if(largo(lado)<.001f)lado={ancho,0};
 triangulo(a.x-lado.x,ay,a.z-lado.z,a.x+lado.x,ay,a.z+lado.z,b.x+lado.x,by,b.z+lado.z,color);
 triangulo(a.x-lado.x,ay,a.z-lado.z,b.x+lado.x,by,b.z+lado.z,b.x-lado.x,by,b.z-lado.z,color);
}
static void lluvia(const Juego&j){
 const float fuerza=j.secuencia==EPILOGO_MAGO?j.lluviaNarrativa:1;if(fuerza<=.01f)return;
 const bool portal=j.secuencia==EPILOGO_MAGO&&j.secuenciaT>9.5f&&j.secuenciaT<12;
 const int gotas=int(110*fuerza);C3D_DepthTest(true,GPU_GREATER,GPU_WRITE_COLOR);
 for(int i=0;i<gotas;i++){
  const float rapidez=11+azarVisual(i+700)*5,ciclo=fraccion(j.tiempo*rapidez/12+azarVisual(i+1));
  float y=12*(1-ciclo);V p{camX+(azarVisual(i+200)-.5f)*30+3*ciclo,camZ+(azarVisual(i+400)-.5f)*25+1.3f*ciclo};
  V cola=p-V{.18f,.08f};float colaY=y+.65f;
  if(portal){const float pull=std::sin(limite((j.secuenciaT-9.5f)/2.5f,0,1)*PI),radio=distancia(p,j.mago.p),peso=pull*std::fmax(0.f,1-radio/20);p=p+(j.mago.p-p)*(peso*.5f);cola=cola+(j.mago.p-cola)*(peso*.38f);y+=peso*2.3f;colaY+=peso*2.1f;}
  cinta(p,y,cola,colaY,.009f,0x8db7c6);
 }
 lote(.34f);
 // Ondas en charcos: pocas líneas en lugar de superficies reflectantes por pasada.
 for(int i=0;i<6;i++){V p{(azarVisual(i+600)-.5f)*22,(azarVisual(i+620)-.5f)*20};float k=fraccion(j.tiempo*.8f+i*.17f);aro(p,.025f,.1f+k*.38f,.012f,0x68858b);}lote(.2f);
 C3D_DepthTest(true,GPU_GREATER,GPU_WRITE_ALL);
}
static void magoVisual(const Juego&j){
 if(j.secuencia!=EPILOGO_MAGO)return;
 const float t=j.secuenciaT;
 if(t<7.5f||t>11.25f){float alto=t>8?4.8f:.65f+std::sin(j.tiempo*2)*.08f;float alfa=t>8?limite((t-11.25f)*3,0,1):1;
  objeto(21,j.mago.p,alto,j.mago.dir,alfa);
  for(int i=0;i<16;i++){float a=i*.6f+j.tiempo*2;V p=j.mago.p+frente(a)*(.7f+.1f*std::sin(i));cinta(p,alto+.1f+i*.13f,p+frente(a+.8f)*.13f,alto+.22f+i*.13f,.025f,0x53de89);}lote(.72f);
 }
 if(t>=7.5f&&t<12){
  float reunir=limite((t-9.4f)/2.2f,0,1);for(int i=0;i<70;i++){
   float a=i*2.399963f,d=(1-reunir)*(1.4f+azarVisual(i)*4),alto=.4f+azarVisual(i+200)*2.8f+reunir*4.2f;V centro=V{0,-1}*(1-reunir)+j.mago.p*reunir;
   V p=centro+frente(a+j.tiempo*.4f)*d;V cola=p-frente(a)*(.1f+.25f*reunir);cinta(p,alto,cola,alto-.1f,.018f,0x77f0a8);
  }lote(.8f);
  if(t>10&&t<11.6f){float k=limite((t-10)/1.6f,0,1);aro(j.mago.p,4.7f,1.5f*std::sin(k*PI),.09f,0x86ffc1);lote(.7f);}
 }
 if(t>13.8f&&t<16.5f){const float a=limite((t-13.8f)/.25f,0,1)*limite((16.5f-t)/1,0,1);
  for(int lado:{-1,1}){V p=j.mago.p+V{lado*.45f,0},p2=j.mago.p+V{lado*9.f,-7};cinta(p,6.3f,p2,29,.07f,0x91ffd0);}lote(a);
 }
}
static void meteoritoVisual(const Juego&j){
 if(j.secuencia!=EPILOGO_MAGO||j.secuenciaT<15.2f)return;
 float t=j.secuenciaT;
 if(t<17){float k=limite((t-15.2f)/1.8f,0,1);V p=j.h.p+V{-5,3}*(1-k);float y=32*(1-k*k);
  cono(p,y,1.5f,2.2f,0x315c43,9);cono(p,y,1.5f,-1.8f,0x4b7960,9);lote();aro(p,y+.05f,1.62f,.18f,0x82e8a2);lote(.8f);
 }
 if(t>=17){float onda=(t-17)*23;aro(j.h.p,.45f,onda,.7f,0x6aec91);aro(j.h.p,.1f,onda*.95f,.35f,0xd1ffb1);lote(limite((19-t)/2,0,1));
  for(int i=0;i<36;i++){float k=limite((t-17-azarVisual(i)*.25f)/2,0,1),a=i*2.399963f;V p=j.h.p+frente(a)*(2.5f+azarVisual(i+60)*4+k*4);caja(p.x,std::sin(k*PI)*4-k*7,p.z,.55f,.25f,.55f,0x767d73);}lote();
 }
}
static void cielo(const Juego&j){
 float temporalRayo=std::fmod(j.tiempo+7.3f,18.73f);float flash=temporalRayo<.09f||(temporalRayo>.22f&&temporalRayo<.27f)?.45f:0;
 if(j.secuencia==EPILOGO_MAGO&&j.secuenciaT>12&&j.secuenciaT<16.6f){float t=j.secuenciaT;flash=std::fmod(t*1.13f,1.73f)<.1f||std::fmod(t*.79f,.93f)<.07f?.8f:.18f;}
 if(flash>.3f){for(int i=0;i<3;i++){float x=-30+i*29+std::sin(j.tiempo*.2f)*3;V p{x,-39};cinta(p,28,p+V{1,-1},22,.05f,0x9ce8ca);cinta(p+V{1,-1},22,p+V{-.5f,-1.5f},17,.055f,0x9ce8ca);cinta(p+V{-.5f,-1.5f},17,p+V{1.2f,-2.1f},12,.06f,0x9ce8ca);}lote(flash);}
 // Bancos de niebla bajos al pie de los árboles, nunca sobre los avisos de combate.
 C3D_DepthTest(true,GPU_GREATER,GPU_WRITE_COLOR);for(int i=0;i<14;i++){float a=i*TAU/14;V p=frente(a)*29;abanico(p,.1f+std::sin(j.tiempo*.17f+i)*.05f,4.6f,0,PI,0x6b9697);}lote(.11f);C3D_DepthTest(true,GPU_GREATER,GPU_WRITE_ALL);
}
static void pisoVisual(const Juego&j){
 if(j.crater<=0){objeto(13,{},0,0);return;}
 Modelo&m=modelos[13];const float radio=8*j.crater;uint32_t n=0;
 for(uint32_t i=0;i<m.ni;i+=3){V p{};for(int k=0;k<3;k++){const Vert&v=m.vertices[m.indices[i+k]];p.x+=v.x/3;p.z+=v.z/3;}if(distancia(p,j.h.p)>radio){indicesPiso[n++]=m.indices[i];indicesPiso[n++]=m.indices[i+1];indicesPiso[n++]=m.indices[i+2];}}
 GSPGPU_FlushDataCache(indicesPiso,n*sizeof(u16));identidadHueso();transformar({},0,0);C3D_FVUnifSet(GPU_VERTEX_SHADER,uTinte,.83f,.91f,1,1);C3D_TexBind(0,&texturas[m.grupos[0].textura]);enviar(m.vertices,m.nv,indicesPiso,n);
 // Paredes del cráter hasta ocho metros bajo la plaza: geometría, no un decal.
 for(int i=0;i<32;i++){V a=j.h.p+frente(i*TAU/32)*(radio+1),b=j.h.p+frente((i+1)*TAU/32)*(radio+1),c=j.h.p+frente((i+1)*TAU/32)*(radio*.52f),d=j.h.p+frente(i*TAU/32)*(radio*.52f);triangulo(a.x,0,a.z,b.x,0,b.z,c.x,-8,c.z,0x333e39);triangulo(a.x,0,a.z,c.x,-8,c.z,d.x,-8,d.z,0x29312e);}
 abanico(j.h.p,-7.95f,radio*.54f,0,PI,0x9f421e);aro(j.h.p,-7.92f,radio*.34f,.12f,0xe89a35);lote();
}
void dibujar(Juego&j){
 static unsigned cuadrosInicio=0;
 if(cuadrosInicio<3)registrarInicio("Esperando la GPU antes del cuadro 3D");
 C3D_FrameBegin(C3D_FRAME_SYNCDRAW);
 if(cuadrosInicio<3)registrarInicio("La GPU terminó el cuadro anterior");
 if(cuadrosInicio==2)terminarRegistro();
 cursorDinamico=0;temporal.clear();C3D_RenderTargetClear(target,C3D_CLEAR_ALL,0x152632ff,0);C3D_FrameDrawOn(target);estado3D();
 C3D_Mtx proy,vista;camX+=(j.h.p.x-camX)*.12f;camZ+=(j.h.p.z-camZ)*.12f;float shake=std::sin(j.tiempo*53)*j.sacudida*.3f;
 C3D_FVec ojo=FVec3_New(camX+shake,17,camZ+13),mirada=FVec3_New(camX,.7f,camZ);float fov=32;
 const bool casa=j.secuencia==CASA_GOBLIN;const bool cine=j.secuencia==EPILOGO_MAGO;const float t=j.secuenciaT;
 if(casa){ojo=FVec3_New(0,6.8f,9.3f);mirada=FVec3_New(0,.65f,-.65f);fov=42;}
 else if(cine){
  if(j.plano==0){ojo=FVec3_New(j.puertaCasa.x-6,2.5f,6);mirada=FVec3_New(j.h.p.x,1.05f,j.h.p.z);fov=42;}
  else if(j.plano==1){ojo=FVec3_New(9-(t-2)*1.8f,2.1f,5.2f);mirada=FVec3_New(j.mago.p.x,1.5f,j.mago.p.z);fov=40+(t-2)*6;}
  else if(j.plano==2){V f=frente(j.h.dir);ojo=FVec3_New(j.h.p.x+f.x*.28f,1.64f+std::sin(j.tiempo*15)*.026f,j.h.p.z+f.z*.28f);mirada=FVec3_New(j.mago.p.x,1.5f,j.mago.p.z);fov=62;}
  else if(j.plano==3){ojo=FVec3_New(j.h.destino.x-5.5f,3.1f,j.h.destino.z+7);mirada=FVec3_New(j.h.p.x,1.25f,j.h.p.z);fov=45;}
  else if(j.plano==4||j.plano==5){ojo=FVec3_New(j.h.p.x,1.6f,j.h.p.z);float k=limite((t-10)/1.5f,0,1);mirada=FVec3_New(j.h.p.x+(j.mago.p.x-j.h.p.x)*k,1.8f+k*4.4f,j.h.p.z-2+(j.mago.p.z-j.h.p.z+2)*k);fov=58;}
  else if(t<16.6f){ojo=FVec3_New(j.h.p.x,1.6f,j.h.p.z);mirada=FVec3_New(j.h.p.x-3,16+(t-15.2f)*13,j.h.p.z+2);fov=48;}
  else {ojo=FVec3_New(-7,31,32);mirada=FVec3_New(0,-1,0);fov=43;}
 }
 Mtx_PerspTilt(&proy,fov*PI/180,400.f/240,.1f,150,false);Mtx_LookAt(&vista,ojo,mirada,FVec3_New(0,1,0),false);Mtx_Multiply(&vistaProy,&proy,&vista);C3D_FVUnifMtx4x4(GPU_VERTEX_SHADER,uProy,&vistaProy);
 if(casa){
  objeto(20,{},0,0);for(const auto&f:j.familia)actor(f,0,1,1,true);actor(j.h,j.alto(j.h));
  const float flash=std::fmod(j.tiempo,14.31f);if(flash<.15f){cinta({2.13f,-3.4f},2.2f,{2.35f,-3.4f},1.2f,.035f,0xb4e4ed);lote(.8f);}
 }else{
  identidadHueso();transformar({},0,0);C3D_FVUnifSet(GPU_VERTEX_SHADER,uTinte,.62f,.78f,.85f,1);C3D_TexBind(0,&blanca);enviar(bosque.vertices,bosque.nv);pisoVisual(j);
  struct CasaTransparente {int tipo;V p;float y,giro,alfa;};std::array<CasaTransparente,15> ocultas{};int casasOcultas=0;
  for(int i=0;i<15;i++){float a=i*TAU/15;bool puerta=false;for(float c:{-PI/2,PI/6,PI*5/6})if(std::fabs(delta(a,c))<.3f)puerta=true;if(puerta)continue;V p{std::cos(a)*19.2f,std::sin(a)*19.2f};if(!cine&&distancia(p,j.h.p)>27)continue;
   float impacto=cine&&t>17?limite((t-17-distancia(p,j.h.p)/23)*1.8f,0,1):0;V desplazamiento=unidad(p-j.h.p)*(impacto*2.6f);
   const int tipo=8+i%3;const V posicion=p+desplazamiento;const float altura=-impacto*1.25f,giro=angulo(p*-1)+impacto*.12f;
   if(camaraDentroCasa(modelos[tipo],posicion,altura,giro,ojo)){opacidadCasas[i]=.075f;continue;}
   bool tapa=false;if(!cine)for(V margen:std::array<V,5>{{{0,0},{-3.2f,0},{3.2f,0},{0,-2.4f},{0,2.4f}}})if(casaInterpuesta(modelos[tipo],posicion,altura,giro,ojo,j.h.p+margen,.85f)){tapa=true;break;}
   const float deseada=tapa?.075f:1;opacidadCasas[i]+=(deseada-opacidadCasas[i])*.22f;float alfa=cine?1:opacidadCasas[i];
   if(alfa<.995f)ocultas[casasOcultas++]={tipo,posicion,altura,giro,alfa};else objeto(tipo,posicion,altura,giro);
  }
  objeto(11,{-5,-3},0,.27f);objeto(12,{6.5f,-5.5f},0,.3f);
  for(int i=0;i<48;i++){float a=i*TAU/48;V p{std::cos(a)*26.5f,std::sin(a)*26.5f};bool puerta=false;for(float c:{-PI/2,PI/6,PI*5/6})if(std::fabs(delta(a,c))<.09f)puerta=true;if(!cine&&distancia(p,j.h.p)>28)continue;
   if(!puerta){caja(p.x,0,p.z,3.5f,3.4f,1.2f,0x626f6c);caja(p.x,3.4f,p.z,1.4f,.7f,1.3f,0x75827b);}else{caja(p.x,3.7f,p.z,4,1,1.2f,0x82765f);for(int k=-3;k<=3;k++)caja(p.x+k*.4f,0,p.z,.08f,3.7f,.08f,0x424345);}}
  for(V p:std::array<V,2>{{{-3.5f,7.5f},{4.5f,-10}}}){caja(p.x,0,p.z,.38f,.2f,.38f,0x79746a);caja(p.x,.2f,p.z,.12f,1.8f,.12f,0x45474b);caja(p.x,2,p.z,.42f,.6f,.42f,0xb98649);caja(p.x,2.6f,p.z,.56f,.15f,.56f,0x80664d);}
  caja(8.5f,0,4.8f,1.1f,1.2f,1.1f,0x6c4e36);lote();
  for(const auto&e:j.enemigos){if(distancia(e.p,j.h.p)<22)abanico(e.p,.015f,e.tipo==TROLL?.9f:.4f,0,PI,0x192026);}
  abanico(j.h.p,.015f,.5f,0,PI,0x192026);lote(.62f);
  for(const auto&e:j.enemigos){if(e.estado!=PREPARA)continue;float radio=j.avisoRadio(e),dur=j.avisoDur(e);uint32_t c=j.imparable(e)?0xb683c8:dur-e.t<.18f?0xbdf5ff:0xe8a15e;
   if(e.tipo==KOBOLD){V b=e.p+frente(e.dir)*11;cinta(e.p,.035f,b,.035f,.045f,c);}else if(j.imparable(e))abanico(e.p,.035f,radio,0,PI,c);else if(e.tipo==CAN&&e.combo==1){abanico(e.p,.035f,radio,e.dir-PI/3,PI/6,c);abanico(e.p,.035f,radio,e.dir+PI/3,PI/6,c);}else abanico(e.p,.035f,radio,e.dir,e.tipo==CAN?PI/6:1.1f,c);
  }
  for(const auto&p:j.proyectiles){if(p.tipo==1||p.tipo==2)aro(p.destino,.04f,p.radio,.07f,p.dur-p.t<.25f?0xc5ffff:p.dur-p.t<.55f?0xffdc55:0xec8049);}
  lote(.42f);
  for(const auto&e:j.efectos){float k=e.t/e.dur;if(e.tipo==4){abanico(e.p,.022f,e.radio,0,PI,0x151b1c);aro(e.p,.06f,e.radio,.1f,0x65736b);lote((1-k)*.85f);}else if(e.tipo==5)caja(e.p.x,std::sin(k*PI)*1.5f,e.p.z,e.radio,e.radio,e.radio,e.color);else aro(e.p,.1f,e.radio*(.4f+k*.6f),.07f,e.color);}lote(.8f);
  for(const auto&e:j.enemigos)if(distancia(e.p,j.h.p)<22)actor(e,0);
  const bool pov=cine&&(j.plano==2||j.plano==4||j.plano==5||(j.plano==6&&t<16.6f));if(!pov)actor(j.h,j.alto(j.h),j.h.tipo==MOHAMED&&j.ultiActivo>0?.3f:1);if(j.tieneAliado)actor(j.aliado,0,.65f);
  if(j.secuencia==ENTRADA_TROLL&&j.plano==1){float r=limite((t-1.2f)/4.2f,0,1);abanico(j.llaveP,.02f,2.1f*r,0,PI,0x0c151a);lote(.7f*r);if(t>4.6f){Actor troll;troll.tipo=TROLL;troll.p=j.llaveP;troll.anim=SALTO;troll.k=limite((t-4.6f)/.85f,0,1);actor(troll,std::fmax(0.f,(5.45f-t)*13));}}
  for(const auto&p:j.proyectiles){if(p.tipo==2){Actor a;a.tipo=COBRADOR;a.p=p.p;a.anim=DOLOR;a.k=.5f;a.dir=j.tiempo*5;actor(a,p.alto);}else if(p.tipo==1){cono(p.p,p.alto,.4f,.5f,0x8c9487,6);cono(p.p,p.alto,.4f,-.3f,0x6b786a,6);}else if(p.tipo==3||p.tipo==4){caja(p.p.x,p.alto,p.p.z,.12f,.45f,.09f,0xe5b660);caja(p.p.x,p.alto+.3f,p.p.z,.48f,.16f,.12f,0xf3d574);aro(p.p,p.alto,.34f,.035f,0xd0b67e);}else {V d=unidad(p.vel);cinta(p.p,1.05f,p.p-d*.65f,1.05f,.035f,p.enemigo?0xffbe61:0xc1e8f3);}}
  for(const auto&o:j.objetos){if(o.tipo==1){float y=.38f+std::sin(j.tiempo*2)*.05f;caja(o.p.x,y,o.p.z,.35f,.5f,.055f,0xb99151);caja(o.p.x,y+.045f,o.p.z+.04f,.26f,.41f,.015f,0x2b4856);}else if(o.tipo==2){aro(o.p,.12f,.17f,.055f,0xd7c478);caja(o.p.x,.14f,o.p.z+.2f,.07f,.07f,.35f,0xd7c478);}else{cono(o.p,.15f,.15f,.28f,0xab3340,8);cono(o.p,.15f,.15f,-.1f,0x7a3542,8);caja(o.p.x,.43f,o.p.z,.12f,.08f,.12f,0xc1ac79);}}lote();
  if(j.fuegoT>0){for(int i=0;i<7;i++){float k=fraccion(j.tiempo*2.2f+i*.173f);V p=j.h.p+frente(i*TAU/7)*.25f;cinta(p,.3f+k,p+V{.03f,0},.65f+k,.075f,0xe79c43);}lote(.72f);}
  C3D_DepthTest(true,GPU_GREATER,GPU_WRITE_COLOR);for(int i=0;i<casasOcultas;i++){const auto&c=ocultas[i];objeto(c.tipo,c.p,c.y,c.giro,c.alfa);}C3D_DepthTest(true,GPU_GREATER,GPU_WRITE_ALL);
  magoVisual(j);meteoritoVisual(j);cielo(j);lluvia(j);
 }
 if(cuadrosInicio<2)registrarInicio("Escena preparada; preparando HUD");
 dibujarHUDSuperior(j,target);dibujarHUD(j);C2D_Flush();
 if(cuadrosInicio<2)registrarInicio("Enviando escena y HUD a la GPU");
 C3D_FrameEnd(0);
 if(cuadrosInicio<2)registrarInicio("Cuadro enviado; falta confirmar su ejecución");
 if(cuadrosInicio<3)cuadrosInicio++;
}
void cerrarDibujo(){
 for(auto&m:modelos){if(m.vertices)linearFree(m.vertices);if(m.indices)linearFree(m.indices);m.vertices=nullptr;m.indices=nullptr;}
 for(auto&t:texturas){if(t.data)C3D_TexDelete(&t);}
 texturas.clear();if(blancaLista){C3D_TexDelete(&blanca);blancaLista=false;}
 if(indicesPiso)linearFree(indicesPiso);
 if(bosque.vertices)linearFree(bosque.vertices);
 if(dinamico)linearFree(dinamico);
 if(target)C3D_RenderTargetDelete(target);
 if(programaListo)shaderProgramFree(&programa);
 if(shader)DVLB_Free(shader);
}
}
