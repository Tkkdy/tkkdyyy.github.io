import * as T from 'three';

export const REVISION = 'r6-garden-flow-bark-3';
const helper = [
  "varying vec4 vR6WoodFlow;",
  "uniform vec4 r6RootPlane;",
  "float r6Hash(vec2 p) {return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
  "float r6Wash(vec2 p) {",
  "  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);",
  "  return mix(mix(r6Hash(i),r6Hash(i+vec2(1,0)),f.x),",
  "    mix(r6Hash(i+vec2(0,1)),r6Hash(i+vec2(1,1)),f.x),f.y);",
  "}",
  "vec3 r6WoodPigment(vec4 flow) {",
  "  float theta=atan(flow.y,flow.x), v=flow.z;",
  "  float confidence=smoothstep(.02,.85,flow.w);",
  "  float broad=(sin(theta*3.+v*.8)+.55*sin(theta*5.-v*1.9))/1.55;",
  "  float drift=.34*sin(v*1.2+sin(theta*2.))+.16*sin(v*3.3-theta);",
  "  float phase=theta*11.+drift*6.2831853;",
  "  float interrupted=.25+.75*r6Wash(vec2(cos(theta)*3.7+8.,sin(theta)*3.7+v*1.65));",
  "  float resolved=1.-smoothstep(.35,1.7,fwidth(phase));",
  "  float groove=pow(.5+.5*cos(phase),7.)*interrupted*resolved;",
  "  float ridge=pow(.5+.5*cos(phase-.58),3.)*interrupted*resolved;",
  "  float finePhase=theta*27.+drift*9.2+sin(v*5.1);",
  "  float fine=pow(.5+.5*cos(finePhase),9.)*(1.-smoothstep(.35,1.7,fwidth(finePhase)));",
  "  float weather=r6Wash(vec2(cos(theta)*1.8+9.,sin(theta)*1.8+v*.72));",
  "  float height=-.40*groove+.11*ridge-.010*fine+.040*broad;",
  "  float tone=-.36*groove+.12*ridge-.006*fine+.065*broad+(weather-.5)*.11;",
  "  return vec3(.5+height*confidence,.5+tone*confidence,.5+(weather-.5)*confidence);",
  "}",
  "vec3 r6WoodNormal(vec3 normalInput, vec3 point, float height) {",
  "  vec3 n=normalize(normalInput),dx=dFdx(point),dy=dFdy(point);",
  "  vec3 rx=cross(dy,n),ry=cross(n,dx);",
  "  float determinant=dot(dx,rx);",
  "  vec3 gradient=(dFdx(height)*rx+dFdy(height)*ry)",
  "    *(sign(determinant)/max(abs(determinant),.0000001));",
  "  vec3 tilt=gradient*.0040;",
  "  tilt*=min(1.,.12/max(length(tilt),.000001));",
  "  return normalize(n-tilt);",
  "}"
].join('\n');
const finish = [
  "float r6Grain=(r6Wood.g-.5)*1.40;",
  "float r6Weather=r6Wood.b-.5;",
  "float r6Height=dot(vec4(vGardenPoint,1.),r6RootPlane);",
  "float r6Foot=1.-smoothstep(.015,.28,r6Height);",
  "float r6Patch=smoothstep(.25,.76,r6Wood.b);",
  "diffuseColor.rgb*=1.+r6Grain;",
  "diffuseColor.rgb*=vec3(1.+.035*r6Weather,1.+.065*r6Weather,1.+.10*r6Weather);",
  "// Root wood receives a broken cool-umber wash. No ground decal or AO.",
  "diffuseColor.rgb*=mix(vec3(1.),vec3(.89,.93,.94),r6Foot*(.25+.55*r6Patch));"
].join('\n');

function rootPlane(ctx, mesh) {
  const frame = ctx.surface.frame(1.4, -2.7);
  const inverse = mesh.matrixWorld.clone().invert();
  const point = new T.Vector3(...frame.position).applyMatrix4(ctx.world.matrixWorld).applyMatrix4(inverse);
  const normal = new T.Vector3(...frame.normal).transformDirection(ctx.world.matrixWorld).transformDirection(inverse);
  return new T.Vector4(normal.x, normal.y, normal.z, -normal.dot(point));
}

export async function install(ctx) {
  const {assets, world, debug, signal, invalidate} = ctx;
  signal?.throwIfAborted();
  const mesh = assets.tree.getObjectByName('blossom_painted_scene');
  if (!mesh?.isMesh || Array.isArray(mesh.material) || mesh.geometry.attributes.position.count !== 11158)
    throw Error('R6 bark requires the protected exported wood vertex order');
  const source = mesh.material, sourceKey = source.customProgramCacheKey();
  if (!sourceKey.endsWith('|r5-garden-directional-color-3|wood'))
    throw Error('R6 bark requires the retained R5 wood response: ' + sourceKey);
  const compileSource = source.onBeforeCompile, previous = debug?.r6Garden;
  let texture, copy, published, disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true;
    signal?.removeEventListener('abort', dispose);
    if (copy && mesh.material === copy) mesh.material = source;
    copy?.dispose(); texture?.dispose();
    if (debug?.r6Garden === published) {
      if (previous === undefined) delete debug.r6Garden;
      else debug.r6Garden = previous;
    }
    invalidate?.();
  }
  try {
    const response = await fetch(new URL('./wood-flow.json', import.meta.url), {signal});
    if (!response.ok) throw Error('R6 wood flow load failed: ' + response.status);
    const payload = await response.json();
    signal?.throwIfAborted();
    if (payload.format !== 'rgba32f-le' || payload.width !== 128 || payload.height !== 88 || payload.vertices !== 11158)
      throw Error('Unexpected R6 wood flow layout');
    const buffer = Uint8Array.from(atob(payload.data),c=>c.charCodeAt(0)).buffer;
    if (buffer.byteLength !== 180224) throw Error('Unexpected R6 wood flow byte count');
    texture = new T.DataTexture(new Float32Array(buffer),128,88,T.RGBAFormat,T.FloatType);
    texture.name = 'R6 wood / owned vertex flow and junction confidence';
    texture.colorSpace = T.NoColorSpace;
    texture.flipY = false;
    texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
    texture.minFilter = texture.magFilter = T.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    world.updateMatrixWorld(true);
    const plane = rootPlane(ctx, mesh);
    copy = source.clone();
    copy.name = 'R6 garden / continuous flow-aligned wood';
    if (Object.hasOwn(source, 'onBeforeRender')) copy.onBeforeRender = source.onBeforeRender;
    copy.onBeforeCompile = function(shader, activeRenderer) {
      compileSource.call(this, shader, activeRenderer);
      const color = '#include <color_fragment>', alpha = '#include <alphatest_fragment>';
      if (!shader.fragmentShader.includes('vec3 r5WoodResponse=')
        || !shader.fragmentShader.includes(color) || !shader.fragmentShader.includes(alpha)
        || !shader.fragmentShader.includes('normalize(vGardenNormal)')
        || !shader.vertexShader.includes('#include <begin_vertex>'))
        throw Error('R6 bark refuses an unsupported retained shader chain');
      shader.uniforms.r6WoodFlow = {value:texture};
      shader.uniforms.r6RootPlane = {value:plane};
      shader.vertexShader = 'varying vec4 vR6WoodFlow;\nuniform sampler2D r6WoodFlow;\n'+shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvR6WoodFlow=texelFetch(r6WoodFlow,ivec2(gl_VertexID%128,gl_VertexID/128),0);');
      // Retained R1/R4/R5 equations consume one restrained shading normal.
      // Original attributes, uniforms, callbacks and clock owners stay untouched.
      shader.fragmentShader = shader.fragmentShader.replaceAll('normalize(vGardenNormal)','r6WoodN');
      shader.fragmentShader = shader.fragmentShader.replace(color,
        color+'\nvec3 r6Wood=r6WoodPigment(vR6WoodFlow);\nvec3 r6WoodN=r6WoodNormal(normalize(vGardenNormal),vGardenPoint,r6Wood.r);');
      shader.fragmentShader = helper+'\n'+shader.fragmentShader.replace(alpha,finish+'\n'+alpha);
    };
    copy.customProgramCacheKey = () => sourceKey+'|'+REVISION;
    mesh.material = copy;
    published = {revision:REVISION,materialCopies:1,textureCopies:1,
      textureSize:[128,88],textureBytesRGBA32F:180224,textureMipmaps:false,
      bumpHeightScale:.0040,maximumNormalTilt:.12,
      addedObjects:0,addedGeometry:0,addedAttributes:0,addedLights:0,addedMotionOwners:0,
      crownMaterialUnchanged:true,gardenMaterialsUnchanged:true,
      rootPlane:plane.toArray(),
      flow:'vertex ID lookup; transported frames; smooth junction confidence collar',
      callbackPolicy:'R1/R4/R5 callbacks run first; retained uniform and clock owners untouched',
      limitation:'Root wash reads the existing local ground frame; no new contact-shadow geometry or true bark displacement'};
    if (debug) debug.r6Garden = published;
    signal?.addEventListener('abort',dispose,{once:true});
    invalidate?.();
    return {dispose};
  } catch (error) {dispose();throw error;}
}
