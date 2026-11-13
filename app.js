"use strict";
/* ============ utilità ============ */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const slug=s=>norm(s).replace(/ /g,"-");
const today=()=>new Date().toISOString().slice(0,10);
const hue=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))>>>0;return h%360};
const initials=n=>String(n).split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
const DEFAULT_CID="f4ffe56412ce48e0865c20395514fc06";
const cfg=(k,v)=>{try{if(v===undefined)return localStorage.getItem("sd-"+k)||(k==="cid"?DEFAULT_CID:"");v?localStorage.setItem("sd-"+k,v):localStorage.removeItem("sd-"+k)}catch(e){return ""}};
const IC={ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',next:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5.5v13l9-6.5zM17 5.5h2v13h-2z"/></svg>',heart:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/></svg>',heart0:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/></svg>'};

/* ============ dati (salvati nel browser) ============ */
let S={artists:{},hearts:[],playlistId:"",playlistN:0,playlistDate:""};
function load(){
  try{const j=JSON.parse(localStorage.getItem("sd-data"));if(j&&j.artists)S=Object.assign(S,j)}catch(e){}
  if(!Object.keys(S.artists).length){
    SEED.forEach(([id,nome,genere,rif,info,st,br],i)=>{S.artists[id]={id,nome,genere,rif,info,stato:st==="a"?"aggiunto":st==="i"?"ignorato":"nuovo",ord:i,dec:st==="n"?"":"2026-11-13",brani:br.map(([t,tid,al,an])=>({t,uri:tid?"spotify:track:"+tid:"",al,an}))}});
    S.t=0;saveLocal();
  }
}
const strip=(k,v)=>k.startsWith("_")?undefined:v;
function save(){S.t=Date.now();try{localStorage.setItem("sd-data",JSON.stringify(S,strip))}catch(e){}push()}
function saveLocal(){try{localStorage.setItem("sd-data",JSON.stringify(S,strip))}catch(e){}}
/* sincronizzazione tra dispositivi: un gist privato su GitHub */
const gh=()=>cfg("gh");
async function ghApi(path,opt={}){
  const r=await fetch("https://api.github.com"+path,{...opt,headers:{Authorization:"token "+gh(),Accept:"application/vnd.github+json",...(opt.body?{"Content-Type":"application/json"}:{})}});
  if(!r.ok){const e=new Error("GitHub "+r.status);e.code=r.status;throw e}
  return r.status===204?{}:r.json();
}
async function gistId(){
  let id=cfg("gist");if(id)return id;
  const list=await ghApi("/gists?per_page=100");
  const g=list.find(x=>x.files&&x.files["sounder.json"]);
  if(g){cfg("gist",g.id);return g.id}
  return "";
}
let syncMsg="",pushT;
async function pull(){
  if(!gh())return;
  try{
    const id=await gistId();
    if(!id){await pushNow();return}
    const g=await ghApi("/gists/"+id),f=g.files&&g.files["sounder.json"];
    if(!f){await pushNow();return}
    const txt=f.truncated?await (await fetch(f.raw_url)).text():f.content;
    const R=JSON.parse(txt);
    if((R.t||0)>(S.t||0)){S=Object.assign({artists:{},hearts:[],playlistId:""},R);saveLocal();syncMsg="Dati aggiornati dall'altro dispositivo";render()}
    else if((R.t||0)<(S.t||0))await pushNow();
    else syncMsg="Sincronizzato";
    if(view==="imp")render();
  }catch(e){if(e.code===404)cfg("gist","");syncMsg=e.code===401?"Token non valido":"Sincronizzazione non riuscita"}
}
let pushChain=Promise.resolve();
function pushNow(){return pushChain=pushChain.then(doPush,doPush)}
async function doPush(){
  if(!gh())return;
  if(!S.t){S.t=Date.now();saveLocal()}
  const body={files:{"sounder.json":{content:JSON.stringify(S,strip)}}};
  try{
    const id=await gistId();
    if(id)await ghApi("/gists/"+id,{method:"PATCH",body:JSON.stringify(body)});
    else{const g=await ghApi("/gists",{method:"POST",body:JSON.stringify({description:"Sounder: i tuoi dati",public:false,...body})});cfg("gist",g.id)}
    syncMsg="Sincronizzato";
  }catch(e){if(e.code===404)cfg("gist","");syncMsg=e.code===401?"Token non valido":"Sincronizzazione non riuscita"}
}
function push(){if(!gh())return;clearTimeout(pushT);pushT=setTimeout(pushNow,2000)}
const A=()=>Object.values(S.artists);
const pend=()=>A().filter(a=>a.stato==="nuovo").sort((x,y)=>(x.ord||0)-(y.ord||0));
const liked=()=>A().filter(a=>a.stato==="aggiunto").sort((x,y)=>String(y.dec).localeCompare(String(x.dec)));

/* ============ interfaccia di base ============ */
let view="scopri", busy=false, openArtist=null;
function toast(msg,act){
  const el=$("#toast");clearTimeout(toast._t);
  el.innerHTML=`<span>${esc(msg)}</span>${act?`<button type="button">${esc(act.l)}</button>`:""}`;
  el.hidden=false;
  if(act)el.querySelector("button").onclick=()=>{el.hidden=true;act.f()};
  toast._t=setTimeout(()=>el.hidden=true,act?6000:3500);
}
function tabs(){
  const t=[["scopri","Scopri",pend().length],["preferiti","Preferiti",liked().length],["imp","Opzioni",0]];
  $("#tabs").innerHTML=t.map(([k,l,n])=>`<button type="button" data-v="${k}"${view===k?' aria-current="page"':""}>${l}${n?`<span class="n">${n}</span>`:""}</button>`).join("");
}
function render(){
  tabs();
  if(view==="scopri")renderDeck();else if(view==="preferiti")renderFav();else renderSet();
  renderPlayer();
}
const cover=(a,cls)=>a.img?`<img src="${esc(a.img)}" alt="" loading="lazy">`:`<div class="fallback" style="background:linear-gradient(135deg,hsl(${hue(a.nome)} 60% 45%),hsl(${(hue(a.nome)+40)%360} 65% 25%))">${esc(initials(a.nome))}</div>`;

/* ============ accesso a Spotify (PKCE) ============ */
const SCOPES="streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-library-modify user-library-read playlist-modify-private playlist-modify-public";
const REDIR=location.origin+location.pathname;
const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const tok=()=>{try{return JSON.parse(localStorage.getItem("sd-tok"))}catch(e){return null}};
const logged=()=>!!tok();
async function login(){
  const cid=cfg("cid");
  if(!cid){view="imp";render();toast("Inserisci prima il Client ID di Spotify");return}
  const v=b64(crypto.getRandomValues(new Uint8Array(64)));
  cfg("ver",v);
  const ch=b64(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));
  location.href="https://accounts.spotify.com/authorize?"+new URLSearchParams({client_id:cid,response_type:"code",redirect_uri:REDIR,scope:SCOPES,code_challenge_method:"S256",code_challenge:ch});
}
async function tokenReq(body){
  const r=await fetch("https://accounts.spotify.com/api/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:cfg("cid"),...body})});
  const j=await r.json();if(!r.ok)throw new Error(j.error_description||j.error||"errore");return j;
}
function saveTok(j){const o=tok()||{};localStorage.setItem("sd-tok",JSON.stringify({a:j.access_token,r:j.refresh_token||o.r,e:Date.now()+j.expires_in*1000-60000}))}
async function callback(){
  const p=new URLSearchParams(location.search),code=p.get("code");
  if(p.get("error"))toast("Accesso a Spotify annullato");
  if(!code){if(p.get("error"))history.replaceState({},"",REDIR);return}
  try{saveTok(await tokenReq({grant_type:"authorization_code",code,redirect_uri:REDIR,code_verifier:cfg("ver")}));toast("Collegato a Spotify")}
  catch(e){toast("Accesso non riuscito: "+e.message)}
  history.replaceState({},"",REDIR);
}
async function token(){
  let t=tok();if(!t)return null;
  if(Date.now()>t.e&&t.r){try{saveTok(await tokenReq({grant_type:"refresh_token",refresh_token:t.r}));t=tok()}catch(e){localStorage.removeItem("sd-tok");return null}}
  return t.a;
}
async function api(path,opt={},retry=true){
  const a=await token();if(!a)throw Object.assign(new Error("Non collegato a Spotify"),{code:"login"});
  const r=await fetch("https://api.spotify.com/v1"+path,{...opt,headers:{Authorization:"Bearer "+a,...(opt.body?{"Content-Type":"application/json"}:{})},body:opt.body&&typeof opt.body!=="string"?JSON.stringify(opt.body):opt.body});
  if(r.status===429&&retry){await new Promise(s=>setTimeout(s,(Number(r.headers.get("Retry-After"))||2)*1000));return api(path,opt,false)}
  if(r.status===204||r.status===202)return {};
  let j={};try{j=await r.json()}catch(e){}
  if(!r.ok){const e=new Error(j.error?.message||("Errore "+r.status));e.code=r.status;e.reason=j.error?.reason;throw e}
  return j;
}
function errMsg(e){
  if(e.code==="login")return "Collegati prima a Spotify (Impostazioni)";
  if(e.code===403)return "Spotify ha rifiutato: serve Premium e l'app deve avere il tuo account tra gli utenti autorizzati";
  if(e.code===404||e.reason==="NO_ACTIVE_DEVICE")return "Apri l'app Spotify sul telefono (basta farla partire) e riprova";
  return e.message||"Errore";
}

/* ============ ricerca su Spotify, Wikipedia, Last.fm ============ */
async function spArtist(name){
  const j=await api("/search?"+new URLSearchParams({q:`artist:"${name}"`,type:"artist",limit:5}));
  const n=norm(name);return (j.artists?.items||[]).find(x=>norm(x.name)===n)||null;
}
const trk=t=>({t:t.name,uri:t.uri,al:t.album?.name||"",an:(t.album?.release_date||"").slice(0,4),img:t.album?.images?.[1]?.url||t.album?.images?.[0]?.url||""});
async function spTracks(art){
  const j=await api("/search?"+new URLSearchParams({q:`artist:"${art.name}"`,type:"track",limit:10}));
  const seen=new Set();
  return (j.tracks?.items||[]).filter(t=>t.artists.some(a=>a.id===art.id)).filter(t=>{const k=norm(t.name);if(seen.has(k))return false;seen.add(k);return true}).slice(0,3).map(trk);
}
async function spResolve(a,b){
  const j=await api("/search?"+new URLSearchParams({q:`track:"${b.t}" artist:"${a.nome}"`,type:"track",limit:5}));
  const an=norm(a.nome),t=(j.tracks?.items||[]).find(x=>x.artists.some(y=>norm(y.name)===an)&&norm(x.name)===norm(b.t))||(j.tracks?.items||[]).find(x=>x.artists.some(y=>norm(y.name)===an));
  if(t){const o=trk(t);b.uri=o.uri;b.img=b.img||o.img;b.al=b.al||o.al;b.an=b.an||o.an;save()}
  return b.uri;
}
async function enrich(a){
  if(a._en||!logged())return;a._en=1;
  try{
    if(!a.img||!a.spId){const x=await spArtist(a.nome);if(x){a.spId=x.id;a.img=x.images?.[0]?.url||a.img||"";save()}}
    for(const b of a.brani)if(!b.img&&b.uri){/* le copertine arrivano con le ricerche */}
    render();
  }catch(e){}
}
const lfm=(m,p)=>fetch("https://ws.audioscrobbler.com/2.0/?"+new URLSearchParams({method:m,api_key:cfg("lfm"),format:"json",...p})).then(r=>r.json());
async function wiki(name){
  for(const lang of ["it","en"]){
    try{
      const r=await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g,"_"))}`);
      if(!r.ok)continue;const j=await r.json();
      if(j.type==="disambiguation"||!j.extract)continue;
      if(/band|group|singer|musician|rapper|duo|trio|cantante|gruppo|musicista|cantautor|\bdj\b|producer|produttor/i.test((j.description||"")+" "+j.extract.slice(0,300)))return {t:cut(j.extract),u:j.content_urls?.desktop?.page||""};
    }catch(e){}
  }
  return null;
}
const cut=s=>{s=String(s).replace(/<[^>]+>/g,"").trim();if(s.length<=360)return s;const i=s.slice(0,360).lastIndexOf(". ");return s.slice(0,i>120?i+1:360)};

/* ============ scoperta: artisti affini a quelli che ti piacciono ============ */
async function discover(manual){
  if(busy)return;
  if(!logged()){if(manual){view="imp";render();toast("Collegati prima a Spotify")}return}
  if(!cfg("lfm")){if(manual){view="imp";render();toast("Inserisci la chiave Last.fm per cercare artisti affini")}return}
  busy=true;render();
  try{
    const known=new Set(A().map(a=>norm(a.nome)));
    const base=liked().slice(0,10).sort(()=>Math.random()-.5).slice(0,5);
    if(!base.length){toast("Metti qualche artista tra i preferiti: da lì cerco quelli simili");return}
    const sc={};
    await Promise.all(base.map(async a=>{
      try{const j=await lfm("artist.getsimilar",{artist:a.nome,limit:30,autocorrect:1});
        (j.similarartists?.artist||[]).forEach(x=>{const k=norm(x.name);if(known.has(k))return;const o=sc[k]||(sc[k]={nome:x.name,s:0,from:[]});o.s+=Number(x.match)||0;o.from.push(a.nome)})}catch(e){}
    }));
    const cand=Object.values(sc).sort((x,y)=>y.s-x.s).slice(0,18);
    let added=0,ord=A().reduce((m,a)=>Math.max(m,a.ord||0),0);
    for(const c of cand){
      if(added>=4)break;
      try{
        const inf=await lfm("artist.getinfo",{artist:c.nome,lang:"it",autocorrect:1});
        const L=Number(inf.artist?.stats?.listeners||0);
        if(L>700000)continue;
        const sp=await spArtist(c.nome);if(!sp)continue;
        const br=await spTracks(sp);if(br.length<2)continue;
        const w=await wiki(c.nome);
        const tags=(inf.artist?.tags?.tag||[]).map(t=>t.name).slice(0,3).join(" · ");
        const id=slug(sp.name);if(S.artists[id])continue;
        S.artists[id]={id,nome:sp.name,genere:tags,rif:c.from.slice(0,2),info:w?w.t:cut(inf.artist?.bio?.summary||""),wiki:w?w.u:"",spId:sp.id,img:sp.images?.[0]?.url||"",stato:"nuovo",ord:++ord,dec:"",brani:br,scoperta:1};
        known.add(norm(sp.name));added++;save();render();
      }catch(e){if(e.code===403||e.code==="login")throw e}
    }
    if(!added&&manual)toast("Non ho trovato artisti nuovi adesso, riprova più tardi");
  }catch(e){toast(errMsg(e))}
  finally{busy=false;render()}
}

/* ============ card Scopri ============ */
function songRow(a,b,i){
  const hearted=S.hearts.includes(b.uri);
  return `<div class="song${nowUri()===b.uri?" on":""}"><div class="cv"${b.img?` style="background-image:url('${esc(b.img)}')"`:""}></div><div class="tx"><b>${esc(b.t)}</b><i>${esc([b.al,b.an&&"("+b.an+")"].filter(Boolean).join(" "))||"&nbsp;"}</i></div><button class="rbtn heart${hearted?" on":""}" type="button" data-heart="${esc(a.id)}" data-i="${i}" aria-label="Salva tra i brani che ti piacciono" aria-pressed="${hearted}">${hearted?IC.heart:IC.heart0}</button><button class="rbtn play" type="button" data-play="${esc(a.id)}" data-i="${i}" aria-label="Ascolta ${esc(b.t)}">${IC.play}</button></div>`;
}
function renderDeck(){
  const q=pend(),el=$("#view");
  let h=`<h1 class="pg">Scopri</h1><p class="sub">Un artista alla volta, simile a quelli che ti piacciono. Swipe a destra se lo vuoi, a sinistra se no.</p>`;
  if(!q.length){
    h+=`<div class="empty">${busy?`<span><i class="spin"></i>Cerco artisti simili ai tuoi preferiti…</span>`:`<span>Per ora non ho altri artisti da proporti.</span><button class="btn" type="button" data-discover>Cerca artisti simili</button>`}</div>`;
    el.innerHTML=h;return;
  }
  const a=q[0];enrich(a);
  const ghosts=q.slice(1,3).map((_,i)=>`<div class="ghost g${i+1}"></div>`).reverse().join("");
  h+=`<div class="deck-stack">${ghosts}<article class="dcard" data-aid="${esc(a.id)}">
    <div class="hint"><span class="ok">${IC.ok}Mi piace</span><span class="no">No${IC.x}</span></div>
    <div class="ph">${cover(a)}</div>
    <div class="dbody"><div class="tags">${esc(a.genere||"")}</div><h2>${esc(a.nome)}</h2>
    ${a.rif&&a.rif.length?`<div class="sim"><span class="l">Simile a</span>${a.rif.map(r=>`<span class="chip">${esc(r)}</span>`).join("")}</div>`:""}
    ${a.info?`<p class="about">${esc(a.info)}${a.wiki?` <a href="${esc(a.wiki)}" target="_blank" rel="noopener">Wikipedia</a>`:""}</p>`:""}
    <div class="songs">${a.brani.slice(0,3).map((b,i)=>songRow(a,b,i)).join("")}</div></div></article></div>
    <div class="acts"><button class="big no" type="button" data-dno aria-label="Non mi piace ${esc(a.nome)}">${IC.x}</button><button class="big ok" type="button" data-dok aria-label="Mi piace ${esc(a.nome)}">${IC.ok}</button></div>
    <p class="count">${q.length} da valutare${busy?" · cerco altri simili…":""}</p>`;
  el.innerHTML=h;
}
function decide(id,yes){
  const a=S.artists[id];if(!a)return;
  const prev={stato:a.stato,dec:a.dec};
  a.stato=yes?"aggiunto":"ignorato";a.dec=today();save();render();
  toast(yes?`${a.nome}: ti piace, cerco artisti simili`:`${a.nome}: non fa per te`,{l:"Annulla",f:()=>{a.stato=prev.stato;a.dec=prev.dec;save();render()}});
  if(pend().length<4)setTimeout(()=>discover(false),500);
}
function flyOut(el,dir,done){
  el.style.setProperty("--p",dir);el.dataset.dir=dir>0?"ok":"no";
  el.style.transition="transform .3s cubic-bezier(.4,0,1,1),opacity .3s";
  el.style.transform=`translateX(${dir*innerWidth*.9}px) rotate(${dir*10}deg)`;el.style.opacity="0";
  setTimeout(done,300);
}
const swipe=(()=>{
  let s=null;const TH=w=>Math.min(120,w*.3);
  document.addEventListener("pointerdown",e=>{
    if(e.button!==0||e.target.closest("button,a"))return;
    const el=e.target.closest(".dcard");if(!el)return;
    s={el,x:e.clientX,y:e.clientY,dx:0,lock:false,id:e.pointerId,w:el.offsetWidth,vx:0,lt:performance.now(),lx:e.clientX};
  });
  document.addEventListener("pointermove",e=>{
    if(!s||e.pointerId!==s.id)return;
    const dx=e.clientX-s.x,dy=e.clientY-s.y;
    if(!s.lock){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){s=null;return}
      if(!(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.2))return;
      s.lock=true;s.x+=dx>0?10:-10;try{s.el.setPointerCapture(e.pointerId)}catch(_){}
      s.el.classList.add("swiping");s.el.style.transition="none";
    }
    e.preventDefault();
    const n=performance.now();s.vx=(e.clientX-s.lx)/Math.max(1,n-s.lt);s.lx=e.clientX;s.lt=n;
    s.dx=e.clientX-s.x;
    s.el.style.transform=`translateX(${s.dx}px) rotate(${s.dx/s.w*8}deg)`;
    s.el.style.setProperty("--p",Math.max(-1,Math.min(1,s.dx/TH(s.w))));
    s.el.dataset.dir=s.dx>0?"ok":"no";
  },{passive:false});
  function end(e){
    if(!s||e.pointerId!==s.id)return;
    const st=s;s=null;if(!st.lock)return;
    const kill=ev=>{ev.preventDefault();ev.stopPropagation()};
    document.addEventListener("click",kill,{capture:true,once:true});
    setTimeout(()=>document.removeEventListener("click",kill,true),400);
    const el=st.el;el.classList.remove("swiping");
    const fast=Math.abs(st.vx)>.6&&Math.sign(st.vx)===Math.sign(st.dx)&&Math.abs(st.dx)>40;
    const go=e.type==="pointerup"&&(Math.abs(st.dx)>=TH(st.w)||fast);
    if(!go){el.style.transition="transform .45s cubic-bezier(.2,1.4,.4,1)";el.style.transform="";el.style.setProperty("--p",0);setTimeout(()=>{el.style.transition="";delete el.dataset.dir},450);return}
    const dir=st.dx>0?1:-1;flyOut(el,dir,()=>decide(el.dataset.aid,dir>0));
  }
  addEventListener("pointerup",end);addEventListener("pointercancel",end);
  document.addEventListener("dragstart",e=>{if(e.target.closest&&e.target.closest(".dcard"))e.preventDefault()});
  return {active:()=>!!(s&&s.lock)};
})();

/* ============ Preferiti ============ */
function renderFav(){
  const L=liked(),has=S.playlistId;
  let h=`<h1 class="pg">Preferiti</h1><p class="sub">Gli artisti che hai accettato. Tocca il cuore su una canzone per salvarla.</p>`;
  h+=`<div class="bar"><p>${has?`La tua playlist «Sounder»: ${S.playlistN} brani, aggiornata il ${esc(S.playlistDate)}. `:`${S.hearts.length} canzon${S.hearts.length===1?"e":"i"} con il cuore. `}${has?`<a class="open" href="https://open.spotify.com/playlist/${esc(S.playlistId)}" target="_blank" rel="noopener">Apri la playlist</a>`:"Con il tasto crei una sola playlist; quando la aggiorni resta sempre la stessa."}</p><button class="btn" type="button" data-playlist${busy?" disabled":""}>${has?"Aggiorna playlist":"Crea playlist"}</button></div>`;
  if(!L.length)h+=`<div class="empty">Nessun preferito ancora: vai su Scopri e swipa a destra.</div>`;
  h+=L.map(a=>`<div class="arow"><button class="ahead" type="button" data-open="${esc(a.id)}" aria-expanded="${openArtist===a.id}"><span class="av"${a.img?` style="background-image:url('${esc(a.img)}')"`:` style="background:hsl(${hue(a.nome)} 55% 35%)"`}>${a.img?"":esc(initials(a.nome))}</span><span class="tx"><b>${esc(a.nome)}</b><i>${esc(a.genere||"")}</i></span></button>${openArtist===a.id?`<div class="abody">${a.info?`<p class="about">${esc(a.info)}</p>`:""}<div class="songs">${a.brani.map((b,i)=>songRow(a,b,i)).join("")}</div><div class="mini"><button class="btn" type="button" data-playall="${esc(a.id)}">${IC.play}Ascolta tutto</button><button class="btn ghostb" type="button" data-remove="${esc(a.id)}">Togli dai preferiti</button></div></div>`:""}</div>`).join("");
  $("#view").innerHTML=h;
  L.filter(a=>openArtist===a.id).forEach(enrich);
}
async function heart(id,i){
  const a=S.artists[id],b=a&&a.brani[i];if(!b)return;
  try{
    if(!b.uri)await spResolve(a,b);
    if(!b.uri){toast("Non trovo questo brano su Spotify");return}
    const on=S.hearts.includes(b.uri);
    await api("/me/library?"+new URLSearchParams({uris:b.uri}),{method:on?"DELETE":"PUT"});
    S.hearts=on?S.hearts.filter(x=>x!==b.uri):[...S.hearts,b.uri];save();render();
    toast(on?"Tolta dai brani che ti piacciono":"Salvata nei brani che ti piacciono");
  }catch(e){toast(errMsg(e))}
}
async function syncHearts(){
  if(!logged())return;
  const uris=A().flatMap(a=>a.brani.map(b=>b.uri)).filter(Boolean);
  try{
    const out=[];
    for(let i=0;i<uris.length;i+=40){const part=uris.slice(i,i+40);const r=await api("/me/library/contains?"+new URLSearchParams({uris:part.join(",")}));if(Array.isArray(r))r.forEach((v,k)=>v&&out.push(part[k]))}
    S.hearts=[...new Set(out)];save();render();
  }catch(e){}
}
async function makePlaylist(){
  if(busy)return;
  const uris=[...new Set(S.hearts)].slice(0,100);
  if(!uris.length){toast("Metti il cuore a qualche canzone prima");return}
  busy=true;render();
  try{
    if(!S.playlistId){const p=await api("/me/playlists",{method:"POST",body:{name:"Sounder",description:"Le canzoni che ti piacciono, da Sounder",public:false}});S.playlistId=p.id}
    await api(`/playlists/${S.playlistId}/items`,{method:"PUT",body:{uris}});
    S.playlistN=uris.length;S.playlistDate=today();save();toast("Playlist Sounder aggiornata");
  }catch(e){
    if(e.code===404&&S.playlistId){S.playlistId="";save()}
    toast(errMsg(e));
  }finally{busy=false;render()}
}

/* ============ ascolto ============ */
let dev=null,now=null,sdk=null,poll=null;
const nowUri=()=>now&&now.uri||"";
const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
function initSdk(){
  if(mobile||sdk||!logged()||window._sdkTried)return;window._sdkTried=1;
  window.onSpotifyWebPlaybackSDKReady=()=>{
    sdk=new Spotify.Player({name:"Sounder",getOAuthToken:cb=>token().then(cb),volume:.8});
    sdk.addListener("ready",({device_id})=>{dev=device_id});
    sdk.addListener("not_ready",()=>{dev=null});
    sdk.addListener("player_state_changed",st=>{if(!st)return;const t=st.track_window.current_track;now={uri:t.uri,t:t.name,a:t.artists.map(x=>x.name).join(", "),img:t.album.images[0]?.url||"",playing:!st.paused};renderPlayer()});
    sdk.connect();
  };
  const s=document.createElement("script");s.src="https://sdk.scdn.co/spotify-player.js";s.async=true;document.head.appendChild(s);
}
async function pickDevice(){
  if(dev)return dev;
  const j=await api("/me/player/devices");const l=j.devices||[];
  const d=l.find(x=>x.is_active)||l[0];return d?d.id:null;
}
async function playUris(uris,meta){
  try{
    try{sdk&&sdk.activateElement&&sdk.activateElement()}catch(e){}
    const d=await pickDevice();
    if(!d){toast("Apri l'app Spotify sul telefono (basta farla partire) e riprova");return}
    await api("/me/player/play?"+new URLSearchParams({device_id:d}),{method:"PUT",body:{uris}});
    api("/me/player/repeat?"+new URLSearchParams({state:"off",device_id:d}),{method:"PUT"}).catch(()=>{});
    now={uri:uris[0],t:meta.t,a:meta.a,img:meta.img||"",playing:true,hold:Date.now()+4000};renderPlayer();startPoll();
  }catch(e){toast(errMsg(e))}
}
async function playFrom(id,i,all){
  const a=S.artists[id];if(!a)return;
  const list=all?a.brani:a.brani.slice(i);
  for(const b of list.slice(0,3))if(!b.uri)try{await spResolve(a,b)}catch(e){}
  const uris=list.map(b=>b.uri).filter(Boolean);
  if(!uris.length){toast("Non trovo questo brano su Spotify");return}
  const b=list.find(x=>x.uri===uris[0]);
  playUris(uris,{t:b.t,a:a.nome,img:b.img||a.img});
}
async function toggle(){
  try{await api("/me/player/"+(now&&now.playing?"pause":"play"),{method:"PUT"});if(now){now.playing=!now.playing;renderPlayer()}}catch(e){toast(errMsg(e))}
}
async function nextTrack(){try{await api("/me/player/next",{method:"POST"});setTimeout(refreshNow,800)}catch(e){toast(errMsg(e))}}
async function refreshNow(){
  try{
    const j=await api("/me/player");
    if(j&&j.item&&!(now&&now.hold>Date.now()&&j.item.uri!==now.uri)){now={uri:j.item.uri,t:j.item.name,a:(j.item.artists||[]).map(x=>x.name).join(", "),img:j.item.album?.images?.[1]?.url||j.item.album?.images?.[0]?.url||"",playing:!!j.is_playing};renderPlayer()}
  }catch(e){}
}
function startPoll(){clearInterval(poll);poll=setInterval(()=>{if(!document.hidden&&logged())refreshNow()},5000);setTimeout(refreshNow,1500)}
function renderPlayer(){
  const el=$("#player");
  if(!now){el.hidden=true;document.body.classList.remove("hp");return}
  el.hidden=false;
  el.innerHTML=`<div class="in"><div class="cv"${now.img?` style="background-image:url('${esc(now.img)}')"`:""}></div><div class="tx"><b>${esc(now.t)}</b><i>${esc(now.a)}</i></div><button class="rbtn pp" type="button" data-pp aria-label="${now.playing?"Pausa":"Riprendi"}">${now.playing?IC.pause:IC.play}</button><button class="rbtn" type="button" data-next aria-label="Brano successivo">${IC.next}</button></div>`;
  document.querySelectorAll(".song").forEach(()=>{});
}

/* ============ Impostazioni ============ */
function renderSet(){
  const ok=logged();
  $("#view").innerHTML=`<h1 class="pg">Impostazioni</h1><p class="sub">Qui colleghi Sounder a Spotify. Le chiavi restano solo nel tuo browser.</p><div class="set">
  <div class="card"><h3>1. Spotify ${ok?'<span class="ok-t">collegato</span>':""}</h3>
    <ol><li>Vai su <b>developer.spotify.com/dashboard</b> e crea un'app.</li><li>Come «Redirect URI» scrivi: <code>${esc(REDIR)}</code></li><li>Spunta «Web API» e «Web Playback SDK», poi copia il <b>Client ID</b> qui sotto.</li></ol>
    <label>Client ID<input id="cid" value="${esc(cfg("cid"))}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="incolla il Client ID"></label>
    <div class="mini"><button class="btn" type="button" data-savecfg>${ok?"Salva":"Salva e collegati a Spotify"}</button>${ok?`<button class="btn ghostb" type="button" data-logout>Scollega</button>`:""}</div></div>
  <div class="card"><h3>2. Artisti affini (Last.fm)</h3><small>Serve per trovare artisti simili a quelli che ti piacciono. Chiave gratuita su last.fm/api.</small>
    <label>Chiave API Last.fm<input id="lfm" value="${esc(cfg("lfm"))}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="incolla la chiave"></label>
    <div class="mini"><button class="btn" type="button" data-savelfm>Salva</button></div></div>
  <div class="card"><h3>Ascolto</h3><small>${mobile?"Dal telefono, Sounder comanda l'app Spotify: tieni l'app aperta o avviala una volta, poi premi play qui. Il player incorporato nel browser funziona solo su computer.":"Su computer, Sounder diventa un lettore Spotify: premi play su una canzone e parte qui nella pagina."} Serve Spotify Premium.</small></div>
  <div class="card"><h3>3. Sincronizza i dispositivi ${gh()?'<span class="ok-t">attiva</span>':""}</h3><small>Le tue scelte vengono salvate in un file privato nel tuo GitHub, così le ritrovi su telefono e computer. Serve un token gratuito: apri <b>github.com/settings/tokens/new?scopes=gist&amp;description=Sounder</b>, premi «Generate token» in fondo e copialo.</small>
    <label>Token GitHub<input id="gh" value="${esc(gh())}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="incolla il token (ghp_…)"></label>
    <div class="mini"><button class="btn" type="button" data-savegh>Salva e sincronizza</button>${gh()?`<button class="btn ghostb" type="button" data-nogh>Disattiva</button>`:""}</div>${syncMsg?`<small>${esc(syncMsg)}</small>`:""}</div>
  <div class="card"><h3>I tuoi dati</h3><small>Le tue scelte sono salvate in questo browser. Per portarle su un altro dispositivo, copia il testo qui sotto e incollalo là.</small>
    <textarea id="exp" spellcheck="false" aria-label="Dati esportati">${esc(JSON.stringify(S,strip))}</textarea>
    <div class="mini"><button class="btn ghostb" type="button" data-import>Importa dal testo</button></div></div>
  </div>`;
}

/* ============ eventi ============ */
document.addEventListener("click",e=>{
  const T=s=>e.target.closest(s);let x;
  if((x=T("[data-v]"))){view=x.dataset.v;render();scrollTo({top:0});return}
  if(T("[data-discover]")){discover(true);return}
  if((x=T("[data-dok],[data-dno]"))){const el=$(".dcard");if(el&&!el.dataset.busy){el.dataset.busy=1;const y=x.hasAttribute("data-dok");flyOut(el,y?1:-1,()=>decide(el.dataset.aid,y))}return}
  if((x=T("[data-play]"))){playFrom(x.dataset.play,Number(x.dataset.i),false);return}
  if((x=T("[data-playall]"))){playFrom(x.dataset.playall,0,true);return}
  if((x=T("[data-heart]"))){heart(x.dataset.heart,Number(x.dataset.i));return}
  if((x=T("[data-open]"))){openArtist=openArtist===x.dataset.open?null:x.dataset.open;render();return}
  if((x=T("[data-remove]"))){const a=S.artists[x.dataset.remove];if(a){a.stato="nuovo";a.dec="";a.ord=A().reduce((m,y)=>Math.max(m,y.ord||0),0)+1;save();openArtist=null;render();toast(`${a.nome} è tornato in Scopri`)}return}
  if(T("[data-playlist]")){makePlaylist();return}
  if(T("[data-pp]")){toggle();return}
  if(T("[data-next]")){nextTrack();return}
  if(T("[data-savecfg]")){cfg("cid",$("#cid").value.trim());if(!cfg("cid")){toast("Incolla il Client ID");return}if(logged()){toast("Salvato");render()}else login();return}
  if(T("[data-savelfm]")){cfg("lfm",$("#lfm").value.trim());toast("Chiave salvata");discover(true);return}
  if(T("[data-savegh]")){cfg("gh",$("#gh").value.trim());cfg("gist","");if(!gh()){toast("Incolla il token");return}syncMsg="Sincronizzo…";render();pull().then(()=>{render();toast(syncMsg)});return}
  if(T("[data-nogh]")){cfg("gh","");cfg("gist","");syncMsg="";render();toast("Sincronizzazione disattivata");return}
  if(T("[data-logout]")){localStorage.removeItem("sd-tok");sdk&&sdk.disconnect();sdk=null;dev=null;now=null;render();toast("Scollegato");return}
  if(T("[data-import]")){try{const j=JSON.parse($("#exp").value);if(!j||!j.artists)throw 0;S=Object.assign({artists:{},hearts:[],playlistId:""},j);save();toast("Dati importati");render()}catch(err){toast("Il testo non è valido")}return}
});

/* ============ avvio ============ */
(async()=>{
  load();
  await callback();
  if(!logged()&&!cfg("cid"))view="imp";
  render();
  if(logged()){initSdk();syncHearts();refreshNow();startPoll()}
  pull();
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)pull()});
  if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
