/**
 * Financeiro Integra / Obra Clara - Backend Google Sheets / aplicativo V1.0 funcional
 * Uma URL do Web App administra uma base Google Sheets por ano.
 * Ano operacional = leitura/gravação. Anos anteriores = consulta.
 */
const FI_SCHEMA_VERSION = 12;
const FI_BACKEND_VERSION = '1.0';
const FI_REGISTRY_KEY = 'FI_ANNUAL_REGISTRY_V1';
const FI_ACTIVE_YEAR_KEY = 'FI_ACTIVE_YEAR_V1';
const FI_HUB_ID_KEY = 'FI_HUB_SPREADSHEET_ID_V1';

const FI_TABLES = {
  works: { sheet: 'OBRAS', headers: ['id','name','client','notes','status','contractCents'], numbers: ['contractCents'], nullable: ['contractCents'] },
  expenses: { sheet: 'GASTOS', headers: ['id','workId','date','competence','description','category','amountCents','supplier','notes','source'], numbers: ['amountCents'] },
  people: { sheet: 'PESSOAS', headers: ['id','type','name','role','salaryCents','status'], numbers: ['salaryCents'], nullable: ['salaryCents'] },
  contracts: { sheet: 'CONTRATOS', headers: ['id','personId','workId','service','quantity','unit','contractCents','status'], numbers: ['quantity','contractCents'] },
  payments: { sheet: 'PAGAMENTOS', headers: ['id','personId','contractId','workId','date','competence','amountCents','reference','method','kind'], numbers: ['amountCents'], nullable: ['contractId','workId'] },
  additives: { sheet: 'ADITIVOS', headers: ['id','contractId','personId','workId','date','competence','amountCents','description'], numbers: ['amountCents'] },
  adjustments: { sheet: 'DESCONTOS', headers: ['id','personId','contractId','workId','scope','date','competence','amountCents','description','kind'], numbers: ['amountCents'], nullable: ['contractId','workId'] },
  employeeDebts: { sheet: 'DIVIDAS_FUNCIONARIO', headers: ['id','personId','sourcePaymentId','createdDate','totalCents','installmentCount','startMonth','status','scheduleJson'], numbers: ['totalCents','installmentCount'], json: ['scheduleJson'] },
  contractorAdvances: { sheet: 'ADIANTAMENTOS_EMPREITEIRO', headers: ['id','personId','contractId','workId','sourcePaymentId','createdDate','totalCents','installmentCount','startMonth','status','scheduleJson'], numbers: ['totalCents','installmentCount'], json: ['scheduleJson'] },
  workCommitments: { sheet: 'COMPROMISSOS_OBRA', headers: ['id','workId','competence','dueDate','description','category','amountCents','status','sourceExpenseId','paidDate'], numbers: ['amountCents'], nullable: ['dueDate','sourceExpenseId','paidDate'] },
  openingBalances: { sheet: 'SALDOS_INICIAIS', headers: ['id','year','scope','entityId','directExpenseCents','paymentCents','adjustmentCents','additiveCents'], numbers: ['year','directExpenseCents','paymentCents','adjustmentCents','additiveCents'] }
};

function setupFinanceiro() {
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (!bound) throw new Error('Abra este Apps Script pela planilha principal antes de executar setupFinanceiro().');
  const props = PropertiesService.getScriptProperties();
  props.setProperty(FI_HUB_ID_KEY, bound.getId());
  const year = new Date().getFullYear();
  const registry = getAnnualRegistry_();
  if (!registry[String(year)]) registry[String(year)] = bound.getId();
  saveAnnualRegistry_(registry);
  props.setProperty(FI_ACTIVE_YEAR_KEY, String(Math.max(Number(props.getProperty(FI_ACTIVE_YEAR_KEY)||0), year)));
  ensureStructure_(bound);
  upsertConfig_(bound.getSheetByName('CONFIG'), 'baseYear', String(year));
  upsertConfig_(bound.getSheetByName('CONFIG'), 'appVersion', FI_BACKEND_VERSION);
  upsertConfig_(bound.getSheetByName('CONFIG'), 'annualMode', '1 arquivo por ano');
  upsertConfig_(bound.getSheetByName('CONFIG'), 'annualRegistry', JSON.stringify(registry));
  ensureRevisionInitialized_(bound, year);
  CacheService.getScriptCache().put('fi_structure_ready_'+year, '1', 300);
  return 'Base anual do Financeiro pronta em: ' + bound.getName() + ' (' + year + ')';
}
function setupFinanceiroV12(){ return setupFinanceiro(); }

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'ping');
  try {
    ensureCurrentYear_();
    let result;
    if (action === 'ping') result = { ok:true, ...ping_() };
    else if (action === 'syncStatus') result = { ok:true, ...syncStatus_(requestYear_(e)) };
    else if (action === 'getState') {
      const year=requestYear_(e), meta=yearMeta_();
      result={ok:true,data:readState_(year),revision:getRevision_(year),backendVersion:FI_BACKEND_VERSION,dataYear:year,...meta};
    }
    else if (action === 'setup') { setupFinanceiro(); result={ok:true,...ping_(),setup:true}; }
    else if (action === 'operationStatus') result=operationStatus_(String((e&&e.parameter&&e.parameter.operationId)||''));
    else if (action === 'syncBatch' || action === 'applyChanges') {
      const operationId=String((e&&e.parameter&&e.parameter.operationId)||''),cached=operationId?getCachedOperation_(operationId):null;
      if(cached&&cached.done) result=cached.ok===false?{ok:false,error:cached.error||'Falha anterior na gravação.',backendVersion:FI_BACKEND_VERSION}:(cached.result||{ok:true,saved:true,backendVersion:FI_BACKEND_VERSION});
      else {
        const payload=JSON.parse(String((e&&e.parameter&&e.parameter.payload)||'{}'));
        const year=normalizeYear_(payload.year||requestYear_(e));
        const saved=applyChanges_(payload.changes,year);
        result={ok:true,saved:true,applied:saved.applied,revision:saved.revision,schemaVersion:FI_SCHEMA_VERSION,backendVersion:FI_BACKEND_VERSION,dataYear:year,...yearMeta_(),savedAt:new Date().toISOString()};
        if(operationId)cacheOperation_(operationId,{done:true,ok:true,result:result,error:''});
      }
    } else result={ok:false,error:'Acao GET desconhecida: '+action};
    return output_(result,e);
  } catch(err) {
    const message=String(err&&err.message||err),operationId=String((e&&e.parameter&&e.parameter.operationId)||'');
    if(operationId)cacheOperation_(operationId,{done:true,ok:false,error:message});
    return output_({ok:false,error:message,backendVersion:FI_BACKEND_VERSION,...yearMetaSafe_()},e);
  }
}

function doPost(e) {
  let body={};
  try {
    ensureCurrentYear_();
    body=JSON.parse((e&&e.postData&&e.postData.contents)||'{}');
    const action=String(body.action||''),operationId=String(body.operationId||''),cached=operationId?getCachedOperation_(operationId):null;
    if(cached&&cached.done)return json_(cached.ok===false?{ok:false,error:cached.error||'Falha anterior na gravação.',backendVersion:FI_BACKEND_VERSION}:(cached.result||{ok:true,saved:true,backendVersion:FI_BACKEND_VERSION}));
    let result;
    if(action==='ping')result={ok:true,...ping_()};
    else if(action==='syncStatus')result={ok:true,...syncStatus_(normalizeYear_(body.payload&&body.payload.year))};
    else if(action==='getState'){
      const year=normalizeYear_(body.payload&&body.payload.year),meta=yearMeta_();
      result={ok:true,data:readState_(year),revision:getRevision_(year),backendVersion:FI_BACKEND_VERSION,dataYear:year,...meta};
    }
    else if(action==='syncBatch'||action==='applyChanges'){
      const payload=body.payload||{},year=normalizeYear_(payload.year),saved=applyChanges_(payload.changes,year);
      result={ok:true,saved:true,applied:saved.applied,revision:saved.revision,schemaVersion:FI_SCHEMA_VERSION,backendVersion:FI_BACKEND_VERSION,dataYear:year,...yearMeta_(),savedAt:new Date().toISOString()};
    }
    else if(action==='saveState'){
      const payload=body.payload||{},year=normalizeYear_(payload.year),state=payload.state;
      if(!state||typeof state!=='object')throw new Error('Estado recebido e invalido.');
      const saved=saveState_(state,year);
      result={ok:true,saved:true,revision:saved.revision,schemaVersion:FI_SCHEMA_VERSION,backendVersion:FI_BACKEND_VERSION,dataYear:year,...yearMeta_(),savedAt:new Date().toISOString()};
    }
    else if(action==='setup'){setupFinanceiro();result={ok:true,...ping_(),setup:true};}
    else result={ok:false,error:'Acao POST desconhecida: '+action};
    if(operationId)cacheOperation_(operationId,{done:true,ok:result.ok!==false,result:result,error:result.error||''});
    return json_(result);
  } catch(err) {
    const message=String(err&&err.message||err),operationId=String(body&&body.operationId||'');
    if(operationId)cacheOperation_(operationId,{done:true,ok:false,error:message});
    return json_({ok:false,error:message,backendVersion:FI_BACKEND_VERSION,...yearMetaSafe_()});
  }
}

function ping_(){
  const activeYear=ensureCurrentYear_(),ss=getSpreadsheet_(activeYear),cache=CacheService.getScriptCache(),key='fi_structure_ready_'+activeYear;
  let readyText=cache.get(key),ready;if(readyText===null){ready=isStructureReady_(ss);cache.put(key,ready?'1':'0',300);}else ready=readyText==='1';
  return {schemaVersion:FI_SCHEMA_VERSION,structure:'Financeiro Integra - Base anual',spreadsheetId:ss.getId(),spreadsheetName:ss.getName(),ready:ready,revision:getRevision_(activeYear),backendVersion:FI_BACKEND_VERSION,serverTime:new Date().toISOString(),...yearMeta_()};
}
function syncStatus_(year){year=normalizeYear_(year);return {schemaVersion:FI_SCHEMA_VERSION,revision:getRevision_(year),backendVersion:FI_BACKEND_VERSION,serverTime:new Date().toISOString(),dataYear:year,...yearMeta_()};}
function yearMeta_(){const registry=getAnnualRegistry_(),activeYear=getActiveYear_();return {activeYear:activeYear,availableYears:Object.keys(registry).map(Number).filter(Number.isFinite).sort((a,b)=>a-b)};}
function yearMetaSafe_(){try{return yearMeta_();}catch(_){return {activeYear:new Date().getFullYear(),availableYears:[]};}}
function normalizeYear_(year){const active=getActiveYear_(),n=Number(year||active);if(!Number.isInteger(n)||n<2000||n>2200)throw new Error('Ano invalido.');return n;}
function requestYear_(e){return normalizeYear_(e&&e.parameter&&e.parameter.year);}

function getHubSpreadsheet_(){const id=PropertiesService.getScriptProperties().getProperty(FI_HUB_ID_KEY);if(id)return SpreadsheetApp.openById(id);const active=SpreadsheetApp.getActiveSpreadsheet();if(!active)throw new Error('Execute setupFinanceiro() uma vez para registrar a planilha principal.');return active;}
function getAnnualRegistry_(){const props=PropertiesService.getScriptProperties(),raw=props.getProperty(FI_REGISTRY_KEY);if(raw){try{const parsed=JSON.parse(raw);if(parsed&&typeof parsed==='object')return parsed;}catch(_){}}const hubId=props.getProperty(FI_HUB_ID_KEY);return hubId?{[String(new Date().getFullYear())]:hubId}:{};}
function saveAnnualRegistry_(registry){const props=PropertiesService.getScriptProperties();props.setProperty(FI_REGISTRY_KEY,JSON.stringify(registry));try{const hub=getHubSpreadsheet_(),config=hub.getSheetByName('CONFIG');if(config){upsertConfig_(config,'annualRegistry',JSON.stringify(registry));upsertConfig_(config,'activeYear',String(getActiveYear_()));}}catch(_){}}
function getActiveYear_(){const props=PropertiesService.getScriptProperties(),raw=Number(props.getProperty(FI_ACTIVE_YEAR_KEY)||0);return Number.isInteger(raw)&&raw>=2000?raw:new Date().getFullYear();}
function getSpreadsheet_(year){year=normalizeYear_(year);const registry=getAnnualRegistry_(),id=registry[String(year)];if(!id)throw new Error('Nao existe base anual registrada para '+year+'.');return SpreadsheetApp.openById(id);}
function ensureCurrentYear_(){
  const props=PropertiesService.getScriptProperties(),calendar=new Date().getFullYear();let active=getActiveYear_(),registry=getAnnualRegistry_();
  if(!Object.keys(registry).length){const hub=getHubSpreadsheet_();registry[String(calendar)]=hub.getId();saveAnnualRegistry_(registry);active=calendar;props.setProperty(FI_ACTIVE_YEAR_KEY,String(active));}
  if(calendar>active){for(let year=active+1;year<=calendar;year++){createAnnualSpreadsheet_(year,year-1);active=year;props.setProperty(FI_ACTIVE_YEAR_KEY,String(active));}registry=getAnnualRegistry_();}
  return active;
}

function createAnnualSpreadsheet_(year,sourceYear){
  const registry=getAnnualRegistry_();if(registry[String(year)])return SpreadsheetApp.openById(registry[String(year)]);
  const source=getSpreadsheet_(sourceYear),sourceState=readState_(sourceYear),name='Financeiro Integra - '+year,created=SpreadsheetApp.create(name);
  ensureStructure_(created);
  const newState={schemaVersion:FI_SCHEMA_VERSION,works:deepCopy_(sourceState.works||[]),expenses:[],people:deepCopy_(sourceState.people||[]),contracts:deepCopy_(sourceState.contracts||[]),payments:[],additives:[],adjustments:[],employeeDebts:carryPlans_(sourceState.employeeDebts||[],year),contractorAdvances:carryPlans_(sourceState.contractorAdvances||[],year),workCommitments:(sourceState.workCommitments||[]).filter(x=>x.status!=='paid'&&String(x.competence||'')>=String(year)+'-01').map(deepCopy_),openingBalances:buildOpeningBalances_(sourceState,year)};
  writeStateTo_(created,newState);
  const config=created.getSheetByName('CONFIG');upsertConfig_(config,'baseYear',String(year));upsertConfig_(config,'appVersion',FI_BACKEND_VERSION);upsertConfig_(config,'annualMode','1 arquivo por ano');upsertConfig_(config,'archiveMode','operacional');
  const oldConfig=source.getSheetByName('CONFIG');if(oldConfig)upsertConfig_(oldConfig,'archiveMode','somente leitura');
  const defaultSheet=created.getSheetByName('Sheet1');if(defaultSheet&&created.getSheets().length>1)created.deleteSheet(defaultSheet);
  registry[String(year)]=created.getId();PropertiesService.getScriptProperties().setProperty(FI_ACTIVE_YEAR_KEY,String(year));saveAnnualRegistry_(registry);ensureRevisionInitialized_(created,year);return created;
}
function carryPlans_(plans,year){const min=String(year)+'-01';return (plans||[]).map(plan=>{const c=deepCopy_(plan),schedule=(c.schedule||[]).filter(x=>String(x.month||'')>=min);if(!schedule.length)return null;c.schedule=schedule;c.totalCents=schedule.reduce((s,x)=>s+Number(x.amountCents||0),0);c.installmentCount=schedule.length;c.startMonth=schedule[0].month;return c;}).filter(Boolean);}
function deepCopy_(x){return JSON.parse(JSON.stringify(x));}
function sum_(rows,field){return (rows||[]).reduce((s,x)=>s+Number(x&&x[field]||0),0);}
function openingValue_(state,scope,id,key){const row=(state.openingBalances||[]).find(x=>x.scope===scope&&String(x.entityId||'')===String(id||''));return Number(row&&row[key]||0);}
function buildOpeningBalances_(state,year){
  const rows=[];
  const make=(scope,entityId,vals)=>rows.push({id:'saldo-'+scope+'-'+String(entityId||'geral')+'-'+year,year:year,scope:scope,entityId:String(entityId||''),directExpenseCents:Number(vals.directExpenseCents||0),paymentCents:Number(vals.paymentCents||0),adjustmentCents:Number(vals.adjustmentCents||0),additiveCents:Number(vals.additiveCents||0)});
  make('company','company',{directExpenseCents:openingValue_(state,'company','company','directExpenseCents')+sum_(state.expenses,'amountCents'),paymentCents:openingValue_(state,'company','company','paymentCents')+sum_(state.payments,'amountCents'),adjustmentCents:openingValue_(state,'company','company','adjustmentCents')+sum_(state.adjustments,'amountCents')});
  (state.works||[]).forEach(w=>make('work',w.id,{directExpenseCents:openingValue_(state,'work',w.id,'directExpenseCents')+(state.expenses||[]).filter(x=>x.workId===w.id).reduce((s,x)=>s+Number(x.amountCents||0),0),paymentCents:openingValue_(state,'work',w.id,'paymentCents')+(state.payments||[]).filter(x=>x.workId===w.id).reduce((s,x)=>s+Number(x.amountCents||0),0),adjustmentCents:openingValue_(state,'work',w.id,'adjustmentCents')+(state.adjustments||[]).filter(x=>x.workId===w.id).reduce((s,x)=>s+Number(x.amountCents||0),0)}));
  (state.people||[]).forEach(p=>make('person',p.id,{paymentCents:openingValue_(state,'person',p.id,'paymentCents')+(state.payments||[]).filter(x=>x.personId===p.id).reduce((s,x)=>s+Number(x.amountCents||0),0),adjustmentCents:openingValue_(state,'person',p.id,'adjustmentCents')+(state.adjustments||[]).filter(x=>x.personId===p.id).reduce((s,x)=>s+Number(x.amountCents||0),0)}));
  (state.contracts||[]).forEach(c=>make('contract',c.id,{paymentCents:openingValue_(state,'contract',c.id,'paymentCents')+(state.payments||[]).filter(x=>x.contractId===c.id).reduce((s,x)=>s+Number(x.amountCents||0),0),adjustmentCents:openingValue_(state,'contract',c.id,'adjustmentCents')+(state.adjustments||[]).filter(x=>x.contractId===c.id).reduce((s,x)=>s+Number(x.amountCents||0),0),additiveCents:openingValue_(state,'contract',c.id,'additiveCents')+(state.additives||[]).filter(x=>x.contractId===c.id).reduce((s,x)=>s+Number(x.amountCents||0),0)}));
  return rows;
}

function revisionKey_(year){return 'FI_DATA_REVISION_'+String(year);}
function ensureRevisionInitialized_(ss,year){const props=PropertiesService.getScriptProperties(),key=revisionKey_(year),current=props.getProperty(key);if(current!==null&&current!=='')return Number(current)||0;const map=getConfigMap_(ss||getSpreadsheet_(year)),revision=Math.max(0,Number(map.dataRevision||0)||0);props.setProperty(key,String(revision));return revision;}
function getRevision_(year){year=normalizeYear_(year);const props=PropertiesService.getScriptProperties(),raw=props.getProperty(revisionKey_(year));if(raw!==null&&raw!=='')return Math.max(0,Number(raw)||0);return ensureRevisionInitialized_(getSpreadsheet_(year),year);}
function bumpRevision_(ss,year){const props=PropertiesService.getScriptProperties(),next=getRevision_(year)+1;props.setProperty(revisionKey_(year),String(next));const config=(ss||getSpreadsheet_(year)).getSheetByName('CONFIG');if(config){upsertConfig_(config,'dataRevision',String(next));upsertConfig_(config,'ultimaGravacao',new Date().toISOString());}return next;}

function output_(obj,e){const callback=String((e&&e.parameter&&(e.parameter.callback||e.parameter.prefix))||'').trim();if(callback){if(!/^[A-Za-z_$][0-9A-Za-z_$]*$/.test(callback))throw new Error('Callback invalido.');return ContentService.createTextOutput(callback+'('+JSON.stringify(obj)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);}return json_(obj);}
function cacheOperation_(operationId,data){if(operationId)CacheService.getScriptCache().put('fi_op_'+operationId,JSON.stringify(data),600);}
function getCachedOperation_(operationId){if(!operationId)return null;const raw=CacheService.getScriptCache().get('fi_op_'+operationId);if(!raw)return null;try{return JSON.parse(raw);}catch(_){return null;}}
function operationStatus_(operationId){if(!operationId)return{ok:false,error:'operationId ausente.'};const data=getCachedOperation_(operationId);if(!data)return{ok:true,done:false,operationId:operationId,backendVersion:FI_BACKEND_VERSION};return{ok:true,done:!!data.done,operationOk:data.ok!==false,operationId:operationId,result:data.result||null,error:data.error||'',backendVersion:FI_BACKEND_VERSION};}
function getConfigMap_(ss){const config=ss.getSheetByName('CONFIG');if(!config)return{};const last=Math.max(1,config.getLastRow()),values=config.getRange(1,1,last,2).getDisplayValues(),map={};values.slice(1).forEach(r=>{if(r[0])map[String(r[0])]=String(r[1]||'');});return map;}
function isStructureReady_(ss){const map=getConfigMap_(ss);if(Number(map.schemaVersion||0)!==FI_SCHEMA_VERSION)return false;return Object.keys(FI_TABLES).every(key=>!!ss.getSheetByName(FI_TABLES[key].sheet));}
function assertStructureReady_(ss){const map=getConfigMap_(ss),current=Number(map.schemaVersion||0);if(current!==FI_SCHEMA_VERSION)throw new Error('Estrutura nao preparada. Execute setupFinanceiro(). Versao encontrada='+(map.schemaVersion||'nenhuma')+'.');const missing=Object.keys(FI_TABLES).filter(key=>!ss.getSheetByName(FI_TABLES[key].sheet)).map(key=>FI_TABLES[key].sheet);if(missing.length)throw new Error('Estrutura incompleta. Abas ausentes: '+missing.join(', ')+'. Execute setupFinanceiro().');}
function ensureStructure_(ss){const config=getOrCreateSheet_(ss,'CONFIG');ensureHeaders_(config,['chave','valor']);const values=config.getRange(1,1,Math.max(1,config.getLastRow()),2).getDisplayValues(),map={};values.slice(1).forEach(r=>{if(r[0])map[String(r[0])]=String(r[1]||'');});if(map.schemaVersion&&Number(map.schemaVersion)!==FI_SCHEMA_VERSION)throw new Error('Estrutura incompatível. Planilha='+map.schemaVersion+', sistema='+FI_SCHEMA_VERSION+'.');upsertConfig_(config,'schemaVersion',String(FI_SCHEMA_VERSION));upsertConfig_(config,'estrutura','Financeiro Integra - Base anual');upsertConfig_(config,'appVersion',FI_BACKEND_VERSION);Object.keys(FI_TABLES).forEach(key=>{const spec=FI_TABLES[key],sh=getOrCreateSheet_(ss,spec.sheet);ensureHeaders_(sh,spec.headers);sh.setFrozenRows(1);});}
function getOrCreateSheet_(ss,name){return ss.getSheetByName(name)||ss.insertSheet(name);}
function ensureHeaders_(sheet,headers){const current=sheet.getRange(1,1,1,headers.length).getDisplayValues()[0],hasAny=current.some(v=>String(v).trim()!=='');if(hasAny){const mismatch=headers.some((h,i)=>String(current[i]||'').trim()!==h);if(mismatch)throw new Error('Cabecalhos incompatíveis na aba '+sheet.getName()+'. Use o modelo do Financeiro ou uma planilha vazia.');}else sheet.getRange(1,1,1,headers.length).setValues([headers]);}
function upsertConfig_(sheet,key,value){const last=Math.max(1,sheet.getLastRow()),rows=sheet.getRange(1,1,last,2).getValues();for(let i=1;i<rows.length;i++){if(String(rows[i][0])===key){sheet.getRange(i+1,2).setValue(value);return;}}sheet.appendRow([key,value]);}

function readState_(year){year=normalizeYear_(year);const ss=getSpreadsheet_(year);assertStructureReady_(ss);const state={schemaVersion:FI_SCHEMA_VERSION};Object.keys(FI_TABLES).forEach(key=>state[key]=readTableCached_(year,key,ss.getSheetByName(FI_TABLES[key].sheet),FI_TABLES[key]));return state;}
function readTableCached_(year,key,sheet,spec){const cache=CacheService.getScriptCache(),cacheKey='fi_v10_'+year+'_'+key;try{const raw=cache.get(cacheKey);if(raw)return JSON.parse(raw);}catch(_){}const rows=readTable_(sheet,spec);try{const raw=JSON.stringify(rows);if(raw.length<90000)cache.put(cacheKey,raw,300);}catch(_){}return rows;}
function readTable_(sheet,spec){const lastRow=sheet.getLastRow();if(lastRow<2)return[];const rows=sheet.getRange(2,1,lastRow-1,spec.headers.length).getValues();return rows.filter(row=>row.some(v=>v!==''&&v!==null)).map(row=>{const obj={};spec.headers.forEach((h,i)=>{let v=row[i];if(v instanceof Date)v=Utilities.formatDate(v,Session.getScriptTimeZone()||'America/Cuiaba','yyyy-MM-dd');if((spec.json||[]).includes(h)){try{v=v?JSON.parse(String(v)):[];}catch(_){v=[];}obj[h==='scheduleJson'?'schedule':h]=v;}else if((spec.numbers||[]).includes(h))obj[h]=(v===''||v===null)?((spec.nullable||[]).includes(h)?null:0):Number(v);else if((spec.nullable||[]).includes(h))obj[h]=(v===''||v===null)?null:String(v);else obj[h]=v===null?'':String(v);});return obj;});}

function applyChanges_(changes,year){year=normalizeYear_(year);if(year!==getActiveYear_())throw new Error('O ano '+year+' esta arquivado e disponivel somente para consulta.');if(!Array.isArray(changes))throw new Error('Pacote de alteracoes invalido.');if(changes.length>100)throw new Error('Pacote de alteracoes excedeu o limite de 100 itens.');if(!changes.length)return{applied:0,revision:getRevision_(year)};const lock=LockService.getScriptLock();lock.waitLock(15000);try{const ss=getSpreadsheet_(year);let applied=0;const grouped={};changes.forEach(change=>{const key=String(change&&change.table||'');if(!FI_TABLES[key])throw new Error('Tabela desconhecida: '+key);(grouped[key]=grouped[key]||[]).push(change);});Object.keys(grouped).forEach(key=>{const spec=FI_TABLES[key],sheet=ss.getSheetByName(spec.sheet);if(!sheet)throw new Error('Aba '+spec.sheet+' nao encontrada. Execute setupFinanceiro().');applyTableChanges_(sheet,spec,grouped[key]);applied+=grouped[key].length;});const cache=CacheService.getScriptCache();Object.keys(grouped).forEach(key=>{try{cache.remove('fi_v10_'+year+'_'+key);}catch(_){}});const revision=applied?bumpRevision_(ss,year):getRevision_(year);return{applied:applied,revision:revision};}finally{lock.releaseLock();}}
function applyTableChanges_(sheet,spec,changes){const lastRow=sheet.getLastRow(),ids=lastRow>=2?sheet.getRange(2,1,lastRow-1,1).getDisplayValues().map(r=>String(r[0]||'')):[],rowById={};ids.forEach((id,i)=>{if(id)rowById[id]=i+2;});const appends=[],updates=[],deletes=[];changes.forEach(change=>{const op=String(change&&change.op||'upsert'),item=change&&change.record,id=String((item&&item.id)||change.id||'');if(!id)throw new Error('Alteracao sem ID na aba '+sheet.getName()+'.');if(op==='delete'){if(rowById[id])deletes.push(rowById[id]);return;}if(!item||typeof item!=='object')throw new Error('Registro invalido para '+sheet.getName()+'.');const row=rowFromItem_(spec,item);if(rowById[id])updates.push({row:rowById[id],values:row});else appends.push(row);});updates.forEach(x=>sheet.getRange(x.row,1,1,spec.headers.length).setValues([x.values]));if(appends.length)sheet.getRange(sheet.getLastRow()+1,1,appends.length,spec.headers.length).setValues(appends);deletes.sort((a,b)=>b-a).forEach(row=>sheet.deleteRow(row));}
function rowFromItem_(spec,item){return spec.headers.map(h=>{let key=h==='scheduleJson'?'schedule':h,v=item[key];if((spec.json||[]).includes(h))return JSON.stringify(Array.isArray(v)?v:(v||[]));if((spec.nullable||[]).includes(h)&&(v===null||v===undefined||v===''))return'';return v===undefined||v===null?'':v;});}
function saveState_(state,year){year=normalizeYear_(year);if(year!==getActiveYear_())throw new Error('Ano arquivado e somente leitura.');const lock=LockService.getScriptLock();lock.waitLock(15000);try{const ss=getSpreadsheet_(year);writeStateTo_(ss,state);const cache=CacheService.getScriptCache();Object.keys(FI_TABLES).forEach(key=>{try{cache.remove('fi_v10_'+year+'_'+key);}catch(_){}});return{revision:bumpRevision_(ss,year)};}finally{lock.releaseLock();}}
function writeStateTo_(ss,state){Object.keys(FI_TABLES).forEach(key=>writeTable_(ss.getSheetByName(FI_TABLES[key].sheet),FI_TABLES[key],Array.isArray(state[key])?state[key]:[]));}
function writeTable_(sheet,spec,items){const last=sheet.getLastRow();if(last>1)sheet.getRange(2,1,last-1,spec.headers.length).clearContent();if(!items.length)return;const rows=items.map(item=>rowFromItem_(spec,item));sheet.getRange(2,1,rows.length,spec.headers.length).setValues(rows);}

function onEdit(e){try{const ss=e&&e.source;if(!ss)return;const registry=getAnnualRegistry_(),entry=Object.keys(registry).find(y=>registry[y]===ss.getId());if(!entry)return;const sheet=e.range&&e.range.getSheet(),table=Object.keys(FI_TABLES).find(key=>FI_TABLES[key].sheet===sheet.getName());if(table){try{CacheService.getScriptCache().remove('fi_v10_'+entry+'_'+table);}catch(_){}bumpRevision_(ss,Number(entry));}}catch(_){} }
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
