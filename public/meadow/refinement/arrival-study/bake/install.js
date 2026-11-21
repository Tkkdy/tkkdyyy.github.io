export async function installShoulder(ctx,{variant='C'}={}){
 if(!['C','B','D'].includes(variant))throw Error('Unknown bake variant');
 const module=await import('./'+variant+'-generated.js');return module.installShoulder(ctx);
}
