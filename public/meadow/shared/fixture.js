// Read-only compatibility fixture, NOT final terrain art. Terrain owns its replacement.
import * as s from '../prototype-astra-world/planet-study/surface.js';
import { PLANET, BAY, SITES } from '../prototype-astra-world/planet-study/config.js';
export const surface = Object.freeze({version:1,revision:'prototype-6e8bc6f',radius:PLANET.radius,
 directionFromUV:s.directionFromUV,uvFromDirection:s.uvFromDirection,sample:s.sampleSurface,frame:s.surfaceFrame});
export const sites = SITES;
export const hydrology = Object.freeze({version:1,surfaceRevision:surface.revision,seaLevel:BAY.waterLevel,
 // halfWidth is a geodesic distance in metres in this local chart, not diameter.
 river:s.riverLine.map(([u,v],i)=>{const t=i/(s.riverLine.length-1);return Object.freeze({t,u,v,
 waterHeight:s.waterStage(t),bedHeight:s.sampleSurface(u,v).height,halfWidth:s.channelWidth(t)*.82});}),
 radialPoint:(u,v,h)=>s.directionFromUV(u,v).map(n=>n*(PLANET.radius+h)),
 // The provider must export a terrain-matched bay/sea shoreline, not an independently redrawn mask.
 shoreline:{status:'PROTOTYPE_IMPLICIT',signedDistance:(u,v)=>Math.min(s.features(u,v).bay-1,s.features(u,v).sea-1)},
});
