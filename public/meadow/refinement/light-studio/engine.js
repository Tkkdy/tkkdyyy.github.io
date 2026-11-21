import * as T from 'three';
import {presets} from './model.js';
export let settings=presets.B;
export const uniforms={
 studyTint:{value:new T.Color()},studyEnergy:{value:0},studyMode:{value:0},
 studyLamp:{value:new T.Vector3()},studyWindow:{value:0},studyRoll:{value:0},
 studyShadow:{value:.65},studyRadius:{value:6},studyHaze:{value:0},studyHazeTint:{value:new T.Color()},studyGalaxy:{value:1}
};
export function setLight(p){
 settings=p;
 for(const [name,key] of [['studyEnergy','bounce'],['studyWindow','window'],['studyRoll','rolloff'],['studyShadow','shadow'],['studyRadius','radius'],['studyHaze','haze'],['studyGalaxy','galaxy']])uniforms[name].value=p[key];
 uniforms.studyTint.value.set(p.tint);uniforms.studyHazeTint.value.set(p.hazeTint);
 uniforms.studyMode.value={west:0,sky:1,porch:2}[p.distribution];
}
setLight(settings);
