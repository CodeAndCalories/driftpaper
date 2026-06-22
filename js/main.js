/* ============================================================
   main.js — app shell: state, DOM helpers, the renderer, render
   loop, export, swatch UI, UI wiring, URL state, and the init
   bootstrap.

   Loaded AFTER scenes.js, so every scene object / palette helper it
   calls already exists. The init block at the bottom runs last, once
   both scripts are in place.
   ============================================================ */

/* ============================ shop / affiliate ============================ */
// Replace #REPLACE_ME with your affiliate links (e.g. Amazon Associates tag).
const SHOP_ITEMS = {
  aurora: [
    { label:"Aurora Projector", note:"Northern lights at home", url:"#REPLACE_ME", emoji:"🌌" },
    { label:"Star Projector",   note:"Galaxy on your ceiling",  url:"#REPLACE_ME", emoji:"✨" },
    { label:"Cozy Throw",       note:"Boreal-night vibes",      url:"#REPLACE_ME", emoji:"🛋️" },
  ],
  cosmos: [
    { label:"Galaxy Projector", note:"Nebula light show",       url:"#REPLACE_ME", emoji:"🌠" },
    { label:"Telescope",        note:"Stargazing starter",      url:"#REPLACE_ME", emoji:"🔭" },
    { label:"Space Print",      note:"Framed nebula art",       url:"#REPLACE_ME", emoji:"🪐" },
  ],
  terrain: [
    { label:"Hiking Daypack",   note:"Hit the ridgeline",       url:"#REPLACE_ME", emoji:"🎒" },
    { label:"Topo Map Print",   note:"Low-poly peaks",          url:"#REPLACE_ME", emoji:"🗺️" },
    { label:"Camp Lantern",     note:"Golden-hour glow",        url:"#REPLACE_ME", emoji:"🏕️" },
  ],
};

/* ============================ state ============================ */
const state = { style:"aurora", pal:0, motion:50, detail:55, hue:0, aspect:"phone", seed:Math.random()*1000|0, playing:true };

/* ============================ helpers ============================ */
const $ = s=>document.querySelector(s);
const hexToRGB = h=>{h=h.replace('#','');return [parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255];};
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add('show');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1900);}

/* ============================ renderer ============================ */
const canvas = $("#stage");
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));

/* ============================ render loop ============================ */
let time=0, last=performance.now();
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
if(reduceMotion){state.playing=false;}

function resize(){
  W=innerWidth;H=innerHeight;
  renderer.setSize(W,H,false);
  quadUniforms.uRes.value.set(W*renderer.getPixelRatio(),H*renderer.getPixelRatio());
  tCam.aspect=W/H;tCam.updateProjectionMatrix();
}
addEventListener('resize',resize);

function frame(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;
  if(state.playing) time += dt*(0.2+state.motion/40);
  if(state.style==="terrain"){
    const a=time*0.25;
    tCam.position.set(Math.cos(a)*11, 5.5+Math.sin(time*0.4)*0.6, Math.sin(a)*11);
    tCam.lookAt(0,0.5,0);
    renderer.setClearColor(0x000000,1);
    renderer.render(tScene,tCam);
  } else {
    quadUniforms.uTime.value=time;
    renderer.render(quadScene,quadCam);
  }
  requestAnimationFrame(frame);
}

/* ============================ export ============================ */
const ASPECTS={phone:[1242,2688],desktop:[2560,1440],square:[2000,2000]};
function exportWallpaper(){
  const [ew,eh]=ASPECTS[state.aspect];
  const pr=renderer.getPixelRatio();
  renderer.setPixelRatio(1);
  renderer.setSize(ew,eh,false);
  if(state.style==="terrain"){
    tCam.aspect=ew/eh;tCam.updateProjectionMatrix();
    const a=time*0.25;
    tCam.position.set(Math.cos(a)*11,5.5+Math.sin(time*0.4)*0.6,Math.sin(a)*11);
    tCam.lookAt(0,0.5,0);
    renderer.render(tScene,tCam);
  }else{
    quadUniforms.uRes.value.set(ew,eh);
    renderer.render(quadScene,quadCam);
  }
  canvas.toBlob(b=>{
    const url=URL.createObjectURL(b);
    const a=document.createElement('a');
    a.href=url;a.download=`driftpaper-${state.style}-${state.aspect}.png`;a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  },'image/png');
  // restore live view
  renderer.setPixelRatio(pr);resize();
  toast("Wallpaper downloaded");
}

/* ============================ UI: swatches ============================ */
function swatchStops(p){
  const q=huePalette(p);
  return state.style==="terrain" ? [q.sky2,q.hi,q.lo,q.sky1] : [q.a,q.b,q.c,q.d];
}
function renderSwatches(){
  const wrap=$("#swatches");wrap.innerHTML="";
  PALETTES[state.style].forEach((p,i)=>{
    const b=document.createElement('button');
    b.className="sw";b.setAttribute('aria-selected',i===state.pal);b.title=p.name;
    b.style.background=`linear-gradient(120deg, ${swatchStops(p).join(',')})`;
    b.onclick=()=>{state.pal=i;state.seed=Math.random()*1000|0;syncSwatchSel();applyPalette();pushURL();};
    wrap.appendChild(b);
  });
}
/* live-recolour the existing swatch previews while the hue slider moves */
function paintSwatches(){
  const kids=$("#swatches").children;
  PALETTES[state.style].forEach((p,i)=>{ if(kids[i]) kids[i].style.background=`linear-gradient(120deg, ${swatchStops(p).join(',')})`; });
}
function syncSwatchSel(){[...$("#swatches").children].forEach((b,i)=>b.setAttribute('aria-selected',i===state.pal));}

/* ============================ UI: shop strip ============================ */
/* Rebuilds the affiliate strip for the active style. Reads SHOP_ITEMS (top of file). */
function renderShop(){
  const wrap=$("#shop");wrap.innerHTML="";
  (SHOP_ITEMS[state.style]||[]).forEach(it=>{
    const a=document.createElement('a');
    a.className="shop-card";
    a.href=it.url; a.target="_blank"; a.rel="noopener noreferrer sponsored"; a.title=it.label;
    const em=document.createElement('span'); em.className="shop-emoji"; em.textContent=it.emoji;
    const tx=document.createElement('span'); tx.className="shop-text";
    const lb=document.createElement('span'); lb.className="shop-label"; lb.textContent=it.label;
    const nt=document.createElement('span'); nt.className="shop-note"; nt.textContent=it.note;
    tx.appendChild(lb); tx.appendChild(nt);
    a.appendChild(em); a.appendChild(tx);
    wrap.appendChild(a);
  });
}

/* ============================ UI wiring ============================ */
$("#tabs").addEventListener('click',e=>{
  const t=e.target.closest('.tab');if(!t)return;
  [...$("#tabs").children].forEach(x=>x.setAttribute('aria-selected',x===t));
  state.style=t.dataset.style;state.pal=0;
  renderSwatches();renderShop();applyPalette();applyDetail();pushURL();
});
function setRangeFill(el){const mn=+el.min||0,mx=+el.max||100;el.style.setProperty('--p',((el.value-mn)/(mx-mn)*100)+'%');}
$("#motion").addEventListener('input',e=>{state.motion=+e.target.value;setRangeFill(e.target);pushURL();});
$("#detail").addEventListener('input',e=>{state.detail=+e.target.value;setRangeFill(e.target);applyDetail();pushURL();});
$("#hue").addEventListener('input',e=>{state.hue=+e.target.value;setRangeFill(e.target);applyColors();paintSwatches();});
$("#aspect").addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  [...$("#aspect").children].forEach(x=>x.setAttribute('aria-selected',x===b));state.aspect=b.dataset.a;pushURL();});
$("#shuffle").addEventListener('click',()=>{
  state.pal=Math.floor(Math.random()*PALETTES[state.style].length);
  state.seed=Math.random()*1000|0;
  state.motion=30+Math.random()*60|0;state.detail=30+Math.random()*60|0;
  $("#motion").value=state.motion;setRangeFill($("#motion"));
  $("#detail").value=state.detail;setRangeFill($("#detail"));
  syncSwatchSel();applyPalette();applyDetail();pushURL();toast("Shuffled");
});
$("#pause").addEventListener('click',e=>{
  state.playing=!state.playing;
  e.currentTarget.innerHTML=state.playing
   ?'<svg viewBox="0 0 24 24"><rect x="7" y="5" width="3.4" height="14" rx="1"/><rect x="13.6" y="5" width="3.4" height="14" rx="1"/></svg>'
   :'<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
});
$("#download").addEventListener('click',exportWallpaper);
$("#share").addEventListener('click',async()=>{
  pushURL();
  try{await navigator.clipboard.writeText(location.href);toast("Share link copied");}
  catch{toast("Copy this page's URL to share");}
});

/* ============================ URL state ============================ */
function pushURL(){
  const s=`${state.style},${state.pal},${state.motion},${state.detail},${state.aspect},${state.seed},${state.hue}`;
  history.replaceState(null,"","#"+s);
}
function readURL(){
  const h=location.hash.slice(1);if(!h)return;
  const [st,pal,mo,de,asp,seed,hue]=h.split(",");
  if(PALETTES[st]){state.style=st;state.pal=+pal||0;state.motion=+mo||50;
    state.detail=+de||55;state.aspect=asp||"phone";state.seed=+seed||(Math.random()*1000|0);
    state.hue=+hue||0;}
}

/* ============================ init ============================ */
readURL();
[...$("#tabs").children].forEach(x=>x.setAttribute('aria-selected',x.dataset.style===state.style));
[...$("#aspect").children].forEach(x=>x.setAttribute('aria-selected',x.dataset.a===state.aspect));
$("#motion").value=state.motion;setRangeFill($("#motion"));
$("#detail").value=state.detail;setRangeFill($("#detail"));
$("#hue").value=state.hue;setRangeFill($("#hue"));
if(!state.playing)$("#pause").innerHTML='<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
renderSwatches();renderShop();applyPalette();applyDetail();resize();
requestAnimationFrame(frame);
