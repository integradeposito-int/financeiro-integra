/* Financeiro Integra — conector Google Apps Script V1.0.
 * A interface trabalha localmente; este módulo só transporta sincronizações em segundo plano.
 * JSONP evita bloqueios de CORS do ContentService. POST + operationId fica como fallback robusto.
 */
(function(){
 'use strict';
 const EXPECTED_SCHEMA=12;
 const CLIENT_VERSION='1.0';
 const FAST_GET_LIMIT=5500;
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function normalizeUrl(value){
   const url=String(value||'').trim();
   if(!url)return '';
   if(!/^https:\/\/script\.google\.com\/macros\/s\//i.test(url))throw Error('Use a URL oficial do Web App do Google Apps Script.');
   const clean=url.split('#')[0].split('?')[0].replace(/\/+$/,'');
   if(!/\/exec$/i.test(clean))throw Error('Use a URL da implantação terminada em /exec.');
   return clean;
 }
 function uid(){return 'fi_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2);}
 function jsonp(url,action,params={},timeoutMs=45000){
   const base=normalizeUrl(url);
   return new Promise((resolve,reject)=>{
     const callback='__fi_jsonp_'+uid().replace(/[^0-9A-Za-z_$]/g,'_');
     const script=document.createElement('script');
     const query=new URLSearchParams({action,callback,_:String(Date.now()),...Object.fromEntries(Object.entries(params).map(([k,v])=>[k,String(v??'')]))});
     let finished=false;
     const cleanup=()=>{if(finished)return;finished=true;clearTimeout(timer);try{delete window[callback];}catch(_){window[callback]=undefined;}script.remove();};
     window[callback]=data=>{cleanup();if(!data||typeof data!=='object')return reject(Error('O Apps Script retornou uma resposta inválida.'));if(data.ok===false)return reject(Error(data.error||'Falha no Apps Script.'));resolve(data);};
     script.onerror=()=>{cleanup();reject(Error('Não foi possível carregar a resposta do Google Apps Script. Verifique a implantação e a internet.'));};
     const timer=setTimeout(()=>{cleanup();reject(Error('A comunicação com a planilha excedeu o tempo esperado.'));},timeoutMs);
     script.src=base+'?'+query.toString();script.async=true;document.head.appendChild(script);
   });
 }
 async function operationStatus(url,operationId){return jsonp(url,'operationStatus',{operationId},20000);}
 async function waitOperation(url,operationId,timeoutMs=60000){
   const started=Date.now();
   while(Date.now()-started<timeoutMs){
     let status;try{status=await operationStatus(url,operationId);}catch(_){await wait(500);continue;}
     if(status.done){if(status.operationOk===false)throw Error(status.error||'A gravação falhou no Apps Script.');const result=status.result||{ok:true,saved:true};if(result.ok===false)throw Error(result.error||'A gravação falhou no Apps Script.');return result;}
     await wait(500);
   }
   throw Error('O Google recebeu a solicitação, mas ainda não confirmou a gravação. A fila local será tentada novamente automaticamente.');
 }
 async function postConfirmed(url,action,payload={},operationId=uid()){
   const base=normalizeUrl(url);
   const send=()=>fetch(base,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,payload,operationId,clientVersion:CLIENT_VERSION}),redirect:'follow'});
   await send();
   return waitOperation(base,operationId,60000);
 }
 async function fastMutation(url,action,payload,operationId=uid()){
   const encoded=JSON.stringify(payload||{});
   if(encoded.length<=FAST_GET_LIMIT){
     try{return await jsonp(url,action,{payload:encoded,operationId,clientVersion:CLIENT_VERSION},45000);}catch(_){}
   }
   return postConfirmed(url,action,payload,operationId);
 }
 async function test(url){
   const data=await jsonp(url,'ping',{},30000);
   if(Number(data.schemaVersion)!==EXPECTED_SCHEMA)throw Error(`Estrutura incompatível. Planilha V${data.schemaVersion||'?'}; sistema exige V${EXPECTED_SCHEMA}.`);
   if(data.ready===false)throw Error('A planilha foi encontrada, mas a estrutura ainda não está preparada. Execute setupFinanceiro() no Apps Script.');
   return data;
 }
 async function getState(url,year=null){
   const params=year?{year}:{};
   const data=await jsonp(url,'getState',params,60000);
   if(!data.data)throw Error('A planilha não retornou os dados.');
   if(Number(data.data.schemaVersion||EXPECTED_SCHEMA)!==EXPECTED_SCHEMA)throw Error('Estrutura da planilha incompatível.');
   return {state:data.data,revision:Number(data.revision||0),backendVersion:data.backendVersion||'',activeYear:Number(data.activeYear||0)||null,dataYear:Number(data.dataYear||year||0)||null,availableYears:Array.isArray(data.availableYears)?data.availableYears:[]};
 }
 async function syncStatus(url,year=null){
   const data=await jsonp(url,'syncStatus',year?{year}:{},30000);
   return {revision:Number(data.revision||0),backendVersion:data.backendVersion||'',serverTime:data.serverTime||'',activeYear:Number(data.activeYear||0)||null,dataYear:Number(data.dataYear||year||0)||null,availableYears:Array.isArray(data.availableYears)?data.availableYears:[]};
 }
 async function syncBatch(url,changes,baseRevision=null,year=null){
   if(!Array.isArray(changes)||!changes.length)return {ok:true,saved:true,applied:0,revision:Number(baseRevision||0)};
   const operationId=uid();
   const data=await fastMutation(url,'syncBatch',{changes,baseRevision,year},operationId);
   if(!data.saved)throw Error('O Apps Script não confirmou a sincronização.');
   return data;
 }
 // Compatibilidade com clientes/rotinas anteriores.
 async function applyChanges(url,changes){return syncBatch(url,changes,null);}
 async function saveState(url,state){const data=await postConfirmed(url,'saveState',{state});if(!data.saved)throw Error('O Apps Script não confirmou a gravação.');return data;}
 async function setup(url){return jsonp(url,'setup',{},90000);}
 window.DataConnection={EXPECTED_SCHEMA,CLIENT_VERSION,normalizeUrl,test,getState,syncStatus,syncBatch,applyChanges,saveState,setup};
})();
