import * as THREE from 'three';
// Interface: createGlitchMaterial(texture) -> ShaderMaterial with uniforms uTex, uVelocity, uTime, uOpacity (+ uBlur)
export function createGlitchMaterial(texture){
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{uTex:{value:texture},uVelocity:{value:0},uTime:{value:0},uOpacity:{value:1},uBlur:{value:0}},
    vertexShader:`varying vec2 vUv;uniform float uVelocity;uniform float uTime;
      void main(){vUv=uv;vec3 p=position;float v=clamp(uVelocity,-1.,1.);
        p.x+=sin(p.y*6.+uTime*20.)*0.03*abs(v);p.z+=sin(uv.y*3.1416)*v*0.25;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader:`varying vec2 vUv;uniform sampler2D uTex;uniform float uVelocity,uTime,uOpacity,uBlur;
      float h(float n){return fract(sin(n)*43758.5453);}
      vec4 tap(vec2 uv){
        if(uBlur<0.01) return texture2D(uTex,uv);
        vec2 o=vec2(uBlur*0.012);vec4 c=texture2D(uTex,uv)*0.36;
        c+=texture2D(uTex,uv+vec2(o.x,0.))*0.16;c+=texture2D(uTex,uv-vec2(o.x,0.))*0.16;
        c+=texture2D(uTex,uv+vec2(0.,o.y))*0.16;c+=texture2D(uTex,uv-vec2(0.,o.y))*0.16;return c;}
      void main(){
        float v=clamp(abs(uVelocity),0.,1.);vec2 uv=vUv;
        float row=floor(uv.y*28.);float g=step(1.-v*0.6,h(row+floor(uTime*24.)));
        uv.x+=g*(h(row*1.7+uTime)-0.5)*0.12*v;
        float sh=0.004+v*0.035;
        vec4 c=tap(uv);float r=tap(uv+vec2(sh,0.)).r;float b=tap(uv-vec2(sh,0.)).b;
        vec3 col=vec3(r,c.g,b);
        col+=g*v*vec3(0.25,-0.05,0.2);
        float a=c.a*uOpacity;if(a<0.01)discard;
        gl_FragColor=vec4(col,a);}`
  });
}
