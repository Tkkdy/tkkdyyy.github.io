export const CONFIG = Object.freeze({
  revision: 'terrain-20261114-r5', radius: 12, seaLevel: -.55,
  mesh: { sectors: 256, fineRadius: 15, fineRings: 150, outerRings: 64 },
  house: {u:-2.2,v:-2.4,height:.72,halfWidth:2.35,halfDepth:2.55},
  tree: {u:1.4,v:-2.7,height:.76,radius:1.35},
  river: [[4.4,-5.8],[4.8,-4.1],[4.25,-2.25],[3.1,-.3],[2.2,1.2],[1.7,2.7],[.35,3.7],[-1.25,4.5]],
  path: [[-2.2,-.95],[-2.15,-.3],[-1.15,.35],[.1,.8],[.55,1.65],[0,2.5]],
  // Exposed bedrock is part of the continuous heightfield, not ecosystem props.
  shelves: [
    {u:-7.1,v:2.3,along:1.65,across:.72,angle:-.52,lift:.46},
    {u:-5.1,v:1.65,along:1.25,across:.62,angle:-.16,lift:.38},
    {u:-8.7,v:4.25,along:1.55,across:.78,angle:-.8,lift:.50},
    {u:-9.9,v:6.9,along:1.4,across:.64,angle:-1.1,lift:.35},
    {u:1.5,v:5.1,along:1.32,across:.68,angle:.73,lift:.42},
    {u:2.65,v:6.7,along:1.55,across:.78,angle:1.1,lift:.48},
    {u:3.5,v:3.1,along:1.15,across:.60,angle:.3,lift:.28}
  ],
  palette: {
    meadow:'#698366', shade:'#354f50', ridge:'#94946a',
    soil:'#a18a7e', bed:'#3f5864', path:'#bc9b78',
    rock:'#787969', rockLight:'#a89e86', rockShadow:'#4c5953'
  }
});
