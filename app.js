(function(){
const MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const MCOURT=['janv','févr','mars','avr','mai','juin','juil','août','sept','oct','nov','déc'];
const FREQ={mensuel:['Tous les mois',1],bimestriel:['Tous les 2 mois',2],trimestriel:['Tous les trimestres',3],semestriel:['Tous les 6 mois',6],annuel:['Une fois par an',12]};
const eur=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'});
const E=v=>eur.format(v);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,10);
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const parse=s=>{const[y,m,d]=String(s).split('-').map(Number);return new Date(y,(m||1)-1,d||1)};
const dim=(y,m)=>new Date(y,m+1,0).getDate();
const num=v=>{const n=parseFloat(String(v).replace(/[\s €]/g,'').replace(',','.'));return isNaN(n)?0:Math.round(n*100)/100};
const dd=(d,m)=>String(d).padStart(2,'0')+'/'+String(m+1).padStart(2,'0');

function examples(){
  const t=new Date(),y=t.getFullYear(),m=t.getMonth();
  const at=(dm,d)=>iso(new Date(y,m+dm,d));
  return {v:1,exemple:true,solde:2350,soldeDate:iso(t),over:{},
    recettes:[
      {id:uid(),lib:'Retraite de base',montant:1450,jour:9,freq:'mensuel',debut:1},
      {id:uid(),lib:'Retraite complémentaire',montant:620,jour:1,freq:'mensuel',debut:1}],
    fixes:[
      {id:uid(),lib:'Assurance auto',montant:48.5,jour:5,freq:'mensuel',debut:1},
      {id:uid(),lib:'Mutuelle santé',montant:112,jour:8,freq:'mensuel',debut:1},
      {id:uid(),lib:'Téléphone et internet',montant:39.99,jour:12,freq:'mensuel',debut:1},
      {id:uid(),lib:'Électricité',montant:95,jour:15,freq:'mensuel',debut:1},
      {id:uid(),lib:'Assurance habitation',montant:210,jour:10,freq:'trimestriel',debut:1}],
    ponct:[
      {id:uid(),lib:'Fioul chauffage',montant:1100,date:iso(new Date(y,m,t.getDate()+8))},
      {id:uid(),lib:'Virement depuis le livret',montant:600,sens:'entree',date:iso(new Date(y,m,t.getDate()+7))},
      {id:uid(),lib:'Don association',montant:150,date:at(1,10)},
      {id:uid(),lib:'Cotisation annuelle club',montant:60,date:at(3,1)},
      {id:uid(),lib:'Taxe foncière',montant:980,date:iso(new Date(y+(m>=9?1:0),9,15))}],
    cartes:[
      {id:uid(),nom:'Carte bleue 1',jour:20,estim:450},
      {id:uid(),nom:'Carte bleue 2',jour:30,estim:300}],cest:{}};
}
function blank(){return {v:1,exemple:false,solde:0,soldeDate:iso(new Date()),over:{},cest:{},recettes:[],fixes:[],ponct:[],cartes:[]}}

let S=null,tab='mois';
try{tab=localStorage.getItem('fdm_tab')||'mois'}catch(e){}
try{const raw=localStorage.getItem('fdm_state');if(raw)S=JSON.parse(raw)}catch(e){}
if(!S)S=examples();

/* ---------- calcul ---------- */
const sd=()=>parse(S.soldeDate||iso(new Date()));
function matchFreq(it,m){const st=(FREQ[it.freq]||FREQ.mensuel)[1];return (((m+1)-(it.debut||1))%st+st)%st===0}
const cKey=(c,y,m)=>c.id+':'+y+'-'+m;
function cardAmt(c,y,m){const v=(S.cest||{})[cKey(c,y,m)];return v===undefined?[+c.estim||0,true]:[v,false]}
function occ(y,m){
  const out=[],nd=dim(y,m);
  for(const r of S.recettes) if(matchFreq(r,m)) out.push({key:'r:'+r.id+':'+y+'-'+m,kind:'Recette',lib:r.lib,amt:+r.montant,day:Math.min(r.jour,nd),ref:['recettes',r.id]});
  for(const f of S.fixes) if(matchFreq(f,m)) out.push({key:'f:'+f.id+':'+y+'-'+m,kind:'Prélèvement',lib:f.lib,amt:-f.montant,day:Math.min(f.jour,nd),ref:['fixes',f.id]});
  for(const p of S.ponct){const d=parse(p.date);if(d.getFullYear()===y&&d.getMonth()===m) out.push({key:'p:'+p.id,kind:p.sens==='entree'?'Entrée ponctuelle':'Dépense ponctuelle',lib:p.lib,amt:p.sens==='entree'?+p.montant:-p.montant,day:d.getDate(),ref:['ponct',p.id]})}
  for(const c of S.cartes){const [a,hab]=cardAmt(c,y,m);out.push({key:'c:'+c.id+':'+y+'-'+m,kind:'Débit carte différé',lib:c.nom,amt:-a,day:Math.min(c.jour,nd),ref:['cartes',c.id],est:hab})}
  return out;
}
function isPassed(o,y,m){
  const s=sd();if(y*12+m<s.getFullYear()*12+s.getMonth())return true;
  if(y!==s.getFullYear()||m!==s.getMonth())return false;
  const ov=S.over[o.key];if(ov==='passe')return true;if(ov==='avenir')return false;
  return o.day<=s.getDate();
}
function simulate(y,m,start){
  const all=occ(y,m).map(o=>({...o,passed:isPassed(o,y,m)}));
  const up=all.filter(o=>!o.passed).sort((a,b)=>a.day-b.day||a.amt-b.amt);
  let bal=start,min=start,minDay=null,inc=0,out=0;
  for(const o of up){bal+=o.amt;o.after=bal;if(o.amt>0)inc+=o.amt;else out-=o.amt;if(bal<min){min=bal;minDay=o.day}}
  return {all,up,done:all.filter(o=>o.passed).sort((a,b)=>a.day-b.day),end:bal,min,minDay,inc,out};
}
function year(){
  const s=sd();let y=s.getFullYear(),m=s.getMonth(),bal=+S.solde||0;const res=[];
  for(let i=0;i<12;i++){const r=simulate(y,m,bal);res.push({y,m,start:bal,...r});bal=r.end;m++;if(m>11){m=0;y++}}
  return res;
}

/* ---------- sauvegarde ---------- */
function save(){
  try{localStorage.setItem('fdm_state',JSON.stringify(S))}catch(e){}
}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>t.hidden=true,2400)}

/* ---------- rendu ---------- */
const ICON={
 mois:'<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
 fixes:'<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>',
 ponct:'<svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18"/></svg>',
 cartes:'<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/></svg>',
 annee:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>'};
const TABS=[['mois','Ce mois'],['fixes','Fixes'],['ponct','Ponctuelles'],['cartes','Cartes'],['annee','12 mois']];
function renderTabs(){document.getElementById('tabs').innerHTML=TABS.map(([k,l])=>`<button data-tab="${k}" aria-current="${k===tab}">${ICON[k]}${l}</button>`).join('')}

function rowHTML(o,y,m,opts={}){
  const tg=opts.toggle?`<button class="tog" data-tog="${o.key}">${o.passed?'Remettre à venir':'Déjà passé'}</button>`:'';
  return `<div class="row ${o.passed?'done':''}"><div class="d num">${dd(o.day,m)}</div>
  <div class="t"><b>${esc(o.lib)}</b><span>${o.kind}${o.est?' · estimation':''}</span></div>
  <div class="a num"><div class="${o.amt<0?'neg':'pos'}">${o.amt>0?'+':''}${E(o.amt)}</div>${o.after!==undefined&&!o.passed?`<span>reste ${E(o.after)}</span>`:''}${tg}</div></div>`;
}

function curve(r,s){
  const y=s.getFullYear(),m=s.getMonth(),nd=dim(y,m),d0=s.getDate();
  const pts=[];let bal=+S.solde||0;
  for(let d=d0;d<=nd;d++){for(const o of r.up)if(o.day===d)bal+=o.amt;pts.push([d,bal])}
  if(pts.length<2)return '';
  const W=340,H=150,L=8,R=8,T=18,B=22;
  const vs=pts.map(p=>p[1]).concat([0]);let lo=Math.min(...vs),hi=Math.max(...vs);if(hi===lo)hi=lo+1;
  const pad=(hi-lo)*.08;lo-=pad;hi+=pad;
  const X=d=>L+(d-d0)/(nd-d0||1)*(W-L-R),Yv=v=>T+(hi-v)/(hi-lo)*(H-T-B);
  let path=`M${X(pts[0][0])},${Yv(pts[0][1])}`;
  for(let i=1;i<pts.length;i++)path+=` H${X(pts[i][0])} V${Yv(pts[i][1])}`;
  const area=path+` V${Yv(lo)} H${X(pts[0][0])} Z`;
  const mn=pts.reduce((a,b)=>b[1]<a[1]?b:a);
  const mx=X(mn[0]),my=Yv(mn[1]);const anchor=mx>W*0.7?'end':mx<W*0.3?'start':'middle';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du solde jusqu'à la fin du mois">
   <path d="${area}" fill="var(--accent-soft)" stroke="none"/>
   ${lo<0?`<line x1="${L}" x2="${W-R}" y1="${Yv(0)}" y2="${Yv(0)}" stroke="var(--neg)" stroke-dasharray="4 4" stroke-width="1"/>`:''}
   <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2"/>
   <circle cx="${mx}" cy="${my}" r="4" fill="${mn[1]<0?'var(--neg)':'var(--accent)'}"/>
   <text x="${mx}" y="${Math.max(12,my-8)}" text-anchor="${anchor}" style="font-weight:700;fill:${mn[1]<0?'var(--neg)':'var(--fg)'}">${E(mn[1])}</text>
   <text x="${L}" y="${H-5}">${dd(d0,m)}</text><text x="${W-R}" y="${H-5}" text-anchor="end">${dd(nd,m)}</text></svg>`;
}

function vMois(){
  const s=sd(),y=s.getFullYear(),m=s.getMonth(),r=simulate(y,m,+S.solde||0),nd=dim(y,m);
  const bad=r.min<0;
  return `${S.exemple?`<div class="banner"><div><b>Ce sont des montants d'exemple.</b> Remplace-les par les tiens dans chaque onglet, ou repars d'une page vide.</div><div class="acts"><button class="btn small" data-act="keep">Masquer ce message</button><button class="btn small danger" data-act="wipe">Tout vider</button></div></div>`:''}
  <div class="top"><h1>${MOIS[m][0].toUpperCase()+MOIS[m].slice(1)} ${y}</h1><small>${r.up.length} opération${r.up.length>1?'s':''} à venir</small></div>
  <div class="hero ${r.end<0?'bad':''}"><div class="lbl">Solde estimé au ${nd} ${MOIS[m]}</div><div class="big num">${E(r.end)}</div>
   <div class="sub num"><span class="p">+${E(r.inc)} à recevoir</span><span class="n">−${E(r.out)} à payer</span></div>
   ${r.minDay?`<div><span class="chip num">${bad?'⚠ ':''}Point bas ${E(r.min)} le ${dd(r.minDay,m)}</span></div>`:''}</div>
  <div class="card"><h2>Mon compte courant</h2><div class="fields">
   <label class="f">Solde lu sur la banque<input id="in-solde" class="num" inputmode="decimal" value="${String(S.solde).replace('.',',')}"></label>
   <label class="f">À la date du<input id="in-date" type="date" value="${S.soldeDate}"></label></div>
   ${S.soldeDate!==iso(new Date())?`<button class="btn small ghost" data-act="today" style="align-self:flex-start">Mettre la date d'aujourd'hui</button>`:''}</div>
  ${S.cartes.length?`<div class="card"><div class="sechead"><h2>Débits cartes de ${MOIS[m]}</h2><span class="muted" style="font-size:.85rem">montant estimé</span></div><div class="fields">
   ${S.cartes.map(c=>{const day=Math.min(c.jour,nd),[a]=cardAmt(c,y,m),pas=isPassed({key:'c:'+c.id+':'+y+'-'+m,day},y,m);return `<label class="f">${esc(c.nom)} · ${pas?'débitée le':'débit le'} ${dd(day,m)}<input class="num" inputmode="decimal" data-cest="${c.id}" value="${String(a).replace('.',',')}" ${pas?'disabled':''}></label>`}).join('')}</div></div>`:''}
  <div class="card"><h2>Jusqu'à la fin du mois</h2>${curve(r,s)||'<div class="empty">Plus aucun jour à afficher ce mois-ci.</div>'}</div>
  <div class="card"><h2>À venir ce mois</h2><div class="list">${r.up.length?r.up.map(o=>rowHTML(o,y,m,{toggle:true})).join(''):'<div class="empty">Rien d\'autre ne doit passer ce mois-ci.</div>'}</div>
  ${r.done.length?`<details><summary>Déjà dans le solde (${r.done.length})</summary><div class="list">${r.done.map(o=>rowHTML(o,y,m,{toggle:true})).join('')}</div></details>`:''}</div>`;
}

function listItems(arr,kind){
  if(!arr.length)return '<div class="empty">Aucune ligne pour l\'instant.</div>';
  return `<div class="list">${[...arr].sort((a,b)=>a.jour-b.jour).map(it=>`<button class="row" data-edit="${kind}" data-id="${it.id}"><div class="d num">le ${it.jour}</div><div class="t"><b>${esc(it.lib)}</b><span>${FREQ[it.freq][0]}${it.freq!=='mensuel'?' · à partir de '+MOIS[(it.debut||1)-1]:''}</span></div><div class="a num ${kind==='recettes'?'pos':'neg'}">${kind==='recettes'?'+':'−'}${E(it.montant)}</div></button>`).join('')}</div>`;
}
const monthly=arr=>arr.reduce((s,i)=>s+i.montant/FREQ[i.freq][1],0);
function vFixes(){
  return `<div class="top"><h1>Revenus et prélèvements</h1></div>
  <div class="card"><div class="sechead"><div><h2>Recettes</h2><span class="muted num" style="font-size:.85rem">≈ ${E(monthly(S.recettes))} par mois</span></div><button class="btn small" data-add="recettes">Ajouter</button></div>${listItems(S.recettes,'recettes')}</div>
  <div class="card"><div class="sechead"><div><h2>Prélèvements</h2><span class="muted num" style="font-size:.85rem">≈ ${E(monthly(S.fixes))} par mois</span></div><button class="btn small" data-add="fixes">Ajouter</button></div>${listItems(S.fixes,'fixes')}</div>
  <p class="muted" style="font-size:.9rem;margin:0">Une assurance payée au trimestre ou un abonnement annuel se règle ici avec la bonne fréquence : saisi une fois, il revient tout seul.</p>`;
}
function vPonct(){
  const s=sd(),start=new Date(s.getFullYear(),s.getMonth(),1);
  const all=[...S.ponct].sort((a,b)=>a.date<b.date?-1:1);
  const fut=all.filter(p=>parse(p.date)>=start),past=all.filter(p=>parse(p.date)<start);
  const row=p=>{const d=parse(p.date);return `<button class="row" data-edit="ponct" data-id="${p.id}"><div class="d num">${dd(d.getDate(),d.getMonth())}<br><span style="font-weight:500">${d.getFullYear()}</span></div><div class="t"><b>${esc(p.lib)}</b><span>${MOIS[d.getMonth()]} ${d.getFullYear()}</span></div><div class="a num ${p.sens==='entree'?'pos':'neg'}">${p.sens==='entree'?'+':'−'}${E(p.montant)}</div></button>`};
  return `<div class="top"><h1>Opérations ponctuelles</h1></div>
  <div class="card"><div class="sechead"><h2>À prévoir</h2><button class="btn small" data-add="ponct">Ajouter</button></div>
  ${fut.length?`<div class="list">${fut.map(row).join('')}</div>`:'<div class="empty">Aucune opération prévue.</div>'}
  ${past.length?`<details><summary>Mois passés (${past.length})</summary><div class="list">${past.map(row).join('')}</div></details>`:''}</div>
  <p class="muted" style="font-size:.9rem;margin:0">Dépenses (fioul, taxe foncière, dons, cotisations…) ou entrées exceptionnelles (virement d'un autre compte, remboursement, prime…). Mets la date prévue : l'opération apparaît dans le bon mois. Les retraites et autres revenus réguliers se saisissent dans l'onglet Fixes.</p>`;
}
function vCartes(){
  return `<div class="top"><h1>Cartes à débit différé</h1></div>
  <div class="card"><div class="sechead"><h2>Mes cartes</h2><button class="btn small" data-add="cartes">Ajouter</button></div>
  ${S.cartes.length?`<div class="list">${S.cartes.map(c=>`<button class="row" data-edit="cartes" data-id="${c.id}"><div class="d num">le ${c.jour}</div><div class="t"><b>${esc(c.nom)}</b><span>débit unique le ${c.jour} de chaque mois</span></div><div class="a num neg">−${E(c.estim)}<span>habituel</span></div></button>`).join('')}</div>`:'<div class="empty">Aucune carte.</div>'}</div>
  <p class="muted" style="font-size:.9rem;margin:0">Chaque carte est débitée en une seule fois à son jour. Pour le mois en cours, tu ajustes le montant estimé dans l'onglet « Ce mois ». Le montant habituel sert pour les mois suivants.</p>
  <div class="card"><h2>Sauvegarde</h2><p class="muted" style="margin:0;font-size:.92rem">Tes données restent uniquement sur ce téléphone, dans l'appli. Garde de temps en temps une copie texte dans une note : elle sert à tout restaurer ou à passer sur un autre appareil.</p>
  <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn small ghost" data-act="export">Copier la sauvegarde</button><button class="btn small ghost" data-act="import">Restaurer</button><button class="btn small danger" data-act="wipe">Tout vider</button></div>
  <div id="io"></div></div><div class="ver">Fin de Mois · version ${window.APP_VERSION||''}</div>`;
}
function bars(rows){
  const W=340,H=170,L=6,R=6,T=16,B=22,n=rows.length,bw=(W-L-R)/n;
  const vs=rows.map(r=>r.end).concat(rows.map(r=>r.min),[0]);let lo=Math.min(...vs),hi=Math.max(...vs);if(hi===lo)hi=lo+1;
  const Y=v=>T+(hi-v)/(hi-lo)*(H-T-B),z=Y(0);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Solde estimé en fin de chaque mois">
  ${rows.map((r,i)=>{const x=L+i*bw+bw*.18,w=bw*.64,yv=Y(r.end);return `<rect x="${x}" y="${Math.min(yv,z)}" width="${w}" height="${Math.max(1,Math.abs(z-yv))}" rx="2" fill="${r.end<0?'var(--neg)':'var(--accent)'}"/>${r.min<0&&r.end>=0?`<circle cx="${x+w/2}" cy="${Y(r.min)}" r="3" fill="var(--neg)"/>`:''}<text x="${x+w/2}" y="${H-6}" text-anchor="middle">${MCOURT[r.m]}</text>`}).join('')}
  <line x1="${L}" x2="${W-R}" y1="${z}" y2="${z}" stroke="var(--muted)" stroke-width="1"/></svg>`;
}
let openMonth=null;
function vAnnee(){
  const rows=year(),low=rows.reduce((a,b)=>b.min<a.min?b:a);
  return `<div class="top"><h1>Les 12 prochains mois</h1></div>
  <div class="card"><div class="sechead"><h2>Solde en fin de mois</h2></div>${bars(rows)}
  <div class="muted" style="font-size:.88rem">Mois le plus tendu : <b class="${low.min<0?'neg':''}">${MOIS[low.m]} ${low.y}</b>, point bas ${E(low.min)}${low.minDay?' le '+dd(low.minDay,low.m):''}.</div></div>
  <div class="card" style="padding-inline:10px"><div style="overflow-x:auto"><table class="tbl num"><thead><tr><th>Mois</th><th>Entrées</th><th>Sorties</th><th>Fin de mois</th></tr></thead><tbody>
  ${rows.map((r,i)=>`<tr class="m" data-month="${i}"><td><b>${MCOURT[r.m]}</b> ${String(r.y).slice(2)} ${openMonth===i?'▴':'▾'}</td><td class="pos">+${E(r.inc)}</td><td class="neg">−${E(r.out)}</td><td class="${r.end<0?'neg':''}"><b>${E(r.end)}</b></td></tr>
  ${openMonth===i?`<tr class="det"><td colspan="4">${r.up.length?r.up.map(o=>`${dd(o.day,r.m)} · ${esc(o.lib)} <span class="${o.amt<0?'neg':'pos'}">${E(o.amt)}</span>${o.est?' (estim.)':''}`).join('<br>'):'Rien de prévu.'}</td></tr>`:''}`).join('')}
  </tbody></table></div></div>
  <p class="muted" style="font-size:.9rem;margin:0">Le mois en cours part de ton solde réel ; les suivants enchaînent sur l'estimation précédente, avec le montant habituel des cartes.</p>`;
}
function render(){
  renderTabs();
  const v={mois:vMois,fixes:vFixes,ponct:vPonct,cartes:vCartes,annee:vAnnee}[tab]||vMois;
  document.getElementById('app').innerHTML=v();
}

/* ---------- formulaire ---------- */
let sheetCtx=null,confirmDel=false;
function openSheet(kind,id){
  const arr=S[kind],it=id?arr.find(x=>x.id===id):null;sheetCtx={kind,id};confirmDel=false;
  const t={recettes:'Recette',fixes:'Prélèvement',ponct:'Opération ponctuelle',cartes:'Carte'}[kind];
  const val=(k,d='')=>it?esc(String(it[k]).replace(/^(\d+)\.(\d+)$/,'$1,$2')):d;
  let f='';
  if(kind==='cartes'){
    f=`<label class="f">Nom<input id="s-lib" value="${val('nom','')}"></label><div class="fields">
     <label class="f">Jour du débit<input id="s-jour" inputmode="numeric" value="${val('jour','20')}"></label>
     <label class="f">Débit habituel (€)<input id="s-est" inputmode="decimal" value="${val('estim','0')}"></label></div>`;
  }else if(kind==='ponct'){
    const sens=it?(it.sens||'sortie'):'sortie';
    f=`<label class="f">Type<select id="s-sens"><option value="sortie" ${sens==='sortie'?'selected':''}>Dépense (sort du compte)</option><option value="entree" ${sens==='entree'?'selected':''}>Entrée (virement, remboursement…)</option></select></label>
     <label class="f">Libellé<input id="s-lib" value="${val('lib','')}"></label><div class="fields">
     <label class="f">Montant (€)<input id="s-mt" inputmode="decimal" value="${val('montant','')}"></label>
     <label class="f">Date prévue<input id="s-date" type="date" value="${it?it.date:iso(new Date())}"></label></div>`;
  }else{
    const fq=it?it.freq:'mensuel',db0=it?it.debut||1:sd().getMonth()+1;
    f=`<label class="f">Libellé<input id="s-lib" value="${val('lib','')}"></label><div class="fields">
     <label class="f">Montant (€)<input id="s-mt" inputmode="decimal" value="${val('montant','')}"></label>
     <label class="f">Jour du mois<input id="s-jour" inputmode="numeric" value="${val('jour','5')}"></label>
     <label class="f">Fréquence<select id="s-freq">${Object.entries(FREQ).map(([k,[l]])=>`<option value="${k}" ${k===fq?'selected':''}>${l}</option>`).join('')}</select></label>
     <label class="f" id="s-debw" ${fq==='mensuel'?'hidden':''}>Premier mois<select id="s-deb">${MOIS.map((n,i)=>`<option value="${i+1}" ${i+1===db0?'selected':''}>${n}</option>`).join('')}</select></label></div>`;
  }
  document.getElementById('sheet').innerHTML=`<div class="sheet-bg" data-close="1"><div class="sheet" role="dialog" aria-label="${t}"><h2>${it?'Modifier':'Nouvelle ligne'} · ${t}</h2>${f}
   <div class="acts">${it?'<button class="btn danger" id="s-del">Supprimer</button>':''}<button class="btn ghost" data-close="1">Annuler</button><button class="btn" id="s-ok">Enregistrer</button></div></div></div>`;
  const fr=document.getElementById('s-freq');if(fr)fr.onchange=()=>document.getElementById('s-debw').hidden=fr.value==='mensuel';
  setTimeout(()=>{const l=document.getElementById('s-lib');if(l&&!it)l.focus()},50);
}
function closeSheet(){document.getElementById('sheet').innerHTML='';sheetCtx=null}
function sheetSave(){
  const {kind,id}=sheetCtx,g=i=>document.getElementById(i);
  const lib=g('s-lib').value.trim()||'Sans nom';let o;
  const jour=Math.min(31,Math.max(1,parseInt(g('s-jour')?.value)||1));
  if(kind==='cartes')o={nom:lib,jour,estim:num(g('s-est').value)};
  else if(kind==='ponct')o={lib,sens:g('s-sens').value,montant:Math.abs(num(g('s-mt').value)),date:g('s-date').value||iso(new Date())};
  else o={lib,montant:Math.abs(num(g('s-mt').value)),jour,freq:g('s-freq').value,debut:+g('s-deb').value||1};
  if(id)Object.assign(S[kind].find(x=>x.id===id),o);else S[kind].push({id:uid(),...o});
  save();closeSheet();render();toast('Enregistré');
}

/* ---------- événements ---------- */
document.addEventListener('click',e=>{
  const b=e.target.closest('button,[data-close],tr.m');if(!b)return;
  if(b.dataset.close&&e.target===b){closeSheet();return}
  if(b.dataset.tab){tab=b.dataset.tab;try{localStorage.setItem('fdm_tab',tab)}catch(x){}render();scrollTo(0,0);return}
  if(b.dataset.add){openSheet(b.dataset.add);return}
  if(b.dataset.edit){openSheet(b.dataset.edit,b.dataset.id);return}
  if(b.dataset.month!==undefined){const i=+b.dataset.month;openMonth=openMonth===i?null:i;render();return}
  if(b.dataset.tog){const s=sd(),k=b.dataset.tog;const o=occ(s.getFullYear(),s.getMonth()).find(x=>x.key===k);const now=isPassed(o,s.getFullYear(),s.getMonth());
    const auto=o.day<=s.getDate();const want=!now;S.over[k]=(want===auto)?undefined:(want?'passe':'avenir');if(S.over[k]===undefined)delete S.over[k];save();render();return}
  if(b.id==='s-ok'){sheetSave();return}
  if(b.id==='s-del'){if(!confirmDel){confirmDel=true;b.textContent='Confirmer la suppression';return}
    const {kind,id}=sheetCtx;S[kind]=S[kind].filter(x=>x.id!==id);save();closeSheet();render();toast('Supprimé');return}
  const a=b.dataset.act;
  if(a==='keep'){S.exemple=false;save();render()}
  if(a==='today'){S.soldeDate=iso(new Date());save();render()}
  if(a==='wipe'){if(b.dataset.c!=='1'){b.dataset.c='1';b.textContent='Confirmer : tout effacer';return}S=blank();save();render();toast('Tout est vidé')}
  if(a==='export'){const txt=JSON.stringify(S);const io=document.getElementById('io');
    io.innerHTML=`<textarea id="io-t" readonly>${esc(txt)}</textarea><div class="muted" style="font-size:.85rem">Garde ce texte dans une note : il permet de tout restaurer.</div>`;
    const ta=document.getElementById('io-t');
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(()=>toast('Sauvegarde copiée'),()=>{ta.select()});else ta.select()}
  if(a==='import'){document.getElementById('io').innerHTML=`<textarea id="io-t" placeholder="Colle ici le texte de sauvegarde"></textarea><button class="btn small" data-act="doimport" style="align-self:flex-start">Restaurer ces données</button>`}
  if(a==='doimport'){try{const d=JSON.parse(document.getElementById('io-t').value);if(!Array.isArray(d.fixes))throw 0;S=Object.assign(blank(),d);save();render();toast('Données restaurées')}catch(x){toast("Ce texte n'est pas une sauvegarde valide")}}
});
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='in-solde'){S.solde=num(t.value);save();render()}
  else if(t.id==='in-date'&&t.value){S.soldeDate=t.value;save();render()}
  else if(t.dataset.cest){const c=S.cartes.find(x=>x.id===t.dataset.cest);if(c){const s0=sd();S.cest=S.cest||{};S.cest[cKey(c,s0.getFullYear(),s0.getMonth())]=num(t.value);save();render()}}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&sheetCtx)closeSheet();
  if(e.key==='Enter'&&e.target.matches('#app input')){e.target.blur()}
});

render();

})();

/* ---------- hors ligne et mises à jour ---------- */
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./sw.js').then(reg=>{
      const show=w=>{const b=document.getElementById('upd');b.hidden=false;document.getElementById('upd-go').onclick=()=>w.postMessage('skip')};
      if(reg.waiting&&navigator.serviceWorker.controller)show(reg.waiting);
      reg.addEventListener('updatefound',()=>{const w=reg.installing;w&&w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)show(w)})});
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{})});
    }).catch(()=>{});
    let done=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!done){done=true;location.reload()}});
  });
}
