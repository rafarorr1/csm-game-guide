/* Genera GLB reales usando el SDK instalado fuera del repositorio.
 * node generar.mjs [ruta/a/kiln-install]
 * No instala dependencias ni modifica configuración global.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const carpeta = path.dirname(fileURLToPath(import.meta.url));
const instalacion = path.resolve(process.argv[2] || path.join(carpeta, '../../../../kiln-install'));
const paquete = path.join(instalacion, 'node_modules/@instruktlabs/kiln');
const manifiestoPaquete = JSON.parse(await fs.readFile(path.join(paquete, 'package.json'), 'utf8'));
const entrada = manifiestoPaquete.exports['.'].import;
const {renderGLB, validateKilnCode, engineIdentity} = await import(pathToFileURL(path.join(paquete, entrada)).href);
const identidad = engineIdentity();
if (identidad.version !== '1.1.0') throw new Error('Requiere Kiln 1.1.0; encontrado ' + identidad.version);
const lock = JSON.parse(await fs.readFile(path.join(instalacion, 'package-lock.json'), 'utf8'));
const motor = {nombre: '@instruktlabs/kiln', version: identidad.version, referencia: '@instruktlabs/kiln@' + identidad.version, npmIntegrity: lock.packages['node_modules/@instruktlabs/kiln'].integrity};
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const plantilla = await fs.readFile(path.join(carpeta, 'fuente.kiln.js'), 'utf8');
await fs.mkdir(path.join(carpeta, 'fuentes'), {recursive: true});
await fs.mkdir(path.join(carpeta, 'glb'), {recursive: true});
const opciones = {gltfExporter: 'three', geometryPolicy: 'strict', optimize: 'off', instance: 'off'};
const resultados = [];
for (const id of ['pavimento', 'borde', 'hito']) {
  const fuente = plantilla.replace("const MODULO = 'pavimento';", `const MODULO = '${id}';`);
  const validacion = validateKilnCode(fuente);
  if (!validacion.valid) throw new Error(JSON.stringify(validacion));
  const resultado = await renderGLB(fuente, opciones);
  if (resultado.tris > {pavimento: 700, borde: 500, hito: 650}[id]) throw new Error('Presupuesto de triángulos: ' + id);
  await fs.writeFile(path.join(carpeta, 'fuentes', id + '.kiln.js'), fuente);
  await fs.writeFile(path.join(carpeta, 'glb', id + '.glb'), resultado.glb);
  resultados.push({id, fuente: 'fuentes/' + id + '.kiln.js', fuenteSha256: hash(fuente), glb: 'glb/' + id + '.glb', glbSha256: hash(resultado.glb), glbBytes: resultado.glb.length, triangulos: resultado.tris, warnings: resultado.warnings, validacionFuente: validacion, requisitos: resultado.requirements, integracion: resultado.integrationManifest});
  console.log(id + ': ' + resultado.tris + ' triángulos; ' + resultado.glb.length + ' bytes');
}
await fs.writeFile(path.join(carpeta, 'generacion.json'), JSON.stringify({version: 1, motor, node: process.version, exportador: 'three', exportadorExperimental: true, opciones, fuentePlantilla: 'fuente.kiln.js', plantillaSha256: hash(plantilla), materiales: 1, observacion: 'Kiln ejecutó y exportó estas fuentes. GPU preview y calidad visual se comprueban en el visor de Caoz; no se certifican por QA geométrica.', modulos: resultados}, null, 2) + '\n');
