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
const IC={ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',play:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>',pause:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',next:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5.5v13l9-6.5zM17 5.5h2v13h-2z"/></svg>',heart:'<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/></svg>',info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.800v.1"/></svg>',known:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.500l2.800 2.800L16 9.500"/></svg>',heart0:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.600-7 10-7 10z"/></svg>'};

/* ============ dati (salvati nel browser) ============ */
let S={artists:{},hearts:[],playlistId:"",playlistN:0,playlistDate:""};
function load(){
  try{const j=JSON.parse(localStorage.getItem("sd-data"));if(j&&j.artists)S=Object.assign(S,j)}catch(e){}
  if(!Object.keys(S.artists).length){
    SEED.forEach(([id,nome,genere,rif,info,st,br],i)=>{S.artists[id]={id,nome,genere,rif,info,stato:st==="a"?"aggiunto":st==="i"?"ignorato":"nuovo",ord:i,dec:st==="n"?"":"2026-11-13",brani:br.map(([t,tid,al,an])=>({t,uri:tid?"spotify:track:"+tid:"",al,an}))}});
    S.t=0;saveLocal();
  }
  if(!S.mig){
    const ok=new Set(OK_SEED),no=new Set(NO_SEED);
    Object.values(S.artists).forEach(a=>a.brani.forEach(b=>{if(b.st)return;if((b.uri&&S.hearts.includes(b.uri))||ok.has(b.t))b.st="ok";else if(no.has(b.t))b.st="no"}));
    S.mig=1;saveLocal();
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
const pend=t=>A().filter(a=>a.stato==="nuovo"&&(!t||(a.tema||"per-te")===t)).sort((x,y)=>(x.ord||0)-(y.ord||0));
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
  const t=[["scopri","Scopri",pend().length],["preferiti","Mix",A().reduce((n,a)=>n+okList(a).length,0)],["imp","Opzioni",0]];
  $("#tabs").innerHTML=t.map(([k,l,n])=>`<button type="button" data-v="${k}"${view===k?' aria-current="page"':""}>${l}${n?`<span class="n">${n}</span>`:""}</button>`).join("");
}
let centerTheme=false;
function render(){
  const tl0=document.querySelector(".themes"),keepL=tl0?tl0.scrollLeft:null;
  tabs();
  if(view==="scopri")renderDeck();else if(view==="preferiti")renderFav();else renderSet();
  renderPlayer();
  const tl=document.querySelector(".themes");
  if(tl){
    const sel=tl.querySelector("[aria-selected=true]");
    if(keepL!==null&&!centerTheme)tl.scrollLeft=keepL;
    if(sel){
      const l=sel.offsetLeft-tl.scrollLeft,r=l+sel.offsetWidth,pad=12;
      if(centerTheme||l<pad||r>tl.clientWidth-48)tl.scrollLeft=sel.offsetLeft-(tl.clientWidth-sel.offsetWidth)/2;
      centerTheme=false;
    }
  }
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

/* ============ temi ============ */
const TEMI=[
 {id:"per-te",n:"Per te",d:"Nuovi nomi che suonano come i tuoi preferiti: tu swipi, Sounder impara."},
 {id:"italiana",n:"Musica italiana",d:"Voci italiane fuori dai radar: scopri chi sta scrivendo la prossima canzone che canterai.",tags:["italian","italiano","cantautore","italian pop","italian rock","indie italiano","italian hip hop"]},
 {id:"malinconico",n:"Malinconico ma non troppo",d:"Malinconia da portare in giro con il sorriso: Placebo e Smashing Pumpkins in versione pomeriggio di pioggia.",tags:["melancholic","dream pop","alternative rock","shoegaze","post-punk","sadcore"],seeds:["Placebo","The Smashing Pumpkins","The Cure","Mazzy Star"]},
 {id:"happy",n:"Happy Songs",d:"Energia pura per le giornate di lavoro: ritornelli che spingono e groove che fanno partire il lunedì.",tags:["feel good","happy","upbeat","funk","reggae","disco","soul"]},
 {id:"strumenta",n:"Strumenta",d:"Niente parole, solo suono: musica da ascoltare a occhi chiusi o da lasciare in cuffia mentre lavori.",tags:["instrumental","post-rock","ambient","jazz fusion","math rock"]},
 {id:"pietre",n:"Pietre musicali",d:"Gli artisti e i gruppi che hanno fatto la storia, dagli anni '70 ai 2000: le fondamenta di ogni playlist."},
 {id:"sottocassa",n:"Sotto cassa",d:"Cassa dritta, bpm alti e pista infinita: rave, techno, goa, hardcore e trance.",tags:["trance","goa trance","psytrance","hard techno","hardcore","techno","rave","gabber"]}
];
let tema=cfg("tema")||"per-te";if(!TEMI.some(t=>t.id===tema))tema="per-te";const tried={};
const temaOf=a=>a.tema||"per-te";
const shuffle=l=>l.map(x=>[Math.random(),x]).sort((p,q)=>p[0]-q[0]).map(x=>x[1]);

/* ============ scoperta: artisti nuovi, per tema o affini ai tuoi preferiti ============ */
async function candidates(T,known){
  const out={};
  const add=(name,from,w)=>{const k=norm(name);if(!k||known.has(k))return;const o=out[k]||(out[k]={nome:name,s:0,from:[]});o.s+=w;if(from&&!o.from.includes(from))o.from.push(from)};
  if(T.id==="per-te"){
    const base=A().filter(a=>a.stato==="aggiunto"||okList(a).length).map(a=>[Math.pow(Math.random(),1/(okList(a).length*2+1)),a]).sort((p,q)=>q[0]-p[0]).slice(0,5).map(x=>x[1]);
    if(!base.length)return {err:"Metti il cuore a qualche canzone: da lì capisco cosa ti piace"};
    await Promise.all(base.map(async a=>{try{const j=await lfm("artist.getsimilar",{artist:a.nome,limit:30,autocorrect:1});(j.similarartists?.artist||[]).forEach(x=>add(x.name,a.nome,Number(x.match)||0))}catch(e){}}));
    return {list:Object.values(out).sort((x,y)=>y.s-x.s)};
  }
  const tags=shuffle(T.tags).slice(0,2);
  await Promise.all(tags.map(async t=>{try{const j=await lfm("tag.gettopartists",{tag:t,limit:30,page:1+Math.floor(Math.random()*6)});(j.topartists?.artist||[]).forEach(x=>add(x.name,"",Math.random()))}catch(e){}}));
  if(T.seeds){const sd=T.seeds[Math.floor(Math.random()*T.seeds.length)];try{const j=await lfm("artist.getsimilar",{artist:sd,limit:30,autocorrect:1});(j.similarartists?.artist||[]).forEach(x=>add(x.name,sd,Number(x.match)||0))}catch(e){}}
  return {list:shuffle(Object.values(out))};
}
async function discover(manual,t){
  const T=TEMI.find(x=>x.id===(t||tema))||TEMI[0];
  if(busy)return;
  if(!logged()){if(manual){view="imp";render();toast("Collegati prima a Spotify")}return}
  if(T.id!=="pietre"&&!cfg("lfm")){if(manual){view="imp";render();toast("Inserisci la chiave Last.fm per cercare artisti")}return}
  busy=true;render();
  try{
    const known=new Set(A().map(a=>norm(a.nome)));
    let ranked,ord=A().reduce((m,a)=>Math.max(m,a.ord||0),0),added=0;
    if(T.id==="pietre"){
      ranked=shuffle(PIETRE.filter(([n])=>!known.has(norm(n)))).slice(0,14).map(([n,d,g])=>({x:{nome:n,from:[]},inf:{},tg:["anni "+(d==="00"?"2000":"'"+d),g]}));
    }else{
      const c=await candidates(T,known);
      if(c.err){toast(c.err);return}
      const tv=tasteVec();
      const infos=await Promise.all(c.list.slice(0,16).map(async x=>{
        try{
          const inf=await lfm("artist.getinfo",{artist:x.nome,lang:"it",autocorrect:1});
          const L=Number(inf.artist?.stats?.listeners||0);
          const tg=(inf.artist?.tags?.tag||[]).map(g=>g.name);
          const ws=tg.flatMap(g=>g.toLowerCase().split(/[^a-zàèéìòù]+/)).filter(w=>w.length>3);
          return {x,inf,L,tg,sc:ws.reduce((n,w)=>n+(tv.pos[w]||0)-(tv.neg[w]||0),0)};
        }catch(e){return null}
      }));
      ranked=infos.filter(i=>i&&i.L<=700000).sort((p,q)=>(q.sc-p.sc)||(Math.random()-.5));
    }
    for(const {x,inf,tg} of ranked){
      if(added>=4)break;
      try{
        const sp=await spArtist(x.nome);if(!sp)continue;
        const br=await spTracks(sp);if(br.length<2)continue;
        const w=await wiki(x.nome);
        const id=slug(sp.name);if(S.artists[id])continue;
        S.artists[id]={id,nome:sp.name,genere:tg.slice(0,3).join(" · "),rif:x.from.slice(0,2),info:w?w.t:cut(inf.artist?.bio?.summary||""),wiki:w?w.u:"",spId:sp.id,img:sp.images?.[0]?.url||"",stato:"nuovo",ord:++ord,dec:"",brani:br,scoperta:1,tema:T.id==="per-te"?"":T.id};
        known.add(norm(sp.name));added++;save();render();
      }catch(e){if(e.code===403||e.code==="login")throw e}
    }
    if(!added&&manual)toast("Non ho trovato artisti nuovi adesso, riprova più tardi");
  }catch(e){toast(errMsg(e))}
  finally{busy=false;render()}
}

/* ============ card Scopri ============ */
const vis=a=>a.brani.map((b,i)=>({b,i})).filter(x=>x.b.st!=="no");
const openInfo=new Set(),loadingInfo=new Set();
const sigOf=b=>b.sig||SIG[b.t]||null;
function infoPanel(a,b,key){
  const g=sigOf(b);
  if(loadingInfo.has(key))return `<div class="sinfo"><p class="about"><i class="spin"></i>Cerco informazioni…</p></div>`;
  if(!g)return `<div class="sinfo"><p class="about">Non ho trovato informazioni su questa canzone.</p></div>`;
  const c=Array.isArray(g.c)?g.c.filter(Boolean):[];
  return `<div class="sinfo">${g.s?`<h4>${g.w?"Dalla voce di Wikipedia":"Significato"}</h4><p class="about">${esc(g.s)}${g.src?` <a href="${esc(g.src)}" target="_blank" rel="noopener">Leggi tutto</a>`:""}</p>`:""}${g.a?`<h4>Cosa racconta</h4><p class="about">${esc(g.a)}</p>`:""}${c.length?`<h4>Curiosità</h4><ul>${c.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`:""}${g.ai?`<small class="note">Scritto da un'intelligenza artificiale gratuita: può contenere errori.</small>`:""}</div>`;
}
function songRow(a,b,i){
  const hearted=b.st==="ok",key=a.id+"|"+i,open=openInfo.has(key);
  return `<div class="srow"><div class="song${nowUri()===b.uri?" on":""}" data-aid="${esc(a.id)}" data-i="${i}"><div class="cv"${b.img?` style="background-image:url('${esc(b.img)}')"`:""}></div><div class="tx"><b>${esc(b.t)}</b><i>${esc([b.al,b.an&&"("+b.an+")"].filter(Boolean).join(" "))||"&nbsp;"}</i></div><button class="rbtn info${open?" on":""}" type="button" data-info="${esc(key)}" aria-expanded="${open}" aria-label="Significato e curiosità di ${esc(b.t)}">${IC.info}</button><button class="rbtn known" type="button" data-known="${esc(a.id)}" data-i="${i}" aria-label="Già la conosco" title="Già la conosco">${IC.known}</button><button class="rbtn heart${hearted?" on":""}" type="button" data-heart="${esc(a.id)}" data-i="${i}" aria-label="Mi ispira: aggiungila al Sounder Mix" title="Mi ispira" aria-pressed="${hearted}">${hearted?IC.heart:IC.heart0}</button><button class="rbtn play" type="button" data-play="${esc(a.id)}" data-i="${i}" aria-label="Ascolta ${esc(b.t)}">${IC.play}</button></div>${open?infoPanel(a,b,key):""}</div>`;
}
async function aiInfo(a,b){
  const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"content-type":"application/json",Authorization:"Bearer "+cfg("gk")},body:JSON.stringify({model:"llama-3.3-70b-versatile",temperature:.3,max_tokens:600,response_format:{type:"json_object"},messages:[{role:"system",content:"Sei un esperto di musica. Rispondi sempre e solo in italiano, con JSON valido."},{role:"user",content:`Canzone «${b.t}» di ${a.nome}${b.al?` (album ${b.al})`:""}. Rispondi con JSON: {"s":"una frase sul tema, max 18 parole","a":"2-3 frasi su cosa racconta il testo, con parole tue","c":["un fatto certo"]}. In c metti solo fatti di cui sei sicuro, altrimenti lista vuota. Se non conosci la canzone, lascia s e a vuoti: non inventare.`}]})});
  if(r.status===401)throw Object.assign(new Error("Chiave Groq non valida"),{code:401});
  if(r.status===429)throw Object.assign(new Error("Troppe richieste, riprova tra un minuto"),{code:429});
  if(!r.ok)throw new Error("Groq "+r.status);
  const j=await r.json(),t=(j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||"";
  let o=null;try{o=JSON.parse(t)}catch(e){const m=t.match(/\{[\s\S]*\}/);if(m)try{o=JSON.parse(m[0])}catch(_){}}
  return o&&(o.s||o.a)?{s:String(o.s||""),a:String(o.a||""),c:Array.isArray(o.c)?o.c.filter(Boolean).slice(0,3).map(String):[],ai:1}:null;
}
async function songInfo(a,b){
  const k=a.id+"|"+a.brani.indexOf(b);loadingInfo.add(k);render();
  try{
    if(cfg("gk")){try{const o=await aiInfo(a,b);if(o){b.sig=o;save();return}}catch(e){if(e.code===401||e.code===429)toast(e.message)}}
    for(const lang of ["it","en"]){
      const r=await (await fetch(`https://${lang}.wikipedia.org/w/api.php?`+new URLSearchParams({action:"query",list:"search",srsearch:`${b.t} ${a.nome} ${lang==="it"?"canzone":"song"}`,srlimit:3,format:"json",origin:"*"}))).json();
      for(const h of (r.query&&r.query.search)||[]){
        if(!norm(h.title).includes(norm(b.t)))continue;
        const sr=await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(h.title.replace(/ /g,"_"))}`);if(!sr.ok)continue;
        const j=await sr.json();
        if(!j.extract||!norm(j.extract).includes(norm(a.nome)))continue;
        b.sig={s:cut(j.extract),src:(j.content_urls&&j.content_urls.desktop&&j.content_urls.desktop.page)||"",w:1};save();return;
      }
    }
    b.sig=0;save();
  }catch(e){}finally{loadingInfo.delete(k);render()}
}
function themeBar(){
  return `<div class="themes" role="tablist" aria-label="Temi">${TEMI.map(t=>`<button type="button" role="tab" data-tema="${t.id}" aria-selected="${tema===t.id}">${esc(t.n)}${pend(t.id).length?`<span>${pend(t.id).length}</span>`:""}</button>`).join("")}</div>`;
}
function renderDeck(){
  const T=TEMI.find(x=>x.id===tema)||TEMI[0],q=pend(tema),el=$("#view");
  let h=`<h1 class="pg">Scopri</h1>${themeBar()}<p class="sub">${esc(T.d)}</p>`;
  if(!q.length&&!busy&&!tried[tema]&&logged()&&(cfg("lfm")||tema==="pietre")){tried[tema]=1;setTimeout(()=>discover(false,tema),0)}
  if(!q.length){
    h+=`<div class="empty">${busy?`<span><i class="spin"></i>Cerco artisti per «${esc(T.n)}»…</span>`:`<span>Per ora non ho altri artisti da proporti.</span><button class="btn" type="button" data-discover>Cerca artisti</button>`}</div>`;
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
    <div class="songs">${vis(a).slice(0,3).map(({b,i})=>songRow(a,b,i)).join("")}</div><p class="tip">Swipe sulle canzoni: a destra la salvi, a sinistra la togli.</p></div></article></div>
    <div class="acts"><button class="big no" type="button" data-dno aria-label="Non mi piace ${esc(a.nome)}">${IC.x}</button><button class="big ok" type="button" data-dok aria-label="Mi piace ${esc(a.nome)}">${IC.ok}</button></div>
    <p class="count">${q.length} da valutare${busy?" · cerco altri simili…":""}</p>
    <p class="how">Swipe a destra se l'artista ti piace, a sinistra se no. Sulle canzoni: cuore per aggiungerle al tuo Sounder Mix, «i» per significato e curiosità.</p>`;
  el.innerHTML=h;
}
function decide(id,yes){
  const a=S.artists[id];if(!a)return;
  const prev={stato:a.stato,dec:a.dec};
  a.stato=yes?"aggiunto":"ignorato";a.dec=today();save();render();
  toast(yes?`${a.nome}: ti piace, cerco artisti simili`:`${a.nome}: non fa per te`,{l:"Annulla",f:()=>{a.stato=prev.stato;a.dec=prev.dec;save();render()}});
  if(pend(temaOf(a)).length<4)setTimeout(()=>discover(false,temaOf(a)),500);
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
    if(e.button!==0||e.target.closest("button,a,.song"))return;
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


/* ============ swipe sulle singole canzoni ============ */
function keepSong(id,i){
  const a=S.artists[id],b=a&&a.brani[i];if(!b)return;
  if(b.st==="ok"){toast("È già nel tuo Sounder Mix");render();return}
  setLike(a,b,true);
}
async function moreSongs(a){
  if(!logged())return;
  try{
    if(!a.spId){const x=await spArtist(a.nome);if(!x)return;a.spId=x.id;a.img=a.img||x.images?.[0]?.url||""}
    const have=new Set(a.brani.map(b=>norm(b.t)));
    const j=await api("/search?"+new URLSearchParams({q:`artist:"${a.nome}"`,type:"track",limit:10}));
    const fresh=(j.tracks?.items||[]).filter(t=>t.artists.some(x=>x.id===a.spId)&&!have.has(norm(t.name))).filter((t,k,arr)=>arr.findIndex(u=>norm(u.name)===norm(t.name))===k);
    const need=3-vis(a).length;if(need<=0)return;
    const add=fresh.slice(0,need).map(trk);
    if(!add.length){toast(`Per ora non trovo altre canzoni di ${a.nome}`);return}
    a.brani.push(...add);save();render();
  }catch(e){}
}
function knownSong(id,i){
  const a=S.artists[id],b=a&&a.brani[i];if(!b)return;
  const prev=b.st;b.st="no";b.known=1;save();render();mixDel(b);
  toast("Segnata come già conosciuta",{l:"Annulla",f:()=>{b.st=prev;delete b.known;save();render()}});
  moreSongs(a);
}
function dropSong(id,i){
  const a=S.artists[id],b=a&&a.brani[i];if(!b)return;
  const prev=b.st;b.st="no";save();render();mixDel(b);
  toast("Canzone tolta",{l:"Annulla",f:()=>{b.st=prev;save();render()}});
  moreSongs(a);
}
const songSwipe=(()=>{
  let s=null;const TH=70;
  document.addEventListener("pointerdown",e=>{
    if(e.button!==0||e.target.closest("button,a"))return;
    const el=e.target.closest(".song[data-aid]");if(!el)return;
    s={el,x:e.clientX,y:e.clientY,dx:0,lock:false,id:e.pointerId,w:el.offsetWidth};
  });
  document.addEventListener("pointermove",e=>{
    if(!s||e.pointerId!==s.id)return;
    const dx=e.clientX-s.x,dy=e.clientY-s.y;
    if(!s.lock){
      if(Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)){s=null;return}
      if(!(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.2))return;
      s.lock=true;s.x+=dx>0?10:-10;try{s.el.setPointerCapture(e.pointerId)}catch(_){}
      s.el.style.transition="none";
    }
    e.preventDefault();
    s.dx=e.clientX-s.x;
    s.el.style.transform=`translateX(${s.dx}px)`;
    s.el.style.setProperty("--p",Math.max(-1,Math.min(1,s.dx/TH)));
    s.el.dataset.dir=s.dx>0?"ok":"no";
  },{passive:false});
  function end(e){
    if(!s||e.pointerId!==s.id)return;
    const st=s;s=null;if(!st.lock)return;
    const kill=ev=>{ev.preventDefault();ev.stopPropagation()};
    document.addEventListener("click",kill,{capture:true,once:true});
    setTimeout(()=>document.removeEventListener("click",kill,true),400);
    const el=st.el,go=e.type==="pointerup"&&Math.abs(st.dx)>=TH,id=el.dataset.aid,i=Number(el.dataset.i);
    const back=()=>{el.style.transition="transform .4s cubic-bezier(.2,1.4,.4,1)";el.style.transform="";el.style.setProperty("--p",0);setTimeout(()=>{el.style.transition="";delete el.dataset.dir},420)};
    if(!go){back();return}
    if(st.dx>0){back();keepSong(id,i);return}
    const h=el.offsetHeight;
    el.style.transition="transform .25s ease-in,opacity .25s";el.style.transform=`translateX(-${st.w*1.1}px)`;el.style.opacity="0";
    setTimeout(()=>{el.style.overflow="hidden";el.style.height=h+"px";el.offsetHeight;el.style.transition="height .22s ease,padding .22s ease,margin .22s ease";el.style.height="0px";el.style.paddingTop=el.style.paddingBottom="0px";el.style.marginTop="-8px";setTimeout(()=>dropSong(id,i),220)},250);
  }
  addEventListener("pointerup",end);addEventListener("pointercancel",end);
})();

/* ============ Sounder Mix ============ */
const okList=a=>a.brani.filter(b=>b.st==="ok");
function setLike(a,b,on){
  const prev=b.st;b.st=on?"ok":undefined;save();render();
  toast(on?"Aggiunta al tuo Sounder Mix":"Tolta dal Sounder Mix",{l:"Annulla",f:()=>{b.st=prev;save();render();syncOne(a,b)}});
  syncOne(a,b);
}
function heart(id,i){const a=S.artists[id],b=a&&a.brani[i];if(b)setLike(a,b,b.st!=="ok")}
/* cosa ha imparato l'app dai tuoi gusti: parole dei generi degli artisti */
const words=a=>String(a.genere||"").toLowerCase().split(/[^a-zàèéìòù]+/).filter(w=>w.length>3&&!["with","from","pop"].includes(w));
function tasteVec(){
  const pos={},neg={};
  A().forEach(a=>{
    const ok=okList(a).length,no=a.brani.filter(b=>b.st==="no"&&!b.known).length+(a.stato==="ignorato"?2:0);
    words(a).forEach(w=>{if(ok)pos[w]=(pos[w]||0)+ok;if(no)neg[w]=(neg[w]||0)+no});
  });
  return {pos,neg};
}
const topN=(o,n)=>Object.entries(o).sort((x,y)=>y[1]-x[1]).slice(0,n).map(x=>x[0]);
function renderFav(){
  const L=A().filter(a=>a.stato==="aggiunto"||okList(a).length).sort((x,y)=>okList(y).length-okList(x).length||String(y.dec).localeCompare(String(x.dec)));
  const total=A().reduce((n,a)=>n+okList(a).length,0),has=S.playlistId,t=tasteVec();
  const more=topN(t.pos,6),less=topN(Object.fromEntries(Object.entries(t.neg).filter(([w,n])=>n>(t.pos[w]||0))),4);
  let h=`<h1 class="pg">Sounder Mix</h1><p class="sub">La tua raccolta di canzoni che ti hanno acceso qualcosa. Più ne aggiungi, meglio Sounder ti conosce.</p>`;
  h+=`<div class="card" style="margin-bottom:16px"><h3>${total} canzon${total===1?"e":"i"} · ${L.length} artist${L.length===1?"a":"i"}</h3>${more.length?`<div class="sim"><span class="l">Ti ispira</span>${more.map(w=>`<span class="chip">${esc(w)}</span>`).join("")}</div>`:`<small>Tocca il cuore sulle canzoni che ti ispirano.</small>`}${less.length?`<div class="sim"><span class="l">Meno</span>${less.map(w=>`<span class="chip">${esc(w)}</span>`).join("")}</div>`:""}</div>`;
  const miss=A().flatMap(x=>okList(x)).filter(b=>!b.uri||!(S.exp||[]).includes(b.uri)).length;
  h+=`<div class="bar"><p>${has?`La playlist «Sounder Mix» è su Spotify: ${S.playlistN} brani. Ogni canzone che aggiungi o togli qui si aggiorna da sola; non si azzera mai. <a class="open" href="https://open.spotify.com/playlist/${esc(S.playlistId)}" target="_blank" rel="noopener">Apri</a>`:"Vuoi anche una playlist su Spotify? Creala una volta sola: da lì in poi le canzoni nuove si aggiungono da sole."}</p><button class="btn ghostb" type="button" data-playlist${busy||!total?" disabled":""}>${has?(miss?`Aggiungi ${miss} mancanti`:"Tutto allineato"):"Crea la playlist"}</button></div>`;
  if(!L.length)h+=`<div class="empty">Il tuo Sounder Mix è ancora vuoto: in Scopri tocca il cuore sulle canzoni che ti ispirano.</div>`;
  h+=L.map(a=>{const n=okList(a).length,open=openArtist===a.id;return `<div class="arow"><button class="ahead" type="button" data-open="${esc(a.id)}" aria-expanded="${open}"><span class="av"${a.img?` style="background-image:url('${esc(a.img)}')"`:` style="background:hsl(${hue(a.nome)} 55% 35%)"`}>${a.img?"":esc(initials(a.nome))}</span><span class="tx"><b>${esc(a.nome)}</b><i>${n?`${n} canzon${n===1?"e":"i"} nel Mix`:esc(a.genere||"")}</i></span></button>${open?`<div class="abody">${a.info?`<p class="about">${esc(a.info)}</p>`:""}<div class="songs">${vis(a).map(({b,i})=>songRow(a,b,i)).join("")}</div><div class="mini"><button class="btn" type="button" data-playall="${esc(a.id)}">${IC.play}Ascolta tutto</button><button class="btn ghostb" type="button" data-remove="${esc(a.id)}">Togli dal Mix</button></div></div>`:""}</div>`}).join("");
  $("#view").innerHTML=h;
  L.filter(a=>openArtist===a.id).forEach(enrich);
}
async function mixAdd(a,b){
  if(!S.playlistId||!logged())return;
  try{
    if(!b.uri)await spResolve(a,b);
    if(!b.uri||(S.exp||[]).includes(b.uri))return;
    await api(`/playlists/${S.playlistId}/items`,{method:"POST",body:{uris:[b.uri]}});
    S.exp=[...(S.exp||[]),b.uri];S.playlistN=(S.playlistN||0)+1;save();render();
  }catch(e){if(e.code===404){S.playlistId="";S.exp=[];save()}}
}
async function mixDel(b){
  if(!S.playlistId||!b.uri||!(S.exp||[]).includes(b.uri))return;
  try{
    await api(`/playlists/${S.playlistId}/items`,{method:"DELETE",body:{items:[{uri:b.uri}]}});
    S.exp=S.exp.filter(x=>x!==b.uri);S.playlistN=Math.max(0,(S.playlistN||1)-1);save();render();
  }catch(e){}
}
function syncOne(a,b){if(b.st==="ok")mixAdd(a,b);else mixDel(b)}
async function makePlaylist(){
  if(busy)return;
  const songs=A().flatMap(a=>okList(a).map(b=>({a,b})));
  if(!songs.length){toast("Aggiungi prima qualche canzone al Sounder Mix");return}
  busy=true;render();
  try{
    let fresh=false;
    if(!S.playlistId){const p=await api("/me/playlists",{method:"POST",body:{name:"Sounder Mix",description:"Le canzoni che mi hanno acceso qualcosa, da Sounder",public:false}});S.playlistId=p.id;S.exp=[];S.playlistN=0;fresh=true}
    for(const {a,b} of songs)if(!b.uri)try{await spResolve(a,b)}catch(e){}
    const todo=[...new Set(songs.map(x=>x.b.uri).filter(u=>u&&!(S.exp||[]).includes(u)))];
    for(let i=0;i<todo.length;i+=50){const part=todo.slice(i,i+50);await api(`/playlists/${S.playlistId}/items`,{method:"POST",body:{uris:part}});S.exp=[...(S.exp||[]),...part];S.playlistN=(S.playlistN||0)+part.length}
    S.playlistDate=today();save();
    toast(fresh?`Playlist «Sounder Mix» creata con ${todo.length} brani`:todo.length?`Aggiunte ${todo.length} canzoni`:"Era già tutto allineato");
  }catch(e){
    if(e.code===404&&S.playlistId){S.playlistId="";S.exp=[];save()}
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
  const list=all?vis(a).map(x=>x.b):a.brani.slice(i).filter(b=>b.st!=="no");
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
  <div class="card"><h3>4. Significato delle canzoni ${cfg("gk")?'<span class="ok-t">attivo</span>':"(gratis)"}</h3><small>Per avere significato, spiegazione e curiosità di ogni canzone serve una chiave gratuita di Groq: vai su <b>console.groq.com</b>, accedi con Google o GitHub, apri «API Keys» e premi «Create API Key». Non chiede carta di credito. Senza chiave, Sounder usa Wikipedia dove trova la voce della canzone.</small>
    <label>Chiave Groq<input id="gk" type="password" value="${esc(cfg("gk"))}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="gsk_…"></label>
    <div class="mini"><button class="btn" type="button" data-savegk>Salva</button>${cfg("gk")?`<button class="btn ghostb" type="button" data-nogk>Togli</button>`:""}</div></div>
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
  if(T("[data-discover]")){discover(true,tema);return}
  if((x=T("[data-tema]"))){tema=x.dataset.tema;cfg("tema",tema);view="scopri";centerTheme=true;render();return}
  if((x=T("[data-dok],[data-dno]"))){const el=$(".dcard");if(el&&!el.dataset.busy){el.dataset.busy=1;const y=x.hasAttribute("data-dok");flyOut(el,y?1:-1,()=>decide(el.dataset.aid,y))}return}
  if((x=T("[data-play]"))){playFrom(x.dataset.play,Number(x.dataset.i),false);return}
  if((x=T("[data-playall]"))){playFrom(x.dataset.playall,0,true);return}
  if((x=T("[data-info]"))){const k=x.dataset.info,[id,ix]=k.split("|"),a=S.artists[id],b=a&&a.brani[Number(ix)];if(openInfo.has(k))openInfo.delete(k);else{openInfo.add(k);if(b&&!sigOf(b)&&b.sig!==0)songInfo(a,b)}render();return}
  if((x=T("[data-known]"))){knownSong(x.dataset.known,Number(x.dataset.i));return}
  if((x=T("[data-heart]"))){heart(x.dataset.heart,Number(x.dataset.i));return}
  if((x=T("[data-open]"))){openArtist=openArtist===x.dataset.open?null:x.dataset.open;render();return}
  if((x=T("[data-remove]"))){const a=S.artists[x.dataset.remove];if(a){a.brani.forEach(b=>{if(b.st==="ok"){delete b.st;mixDel(b)}});a.stato="nuovo";a.dec="";a.ord=A().reduce((m,y)=>Math.max(m,y.ord||0),0)+1;save();openArtist=null;render();toast(`${a.nome} è tornato in Scopri`)}return}
  if(T("[data-playlist]")){makePlaylist();return}
  if(T("[data-pp]")){toggle();return}
  if(T("[data-next]")){nextTrack();return}
  if(T("[data-savecfg]")){cfg("cid",$("#cid").value.trim());if(!cfg("cid")){toast("Incolla il Client ID");return}if(logged()){toast("Salvato");render()}else login();return}
  if(T("[data-savelfm]")){cfg("lfm",$("#lfm").value.trim());toast("Chiave salvata");view="scopri";render();return}
  if(T("[data-savegh]")){cfg("gh",$("#gh").value.trim());cfg("gist","");if(!gh()){toast("Incolla il token");return}syncMsg="Sincronizzo…";render();pull().then(()=>{render();toast(syncMsg)});return}
  if(T("[data-savegk]")){cfg("gk",$("#gk").value.trim());render();toast(cfg("gk")?"Chiave salvata":"Chiave tolta");return}
  if(T("[data-nogk]")){cfg("gk","");render();toast("Chiave tolta");return}
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
  if(logged()){initSdk();refreshNow();startPoll()}
  pull();
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)pull()});
  if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
