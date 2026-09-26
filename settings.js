/* Configuracoes locais e identidade reutilizavel do Financeiro Integra / Obra Clara. */
(function(){
 'use strict';
 const KEY='financeiroIntegra.settings.v2', ADMIN_KEY='financeiroIntegra.adminHash.v1', UNLOCK='financeiroIntegra.adminUnlocked';
 const defaults={
   version:2,
   identity:{
     companyName:'Íntegra Engenharia e Construção',
     systemName:'Financeiro Íntegra',
     slogan:'Gestão que constrói resultados',
     logoLightData:'',
     logoDarkData:'',
     logoLightAsset:'assets/logo-integra-light.png',
     logoDarkAsset:'assets/logo-integra-dark.png'
   },
   connection:{url:'',schemaVersion:12,lastTestAt:'',lastSpreadsheetName:'',enabled:false}
 };
 const clone=x=>JSON.parse(JSON.stringify(x));
 const merge=(a,b)=>({
   ...a,...(b||{}),
   identity:{...a.identity,...((b||{}).identity||{})},
   connection:{...a.connection,...((b||{}).connection||{})}
 });
 function get(){try{return merge(clone(defaults),JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(_){return clone(defaults);}}
 function save(data){const next=merge(get(),data);localStorage.setItem(KEY,JSON.stringify(next));return next;}
 function resetIdentity(){const current=get();current.identity=clone(defaults.identity);localStorage.setItem(KEY,JSON.stringify(current));applyIdentity();return current;}
 function logoSrc(theme='light'){const i=get().identity;return theme==='dark'?(i.logoDarkData||i.logoDarkAsset):(i.logoLightData||i.logoLightAsset);}
 function logoData(theme='light'){const i=get().identity;return theme==='dark'?i.logoDarkData:i.logoLightData;}
 function applyIdentity(){
   const cfg=get(),i=cfg.identity;
   document.title=i.systemName||'Financeiro';
   const meta=document.querySelector('meta[name="description"]');if(meta)meta.content=`${i.systemName} — gestão financeira de obras, pessoas e pagamentos.`;
   const l=document.querySelector('#brand-logo-light');if(l){l.src=logoSrc('light');l.alt=i.companyName||i.systemName;}
   const d=document.querySelector('#brand-logo-dark');if(d){d.src=logoSrc('dark');d.alt=i.companyName||i.systemName;}
   const n=document.querySelector('#brand-system-name');if(n)n.textContent=i.systemName||'Financeiro';
   const s=document.querySelector('#brand-slogan');if(s)s.textContent=i.slogan||'';
   const a=document.querySelector('.brand');if(a)a.setAttribute('aria-label',`${i.systemName||'Financeiro'}, painel geral`);
   const rights=document.querySelector('#licensed-company');if(rights)rights.textContent=`© ${new Date().getFullYear()} ${i.companyName||i.systemName}. Todos os direitos reservados.`;
   const auth=document.querySelector('#licensed-use');if(auth)auth.textContent=`Uso autorizado para ${i.companyName||i.systemName}`;
   const appFooter=document.querySelector('#app-footer-copy');if(appFooter)appFooter.textContent=cfg.connection.enabled?'Base Google Sheets configurada.':'Modo local de demonstração.';
 }
 async function hashText(text){
   const value=String(text||'');
   if(globalThis.crypto?.subtle){const bytes=new TextEncoder().encode(value),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
   let h=2166136261;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619);}return 'fallback-'+(h>>>0).toString(16);
 }
 function hasAdminPassword(){return Boolean(localStorage.getItem(ADMIN_KEY));}
 async function setAdminPassword(password){if(String(password||'').length<4)throw Error('Use uma senha com pelo menos 4 caracteres.');localStorage.setItem(ADMIN_KEY,await hashText(password));sessionStorage.setItem(UNLOCK,'1');return true;}
 async function checkAdminPassword(password){const stored=localStorage.getItem(ADMIN_KEY);if(!stored)return false;const ok=stored===await hashText(password);if(ok)sessionStorage.setItem(UNLOCK,'1');return ok;}
 function isAdminUnlocked(){return sessionStorage.getItem(UNLOCK)==='1';}
 function lockAdmin(){sessionStorage.removeItem(UNLOCK);}
 function setConnection(info){const current=get(),url=String(info.url||'').trim();current.connection={...current.connection,url,enabled:Boolean(url),schemaVersion:Number(info.schemaVersion||12),lastTestAt:info.lastTestAt||new Date().toISOString(),lastSpreadsheetName:info.lastSpreadsheetName||current.connection.lastSpreadsheetName||''};localStorage.setItem(KEY,JSON.stringify(current));applyIdentity();return current;}
 function disconnect(){const current=get();current.connection={...clone(defaults.connection)};localStorage.setItem(KEY,JSON.stringify(current));applyIdentity();return current;}
 function exportConfig(){const data=get();return JSON.stringify({version:data.version,identity:data.identity,connection:data.connection},null,2);}
 function importConfig(json){const parsed=typeof json==='string'?JSON.parse(json):json;if(!parsed||typeof parsed!=='object')throw Error('Arquivo de configuração inválido.');const next=save(parsed);applyIdentity();return next;}
 window.AppSettings={defaults:clone(defaults),get,save,resetIdentity,logoSrc,logoData,applyIdentity,hashText,hasAdminPassword,setAdminPassword,checkAdminPassword,isAdminUnlocked,lockAdmin,setConnection,disconnect,exportConfig,importConfig};
})();
