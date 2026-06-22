/* ============================================================
   scenes.js — palette data + helpers, the three.js scene objects,
   shader strings, noise/FBM, terrain build, and the palette/detail
   "apply" functions.

   Loaded BEFORE main.js. At top level this file depends only on the
   global `THREE` (from the CDN) and browser globals; its functions
   reference `state`/`hexToRGB` from main.js, but only at call time
   (after both scripts have loaded), so load order is safe.
   ============================================================ */

/* ============================ palettes ============================ */
const PALETTES = {
  aurora: [
    {name:"Boreal", bg:"#04060f", a:"#27e0a3", b:"#1f8fff", c:"#7a5cff", d:"#0bd1c7"},
    {name:"Ember",  bg:"#0b0405", a:"#ff6a3d", b:"#ff2d75", c:"#ffd166", d:"#ff8a5c"},
    {name:"Tidal",  bg:"#02060c", a:"#00e0ff", b:"#4d7cff", c:"#b3f0ff", d:"#2bd4ff"},
    {name:"Orchid", bg:"#0a0612", a:"#b06cff", b:"#ff6ad5", c:"#6affd9", d:"#c98bff"},
  ],
  cosmos: [
    {name:"Nebula", bg:"#04030a", a:"#6a4cff", b:"#ff5bb0", c:"#36d6ff", d:"#9d7bff"},
    {name:"Inferno",bg:"#0a0303", a:"#ff7a18", b:"#ff2d55", c:"#ffd479", d:"#ff5e3a"},
    {name:"Verdant",bg:"#03080a", a:"#22e0a0", b:"#0fb5d6", c:"#aaffd6", d:"#3df0c4"},
    {name:"Rosé",   bg:"#0a040a", a:"#ff8fc4", b:"#b06cff", c:"#ffd6ec", d:"#ff6ad5"},
  ],
  terrain: [
    {name:"Dawn",   sky1:"#1a1030", sky2:"#ff8a6b", lo:"#3a2150", hi:"#ffb38a"},
    {name:"Glacier",sky1:"#08111f", sky2:"#7fc7ff", lo:"#13314f", hi:"#dff3ff"},
    {name:"Verdant",sky1:"#0a1a14", sky2:"#7be0a0", lo:"#10402c", hi:"#dfffe9"},
    {name:"Marsfall",sky1:"#170707", sky2:"#ff7a4d", lo:"#3a160e", hi:"#ffcaa0"},
  ]
};

/* ============================ three.js core ============================ */
let W=innerWidth,H=innerHeight;

/* fullscreen quad scene (aurora + cosmos) */
const quadScene = new THREE.Scene();
const quadCam = new THREE.OrthographicCamera(-1,1,1,-1,0,1);

const SHARED_NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865,0.366025403,-0.577350269,0.024390243);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;
  i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;
  m*=1.792843-0.853735*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 p){float v=0.0,a=0.5;mat2 r=mat2(0.8,-0.6,0.6,0.8);
  for(int i=0;i<6;i++){v+=a*snoise(p);p=r*p*2.0+10.0;a*=0.5;}return v;}
`;

const AURORA_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime; uniform float uDetail;
uniform vec3 uBg,uA,uB,uC,uD;
${SHARED_NOISE}
void main(){
  vec2 uv=vUv; vec2 p=(gl_FragCoord.xy*2.0-uRes)/uRes.y;
  float t=uTime;
  float layers=2.0+uDetail*3.0;
  vec3 col=uBg;
  for(float i=0.0;i<5.0;i++){
    if(i>=layers)break;
    float fi=i/4.0;
    float flow=fbm(vec2(p.x*1.2+fi*3.0, p.y*0.5 - t*0.12 + fi*2.0));
    float band=p.y*1.4 + flow*(0.7+uDetail*0.8) + sin(t*0.2+fi*6.28)*0.3;
    float curtain=exp(-pow(band*1.6,2.0))*1.4;
    float shimmer=0.6+0.4*fbm(vec2(p.x*4.0+t*0.5, band*3.0));
    vec3 cc = mix(mix(uA,uB,fi), mix(uC,uD,fi), 0.5+0.5*sin(t*0.15+fi*3.0));
    col += cc*curtain*shimmer*(0.55-fi*0.07);
  }
  // soft vertical glow at base
  col += uA*0.10*smoothstep(1.0,-0.2,p.y);
  // subtle stars
  float st=snoise(gl_FragCoord.xy*1.4);
  col += vec3(step(0.996,fract(st*43.0)))*0.5*smoothstep(-0.2,1.0,p.y);
  col=pow(col,vec3(0.9));
  gl_FragColor=vec4(col,1.0);
}`;

const COSMOS_FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes; uniform float uTime; uniform float uDetail;
uniform vec3 uBg,uA,uB,uC,uD;
${SHARED_NOISE}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 p=(gl_FragCoord.xy*2.0-uRes)/uRes.y;
  float t=uTime*0.06;
  // nebula clouds
  vec2 q=p*1.1; q+= vec2(t*0.4, t*0.2);
  float n=fbm(q*1.3);
  float n2=fbm(q*2.6 + n + vec2(5.2,1.3));
  float dens=smoothstep(-0.2,1.1,n+n2*(0.4+uDetail*0.6));
  vec3 neb = mix(uA,uB,smoothstep(-0.5,1.0,n));
  neb = mix(neb,uC,smoothstep(0.2,1.2,n2));
  vec3 col=uBg + neb*dens*1.1;
  col += uD*pow(dens,3.0)*0.6;
  // star field (3 layers)
  for(float l=0.0;l<3.0;l++){
    float sc=(40.0+l*55.0)*(0.6+uDetail);
    vec2 g=floor(p*sc); float h=hash(g+l*17.0);
    float br=step(0.991-l*0.001,h);
    vec2 c=fract(p*sc)-0.5;
    float tw=0.6+0.4*sin(uTime*2.0+h*30.0);
    col += vec3(br)*exp(-dot(c,c)*30.0)*tw*(1.0-l*0.25);
  }
  // vignette
  col*=1.0-0.35*dot(p,p)*0.25;
  gl_FragColor=vec4(col,1.0);
}`;

const quadUniforms = {
  uRes:{value:new THREE.Vector2(W,H)}, uTime:{value:0}, uDetail:{value:.55},
  uBg:{value:new THREE.Vector3()}, uA:{value:new THREE.Vector3()},
  uB:{value:new THREE.Vector3()}, uC:{value:new THREE.Vector3()}, uD:{value:new THREE.Vector3()}
};
const quadMat = new THREE.ShaderMaterial({
  uniforms:quadUniforms,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`,
  fragmentShader:AURORA_FRAG
});
quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),quadMat));

/* ---- terrain scene (real 3D low-poly) ---- */
const tScene=new THREE.Scene();
const tCam=new THREE.PerspectiveCamera(55,W/H,0.1,100);
const tGroup=new THREE.Group(); tScene.add(tGroup);
let terrainMesh=null;
const tLight=new THREE.DirectionalLight(0xffffff,1.15); tLight.position.set(-6,8,4); tScene.add(tLight);
tScene.add(new THREE.HemisphereLight(0xffffff,0x223044,0.5));
const tAmb=new THREE.AmbientLight(0xffffff,0.25); tScene.add(tAmb);

// value-noise FBM for height
function vnoise(x,y,seed){
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const r=(a,b)=>{let h=Math.sin((a*127.1+b*311.7+seed*53.7))*43758.5453;return (h-Math.floor(h));};
  const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
  const a=r(ix,iy),b=r(ix+1,iy),c=r(ix,iy+1),d=r(ix+1,iy+1);
  return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;
}
function fbm2(x,y,seed){let v=0,a=0.5,f=1;for(let i=0;i<5;i++){v+=a*vnoise(x*f,y*f,seed+i*11);f*=2;a*=0.5;}return v;}

function buildTerrain(){
  if(terrainMesh){tGroup.remove(terrainMesh);terrainMesh.geometry.dispose();terrainMesh.material.dispose();}
  const pal=activePalette();
  const SIZE=14, SEG=Math.round(40+state.detail*0.9); // detail = mesh density / ruggedness
  const geo=new THREE.PlaneGeometry(SIZE,SIZE,SEG,SEG);
  geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position; const rug=0.6+state.detail/60;
  let maxh=0;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i);
    let h=fbm2(x*0.18+state.seed,z*0.18,state.seed)*rug;
    h=Math.pow(h,1.6)*4.2;
    pos.setY(i,h); maxh=Math.max(maxh,h);
  }
  geo.computeVertexNormals();
  // vertex colours: blend lo->hi by height
  const lo=new THREE.Color(pal.lo),hi=new THREE.Color(pal.hi);
  const colors=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
    const t=Math.min(1,pos.getY(i)/(maxh||1));
    const c=lo.clone().lerp(hi,Math.pow(t,0.9));
    colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const mat=new THREE.MeshStandardMaterial({vertexColors:true,flatShading:true,roughness:0.92,metalness:0.0});
  terrainMesh=new THREE.Mesh(geo,mat); tGroup.add(terrainMesh);
  // sky gradient via scene background
  const sky1=new THREE.Color(pal.sky1),sky2=new THREE.Color(pal.sky2);
  tScene.background=sky1;
  tLight.color=sky2.clone().lerp(new THREE.Color(0xffffff),0.4);
  // store for bg gradient draw
  tScene.userData={sky1,sky2};
}

/* sky gradient backdrop for terrain (drawn as large sphere) */
const skyGeo=new THREE.SphereGeometry(40,32,16);
const skyMat=new THREE.ShaderMaterial({
  side:THREE.BackSide,
  uniforms:{c1:{value:new THREE.Color()},c2:{value:new THREE.Color()}},
  vertexShader:`varying float vY;void main(){vY=normalize(position).y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying float vY;uniform vec3 c1,c2;void main(){float t=smoothstep(-0.1,0.55,vY);gl_FragColor=vec4(mix(c2,c1,t),1.0);}`
});
tScene.add(new THREE.Mesh(skyGeo,skyMat));

/* ============================ palette helpers ============================ */
/* free-hue: rotate every colour in a palette by state.hue degrees (HSL) */
function rgbToHsl(r,g,b){
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;
  if(mx!==mn){const d=mx-mn;s=l>0.5?d/(2-mx-mn):d/(mx+mn);
    h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h/=6;}
  return [h,s,l];
}
function hslToRgb(h,s,l){
  if(s===0)return [l,l,l];
  const f=(p,q,t)=>{t=(t%1+1)%1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
  const q=l<0.5?l*(1+s):l+s-l*s,p=2*l-q;
  return [f(p,q,h+1/3),f(p,q,h),f(p,q,h-1/3)];
}
const _hx=v=>Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,'0');
function shiftHex(hex,deg){
  const [r,g,b]=hexToRGB(hex);const [h,s,l]=rgbToHsl(r,g,b);
  const [nr,ng,nb]=hslToRgb((h+deg/360)%1,s,l);
  return '#'+_hx(nr)+_hx(ng)+_hx(nb);
}
function huePalette(p){
  if(!state.hue)return p;
  const out={};for(const k in p)out[k]=k==="name"?p[k]:shiftHex(p[k],state.hue);
  return out;
}
function activePalette(){ return huePalette(PALETTES[state.style][state.pal]); }

/* ============================ apply state ============================ */
/* push the (hue-shifted) palette colours into the active scene — no shader swap */
function applyColors(){
  if(state.style==="terrain"){ buildTerrain();
    skyMat.uniforms.c1.value.copy(tScene.userData.sky1);
    skyMat.uniforms.c2.value.copy(tScene.userData.sky2);
    return;
  }
  const p=activePalette();
  quadUniforms.uBg.value.set(...hexToRGB(p.bg));
  quadUniforms.uA.value.set(...hexToRGB(p.a));
  quadUniforms.uB.value.set(...hexToRGB(p.b));
  quadUniforms.uC.value.set(...hexToRGB(p.c));
  quadUniforms.uD.value.set(...hexToRGB(p.d));
}
function applyPalette(){
  applyColors();
  if(state.style!=="terrain"){
    quadMat.fragmentShader = state.style==="aurora"?AURORA_FRAG:COSMOS_FRAG;
    quadMat.needsUpdate=true;
  }
}
function applyDetail(){ quadUniforms.uDetail.value=state.detail/100; if(state.style==="terrain")buildTerrain(); }
