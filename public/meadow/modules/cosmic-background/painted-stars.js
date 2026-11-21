// Sample only small, isolated peaks: cloud detail must not turn into a second star field.
export function detectPaintedStars(data, width, height, limit = 92) {
  const luma = new Float32Array(width * height);
  for (let i=0; i<luma.length; i++) {
    luma[i]=data[i*4]*.2126+data[i*4+1]*.7152+data[i*4+2]*.0722;
  }
  const candidates=[];
  for(let y=6; y<height-6; y++)for(let x=6; x<width-6; x++) {
    const i=y*width+x, value=luma[i];
    if(value<92)continue;
    const surrounding=(luma[i-5]+luma[i+5]+luma[i-width*5]+luma[i+width*5])/4;
    if(value-surrounding<34)continue;
    if(value<luma[i-1]||value<luma[i+1]||value<luma[i-width]||value<luma[i+width])continue;
    candidates.push({x,y,score:value-surrounding});
  }
  candidates.sort((a,b)=>b.score-a.score);
  const result=[];
  for(const point of candidates) {
    if(result.some(other=>Math.hypot(point.x-other.x,point.y-other.y)<13))continue;
    result.push(point);if(result.length>=limit)break;
  }
  return result.map(point=>({u:(point.x+.5)/width,v:1-(point.y+.5)/height,strength:Math.min(1,point.score/180)}));
}

export function samplePainting(image, limit) {
  const canvas=document.createElement('canvas');
  canvas.width=Math.min(1280,image.naturalWidth);
  canvas.height=Math.round(canvas.width*image.naturalHeight/image.naturalWidth);
  const context=canvas.getContext('2d',{willReadFrequently:true});
  if(!context)throw Error('Unable to sample painted star anchors');
  context.drawImage(image,0,0,canvas.width,canvas.height);
  return detectPaintedStars(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,limit);
}
