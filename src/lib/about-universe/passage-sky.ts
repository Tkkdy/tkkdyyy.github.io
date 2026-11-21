import {clamp,smooth} from './camera';

// The upper ridge in the inner painting and the warm knot in the meadow sky
// travel through the same screen point throughout their overlap. Coordinates
// below refer to the original paintings, before cover and overscan.
export function passageSky(width:number,height:number,progress:number){
  const artRatio=1672/941,sourceW=Math.max(width,height*artRatio)*1.22,sourceH=sourceW/artRatio;
  const sourceU=.5+Math.min(.22,.26*width/sourceW);
  const sourceV=.24-(sourceU-.52)*.29;
  const fromX=(sourceU-.5)*sourceW/width,fromY=(sourceV-.5)*sourceH/height;
  const portrait=clamp((1-width/height)/.54);
  const knotX=.021-.14*portrait,knotY=-.27+.066*portrait;
  const travel=smooth((progress-.05)/.83),blend=smooth((progress-.34)/.37);
  const x=fromX+(knotX*1.10-fromX)*travel,y=fromY+(knotY*1.10-fromY)*travel;
  const departureZoom=1+.38*travel;
  const incomingZoom=1.10+.53*(1-travel);
  const turn=-(.13-.06*portrait)*smooth((progress-.03)/.32),cos=Math.cos(turn),sin=Math.sin(turn);
  const ridgeX=(fromX*cos-fromY*height/width*sin)*departureZoom;
  const ridgeY=(fromX*width/height*sin+fromY*cos)*departureZoom;
  return {blend,turn,departureZoom,oldX:x-ridgeX,oldY:y-ridgeY,
    incomingZoom,newX:x-knotX*incomingZoom,newY:y-knotY*incomingZoom};
}
