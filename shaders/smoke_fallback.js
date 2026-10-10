import * as THREE from 'three';
// Interface: createSmokeBackground(renderer, scene) -> {update(t), dispose()}
export function createSmokeBackground(renderer,scene){
  const mat=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,
    uniforms:{uTime:{value:0},uRes:{value:new THREE.Vector2(1,1)}},
    vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.9999,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform float uTime;uniform vec2 uRes;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
      void main(){vec2 uv=vUv;uv.x*=uRes.x/uRes.y;float t=uTime*0.05;
        vec2 q=vec2(fbm(uv*1.6+t),fbm(uv*1.6-t+3.1));
        float n=fbm(uv*2.2+q*1.8+vec2(t*2.,-t));
        vec3 pink=vec3(1.,.16,.54),cyan=vec3(.09,.95,1.),purp=vec3(.45,.12,1.);
        vec3 col=mix(purp,pink,smoothstep(.3,.8,q.x));col=mix(col,cyan,smoothstep(.55,.9,q.y)*.6);
        float dens=smoothstep(.35,1.,n)*0.55;
        float vig=smoothstep(1.25,.2,length(vUv-.5)*1.6);
        vec3 base=vec3(.025,.005,.05);
        gl_FragColor=vec4(base+col*dens*vig+hash(vUv*uRes+uTime)*0.03,1.);}`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);mesh.frustumCulled=false;mesh.renderOrder=-10;scene.add(mesh);
  return{update(t){mat.uniforms.uTime.value=t;const s=renderer.getSize(new THREE.Vector2());mat.uniforms.uRes.value.set(s.x,s.y);},
    dispose(){scene.remove(mesh);mesh.geometry.dispose();mat.dispose();}};
}
