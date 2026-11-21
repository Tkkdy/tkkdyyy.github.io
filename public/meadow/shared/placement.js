import * as T from 'three';
// Placement facade consumes the selected terrain provider, never a private noise copy.
export function attachToSurface(object,anchor,parent,surface){
 const f=surface.frame(anchor.u,anchor.v),n=new T.Vector3(...f.normal),frame=new T.Group();
 frame.name=anchor.id;frame.position.fromArray(f.position).addScaledVector(n,anchor.offset||0);
 frame.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3(...f.east),n,new T.Vector3(...f.south)));
 if(anchor.heading)frame.rotateY(anchor.heading);frame.userData.anchor={...anchor};frame.add(object);parent.add(frame);return frame;
}
