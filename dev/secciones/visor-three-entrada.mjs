/* Entrada del paquete de three.js de la prueba del visor (visor-three.html).
   Sólo lo que usa la prueba: el núcleo y los complementos de posproceso,
   espejo y destellos de lente. visor-three-construir.mjs lo empaqueta
   en visor-three-vendor.js (un único script, sin CDN: la sección sólo carga
   scripts propios). */
export * as THREE from 'three';
export {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js';
export {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js';
export {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
export {BokehPass} from 'three/examples/jsm/postprocessing/BokehPass.js';
export {OutputPass} from 'three/examples/jsm/postprocessing/OutputPass.js';
export {SMAAPass} from 'three/examples/jsm/postprocessing/SMAAPass.js';
export {Reflector} from 'three/examples/jsm/objects/Reflector.js';
export {Lensflare,LensflareElement} from 'three/examples/jsm/objects/Lensflare.js';
