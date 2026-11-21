import {sceneRecipe} from './studio-model.js';
export async function install(ctx){
 const module=sceneRecipe().scene==='meadow'?await import('../velvet-dusk/materials.js'):await import('./vault.js');
 return module.install(ctx);
}
