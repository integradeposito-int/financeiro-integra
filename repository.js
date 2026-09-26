/* Financeiro Íntegra — adapter boundary.
 * A interface usa somente Repository. A futura integração com Apps Script/Sheets
 * poderá implementar estes mesmos métodos sem reescrever as telas.
 * Dinheiro = centavos inteiros de BRL. IDs são chaves; nomes nunca são chaves.
 * Demonstração atual: memória local; recarregar restaura os exemplos.
 */
(function(){
 const seed=()=>({
  schemaVersion:12,
  works:[
   {id:'obra-001',name:'Moinho',client:'Inpasa Brasil',notes:'Rondonópolis/MT',status:'active',contractCents:20000000},
   {id:'obra-002',name:'Michimingue',client:'Inpasa Brasil',notes:'Rondonópolis/MT',status:'active',contractCents:12500000},
   {id:'obra-003',name:'Restauração Estrutural',client:'Mosaico',notes:'Rondonópolis/MT',status:'active',contractCents:8500000},
   {id:'obra-004',name:'Escritório Centro',client:'Cliente demonstração',notes:'Obra encerrada',status:'closed',contractCents:3500000}
  ],
  expenses:[
   ['e1','obra-001','2026-06-04','Materiais para fundação','Material',1820000,'Depósito Central'],
   ['e2','obra-001','2026-07-09','Equipe de alvenaria','Mão de obra',2400000,'Equipe Construir'],
   ['e3','obra-001','2026-08-12','Aço e concreto','Material',2245000,'Casa do Construtor'],
   ['e4','obra-001','2026-09-03','Serviço de topografia','Serviços',120000,'Topografia Horizonte'],
   ['e5','obra-001','2026-09-17','Instalação elétrica','Mão de obra',1200000,'Elétrica Ramos'],
   ['e6','obra-002','2026-07-15','Estrutura metálica','Material',1900000,'Metal Norte'],
   ['e7','obra-002','2026-08-18','Montagem da estrutura','Mão de obra',1250000,'Montagens MT'],
   ['e8','obra-003','2026-07-08','Revestimentos e pisos','Material',2600000,'Acabamentos Brasil'],
   ['e9','obra-003','2026-08-19','Equipe de reforma','Mão de obra',2100000,'Equipe Construir'],
   ['e10','obra-004','2026-07-22','Execução da reforma','Mão de obra',1530000,'Equipe Construir']
  ].map(([id,workId,date,description,category,amountCents,supplier])=>({id,workId,date,description,category,amountCents,supplier,notes:'Dado fictício para demonstração.',source:'manual'})),
  people:[
   {id:'pessoa-001',type:'contractor',name:'Samuel',role:'Empreiteiro',salaryCents:null,status:'active'},
   {id:'pessoa-002',type:'employee',name:'Carlos Henrique',role:'Carpinteiro',salaryCents:360000,status:'active'},
   {id:'pessoa-003',type:'employee',name:'Rafael Souza',role:'Servente',salaryCents:245000,status:'active'},
   {id:'pessoa-004',type:'contractor',name:'Marcos Almeida',role:'Armador',salaryCents:null,status:'active'}
  ],
  contracts:[
   {id:'contrato-001',personId:'pessoa-001',workId:'obra-001',service:'Execução civil / empreitada',quantity:1,unit:'contrato',contractCents:3000000,status:'active'},
   {id:'contrato-002',personId:'pessoa-001',workId:'obra-002',service:'Execução civil / empreitada',quantity:1,unit:'contrato',contractCents:2200000,status:'active'},
   {id:'contrato-003',personId:'pessoa-001',workId:'obra-003',service:'Restauração estrutural',quantity:1,unit:'contrato',contractCents:4000000,status:'active'},
   {id:'contrato-004',personId:'pessoa-004',workId:'obra-001',service:'Armação',quantity:1800,unit:'kg',contractCents:1620000,status:'active'}
  ],
  payments:[
   {id:'pag-001',personId:'pessoa-001',contractId:'contrato-001',workId:'obra-001',date:'2026-09-05',amountCents:700000,reference:'1ª medição',method:'Pix',kind:'Medição'},
   {id:'pag-002',personId:'pessoa-001',contractId:'contrato-003',workId:'obra-003',date:'2026-09-12',amountCents:1000000,reference:'Adiantamento',method:'Pix',kind:'Adiantamento'},
   {id:'pag-003',personId:'pessoa-001',contractId:'contrato-001',workId:'obra-001',date:'2026-09-18',amountCents:500000,reference:'2ª medição',method:'Pix',kind:'Medição'},
   {id:'pag-004',personId:'pessoa-002',contractId:null,workId:'obra-001',date:'2026-09-05',amountCents:180000,reference:'Adiantamento salarial',method:'Pix',kind:'Adiantamento'},
   {id:'pag-005',personId:'pessoa-003',contractId:null,workId:'obra-002',date:'2026-09-05',amountCents:122500,reference:'Adiantamento salarial',method:'Pix',kind:'Adiantamento'}
  ],
  additives:[
   {id:'aditivo-001',contractId:'contrato-001',personId:'pessoa-001',workId:'obra-001',date:'2026-09-10',amountCents:250000,description:'Acréscimo de escopo'}
  ],
  employeeDebts:[],
  contractorAdvances:[],
  openingBalances:[],
  workCommitments:[
   {id:'comp-001',workId:'obra-001',competence:'2026-10',dueDate:'2026-10-10',description:'Locação de equipamento programada',category:'Equipamentos',amountCents:300000,status:'planned',sourceExpenseId:null},
   {id:'comp-002',workId:'obra-001',competence:'2026-11',dueDate:'2026-11-05',description:'Parcela prevista de serviço',category:'Serviços',amountCents:450000,status:'planned',sourceExpenseId:null}
  ],
  adjustments:[
   {id:'desc-001',personId:'pessoa-001',contractId:'contrato-001',workId:'obra-001',scope:'work',date:'2026-09-14',amountCents:18000,description:'Compra de ferramenta por conta do empreiteiro',kind:'Compra / material'},
   {id:'desc-002',personId:'pessoa-002',contractId:null,workId:'obra-001',scope:'work',date:'2026-09-11',amountCents:8500,description:'Compra de colher de pedreiro',kind:'Ferramenta'}
  ]
 });
 let state=seed();
 const copy=x=>JSON.parse(JSON.stringify(x));
 const id=prefix=>prefix+'-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+Math.random().toString(36).slice(2));
 const requireWork=workId=>{const w=state.works.find(x=>x.id===workId);if(!w)throw Error('Selecione uma obra válida.');return w;};
 const requirePerson=personId=>{const p=state.people.find(x=>x.id===personId);if(!p)throw Error('Selecione uma pessoa válida.');return p;};
 const requireContract=contractId=>{const c=state.contracts.find(x=>x.id===contractId);if(!c)throw Error('Selecione um contrato válido.');return c;};
 const text=(value,max,label)=>{const s=String(value||'').trim();if(!s)throw Error(`Informe ${label}.`);if(s.length>max)throw Error(`${label} deve ter até ${max} caracteres.`);return s;};
 const checkWorkName=(name,workId)=>{const s=text(name,100,'o nome da obra');if(state.works.some(w=>w.id!==workId&&w.name.trim().toLocaleLowerCase()===s.toLocaleLowerCase()))throw Error('Já existe uma obra com esse nome.');return s;};
 const checkPersonName=(name,personId)=>{const s=text(name,120,'o nome da pessoa');if(state.people.some(p=>p.id!==personId&&p.name.trim().toLocaleLowerCase()===s.toLocaleLowerCase()))throw Error('Já existe uma pessoa cadastrada com esse nome.');return s;};
 const validCents=(value,label='valor')=>{if(!Number.isSafeInteger(value)||value<=0||value>1e14)throw Error(`Informe ${label} maior que zero.`);return value;};
 const monthValid=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(String(value||''));
 const addMonth=(month,offset)=>{const [year,mon]=month.split('-').map(Number),d=new Date(Date.UTC(year,mon-1+offset,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;};
 const repo={
  mode:'demo',
  async getDashboard(){return copy(state);},
  async createWork(payload){const contractCents=payload.contractCents==null?null:validCents(payload.contractCents,'um valor contratado');const work={id:id('obra'),name:checkWorkName(payload.name),client:String(payload.client||'').trim().slice(0,120),notes:String(payload.notes||'').trim().slice(0,500),status:'active',contractCents};state.works.push(work);return copy(work);},
  async updateWork(workId,payload){const work=requireWork(workId);if(!['active','closed'].includes(payload.status))throw Error('Situação inválida.');const contractCents=payload.contractCents==null?null:validCents(payload.contractCents,'um valor contratado');Object.assign(work,{name:checkWorkName(payload.name,workId),client:String(payload.client||'').trim().slice(0,120),notes:String(payload.notes||'').trim().slice(0,500),status:payload.status,contractCents});return copy(work);},
  async deleteWork(workId){const work=requireWork(workId);const linked=state.expenses.some(x=>x.workId===workId)||state.contracts.some(x=>x.workId===workId)||state.payments.some(x=>x.workId===workId)||(state.adjustments||[]).some(x=>x.workId===workId)||(state.additives||[]).some(x=>x.workId===workId)||(state.workCommitments||[]).some(x=>x.workId===workId)||(state.openingBalances||[]).some(x=>x.scope==='work'&&x.entityId===workId);if(linked)throw Error('Esta obra possui movimentações ou contratos. Para preservar o histórico, altere a situação para Encerrada em Editar obra.');state.works=state.works.filter(x=>x.id!==workId);return {id:workId};},
  async setContract(workId,contractCents){const w=requireWork(workId);if(contractCents!==null)validCents(contractCents,'um valor contratado');w.contractCents=contractCents;return copy(w);},
  async saveExpense(payload){const w=requireWork(payload.workId);const old=payload.id?state.expenses.find(e=>e.id===payload.id):null;if(payload.id&&!old)throw Error('Lançamento não encontrado.');if(w.status==='closed'&&(!old||old.workId!==w.id))throw Error('Reabra a obra para lançar novos gastos.');if(!Domain.dateValid(payload.date))throw Error('Informe uma data válida.');const description=text(payload.description,250,'a descrição do gasto');if(!Domain.categories.includes(payload.category))throw Error('Selecione a categoria.');validCents(payload.amountCents,'um valor');if(!['manual','text','file'].includes(payload.source))throw Error('Origem inválida.');const competence=String(payload.competence||payload.date.slice(0,7));if(!monthValid(competence))throw Error('Informe uma competência válida.');const entry={id:old?.id||id('gasto'),workId:w.id,date:payload.date,competence,description,category:payload.category,amountCents:payload.amountCents,supplier:String(payload.supplier||'').trim().slice(0,120),notes:String(payload.notes||'').trim().slice(0,1000),source:payload.source};if(old)Object.assign(old,entry);else state.expenses.push(entry);return copy(entry);},
  async deleteExpense(expenseId){const index=state.expenses.findIndex(e=>e.id===expenseId);if(index<0)throw Error('Lançamento não encontrado.');state.expenses.splice(index,1);return {id:expenseId};},

  async createPerson(payload){const type=payload.type;if(!['employee','contractor'].includes(type))throw Error('Selecione Funcionário ou Empreiteiro.');const salary=type==='employee'?validCents(payload.salaryCents,'um salário'):null;const person={id:id('pessoa'),type,name:checkPersonName(payload.name),role:text(payload.role,100,'a função'),salaryCents:salary,status:'active'};state.people.push(person);return copy(person);},
  async updatePerson(personId,payload){const person=requirePerson(personId);const type=payload.type||person.type;if(!['employee','contractor'].includes(type))throw Error('Tipo de pessoa inválido.');const salary=type==='employee'?validCents(payload.salaryCents,'um salário'):null;const status=payload.status||person.status;if(!['active','inactive'].includes(status))throw Error('Situação inválida.');Object.assign(person,{type,name:checkPersonName(payload.name,personId),role:text(payload.role,100,'a função'),salaryCents:salary,status});return copy(person);},

  async deletePerson(personId){const person=requirePerson(personId);const linked=state.contracts.some(x=>x.personId===personId)||state.payments.some(x=>x.personId===personId)||(state.adjustments||[]).some(x=>x.personId===personId)||(state.employeeDebts||[]).some(x=>x.personId===personId)||(state.contractorAdvances||[]).some(x=>x.personId===personId)||(state.openingBalances||[]).some(x=>x.scope==='person'&&x.entityId===personId);if(linked)throw Error('Este cadastro possui histórico financeiro. Para preservar os registros, altere a situação para Inativo em Editar cadastro.');state.people=state.people.filter(x=>x.id!==personId);return {id:personId};},

  async createContract(payload){const person=requirePerson(payload.personId);if(person.type!=='contractor')throw Error('Contratos de empreitada só podem ser vinculados a empreiteiros.');const work=requireWork(payload.workId);if(work.status==='closed')throw Error('A obra está encerrada. Reabra-a para criar um novo contrato.');const quantity=Number(String(payload.quantity??'').replace(',','.'));if(!Number.isFinite(quantity)||quantity<=0)throw Error('Informe uma quantidade maior que zero.');const contract={id:id('contrato'),personId:person.id,workId:work.id,service:text(payload.service,160,'o serviço contratado'),quantity,unit:text(payload.unit,30,'a unidade'),contractCents:validCents(payload.contractCents,'um valor de contrato'),status:'active'};state.contracts.push(contract);return copy(contract);},
  async updateContract(contractId,payload){const contract=requireContract(contractId);const person=requirePerson(contract.personId);if(person.type!=='contractor')throw Error('Contrato inválido.');const work=requireWork(payload.workId||contract.workId);const quantity=Number(String(payload.quantity??'').replace(',','.'));if(!Number.isFinite(quantity)||quantity<=0)throw Error('Informe uma quantidade maior que zero.');const status=payload.status||contract.status;if(!['active','closed'].includes(status))throw Error('Situação inválida.');Object.assign(contract,{workId:work.id,service:text(payload.service,160,'o serviço contratado'),quantity,unit:text(payload.unit,30,'a unidade'),contractCents:validCents(payload.contractCents,'um valor de contrato'),status});return copy(contract);},

  async deleteContract(contractId){const contract=requireContract(contractId);const linked=state.payments.some(x=>x.contractId===contractId)||(state.additives||[]).some(x=>x.contractId===contractId)||(state.adjustments||[]).some(x=>x.contractId===contractId)||(state.contractorAdvances||[]).some(x=>x.contractId===contractId)||(state.openingBalances||[]).some(x=>x.scope==='contract'&&x.entityId===contractId);if(linked)throw Error('Este contrato possui pagamentos, aditivos ou descontos. Para preservar o histórico, altere a situação para Concluído.');state.contracts=state.contracts.filter(x=>x.id!==contractId);return {id:contractId};},

  async savePayment(payload){const person=requirePerson(payload.personId);const old=payload.id?state.payments.find(p=>p.id===payload.id):null;if(payload.id&&!old)throw Error('Pagamento não encontrado.');if(!Domain.dateValid(payload.date))throw Error('Informe uma data válida.');validCents(payload.amountCents,'um valor de pagamento');const competence=String(payload.competence||payload.date.slice(0,7));if(!monthValid(competence))throw Error('Informe uma competência válida.');let contractId=null,workId=payload.workId||null;if(person.type==='contractor'){const contract=requireContract(payload.contractId);if(contract.personId!==person.id)throw Error('O contrato selecionado não pertence a este empreiteiro.');contractId=contract.id;workId=contract.workId;}else if(workId){requireWork(workId);}const entry={id:old?.id||id('pag'),personId:person.id,contractId,workId,date:payload.date,competence,amountCents:payload.amountCents,reference:text(payload.reference,180,'a referência do pagamento'),method:text(payload.method,40,'a forma de pagamento'),kind:text(payload.kind,60,'o tipo de pagamento')};if(old)Object.assign(old,entry);else state.payments.push(entry);return copy(entry);},
  async deletePayment(paymentId){const index=state.payments.findIndex(p=>p.id===paymentId);if(index<0)throw Error('Pagamento não encontrado.');state.payments.splice(index,1);state.employeeDebts=(state.employeeDebts||[]).filter(d=>d.sourcePaymentId!==paymentId);state.contractorAdvances=(state.contractorAdvances||[]).filter(d=>d.sourcePaymentId!==paymentId);return {id:paymentId};},
  async syncEmployeeDebtPlan(payload){
    const person=requirePerson(payload.personId),payment=state.payments.find(p=>p.id===payload.sourcePaymentId);
    if(person.type!=='employee')throw Error('Saldo devedor parcelado é exclusivo de funcionários.');
    if(!payment||payment.personId!==person.id)throw Error('Pagamento de origem do saldo devedor não encontrado.');
    state.employeeDebts=state.employeeDebts||[];
    const previous=state.employeeDebts.find(d=>d.sourcePaymentId===payment.id);
    state.employeeDebts=state.employeeDebts.filter(d=>d.sourcePaymentId!==payment.id);
    const total=Number(payload.totalCents||0);
    if(!Number.isSafeInteger(total)||total<0||total>1e14)throw Error('Saldo devedor inválido.');
    if(total===0)return null;
    const count=Number(payload.installmentCount);
    if(!Number.isInteger(count)||count<1||count>60)throw Error('Escolha entre 1 e 60 parcelas.');
    const startMonth=String(payload.startMonth||'');if(!monthValid(startMonth))throw Error('Competência inicial do parcelamento inválida.');
    const base=Math.floor(total/count),remainder=total-base*count;
    const schedule=Array.from({length:count},(_,i)=>({index:i+1,month:addMonth(startMonth,i),amountCents:base+(i<remainder?1:0)}));
    const plan={id:previous?.id||id('divida'),personId:person.id,sourcePaymentId:payment.id,createdDate:payload.createdDate||payment.date,totalCents:total,installmentCount:count,startMonth,schedule,status:'active'};
    state.employeeDebts.push(plan);return copy(plan);
  },

  async syncContractorAdvancePlan(payload){
    const person=requirePerson(payload.personId),payment=state.payments.find(p=>p.id===payload.sourcePaymentId);
    if(person.type!=='contractor')throw Error('Compensação de adiantamento é exclusiva de empreiteiros.');
    if(!payment||payment.personId!==person.id)throw Error('Pagamento de origem do adiantamento não encontrado.');
    const contract=requireContract(payment.contractId);state.contractorAdvances=state.contractorAdvances||[];
    const previous=state.contractorAdvances.find(d=>d.sourcePaymentId===payment.id);state.contractorAdvances=state.contractorAdvances.filter(d=>d.sourcePaymentId!==payment.id);
    const total=Number(payload.totalCents||0);if(!Number.isSafeInteger(total)||total<0||total>1e14)throw Error('Valor de adiantamento inválido.');if(total===0)return null;
    const count=Number(payload.installmentCount);if(!Number.isInteger(count)||count<1||count>60)throw Error('Escolha entre 1 e 60 competências para compensação.');
    const startMonth=String(payload.startMonth||'');if(!monthValid(startMonth))throw Error('Competência inicial da compensação inválida.');
    const base=Math.floor(total/count),remainder=total-base*count;const schedule=Array.from({length:count},(_,i)=>({index:i+1,month:addMonth(startMonth,i),amountCents:base+(i<remainder?1:0)}));
    const plan={id:previous?.id||id('adiant'),personId:person.id,contractId:contract.id,workId:contract.workId,sourcePaymentId:payment.id,createdDate:payload.createdDate||payment.date,totalCents:total,installmentCount:count,startMonth,schedule,status:'active'};state.contractorAdvances.push(plan);return copy(plan);
  },

  async saveWorkCommitment(payload){
    const work=requireWork(payload.workId),old=payload.id?(state.workCommitments||[]).find(c=>c.id===payload.id):null;if(payload.id&&!old)throw Error('Compromisso não encontrado.');
    const competence=String(payload.competence||'');if(!monthValid(competence))throw Error('Informe a competência do compromisso.');
    const dueDate=String(payload.dueDate||'');if(dueDate&&!Domain.dateValid(dueDate))throw Error('Informe uma data de vencimento válida.');
    if(!Domain.categories.includes(payload.category))throw Error('Selecione a categoria.');
    const entry={id:old?.id||id('comp'),workId:work.id,competence,dueDate,description:text(payload.description,220,'a descrição do compromisso'),category:payload.category,amountCents:validCents(payload.amountCents,'um valor'),status:old?.status||'planned',sourceExpenseId:old?.sourceExpenseId||null};
    state.workCommitments=state.workCommitments||[];if(old)Object.assign(old,entry);else state.workCommitments.push(entry);return copy(entry);
  },
  async settleWorkCommitment(commitmentId,payload={}){
    const item=(state.workCommitments||[]).find(c=>c.id===commitmentId);if(!item)throw Error('Compromisso não encontrado.');if(item.status==='paid')throw Error('Este compromisso já foi realizado.');const work=requireWork(item.workId);
    const date=String(payload.date||new Date().toISOString().slice(0,10));if(!Domain.dateValid(date))throw Error('Informe uma data de pagamento válida.');const competence=String(payload.competence||item.competence);if(!monthValid(competence))throw Error('Informe uma competência válida.');
    const expense={id:id('gasto'),workId:work.id,date,competence,description:item.description,category:item.category,amountCents:item.amountCents,supplier:'',notes:'Realizado a partir de compromisso programado.',source:'manual'};state.expenses.push(expense);item.status='paid';item.paidDate=date;item.sourceExpenseId=expense.id;return {commitment:copy(item),expense:copy(expense)};
  },
  async deleteWorkCommitment(commitmentId){const index=(state.workCommitments||[]).findIndex(c=>c.id===commitmentId);if(index<0)throw Error('Compromisso não encontrado.');const item=state.workCommitments[index];if(item.status==='paid')throw Error('Compromisso já realizado não pode ser excluído por aqui. Exclua o gasto realizado, se necessário.');state.workCommitments.splice(index,1);return {id:commitmentId};},

  async createAdditive(payload){const contract=requireContract(payload.contractId);const person=requirePerson(contract.personId);const work=requireWork(contract.workId);if(person.type!=='contractor')throw Error('Aditivos só podem ser vinculados a contratos de empreiteiro.');if(!Domain.dateValid(payload.date))throw Error('Informe uma data válida.');const competence=String(payload.competence||payload.date.slice(0,7));if(!monthValid(competence))throw Error('Informe uma competência válida.');const additive={id:id('aditivo'),contractId:contract.id,personId:person.id,workId:work.id,date:payload.date,competence,amountCents:validCents(payload.amountCents,'um valor de aditivo'),description:text(payload.description,180,'a descrição do aditivo')};state.additives.push(additive);return copy(additive);},
  async deleteAdditive(additiveId){const index=state.additives.findIndex(a=>a.id===additiveId);if(index<0)throw Error('Aditivo não encontrado.');state.additives.splice(index,1);return {id:additiveId};},

  async saveAdjustment(payload){const person=requirePerson(payload.personId);const old=payload.id?state.adjustments.find(a=>a.id===payload.id):null;if(payload.id&&!old)throw Error('Desconto/gasto não encontrado.');if(!Domain.dateValid(payload.date))throw Error('Informe uma data válida.');validCents(payload.amountCents,'um valor de desconto/gasto');const scope=payload.scope==='company'?'company':'work';let contractId=null,workId=null;if(scope==='work'){if(person.type==='contractor'){const contract=requireContract(payload.contractId);if(contract.personId!==person.id)throw Error('O contrato selecionado não pertence a este empreiteiro.');contractId=contract.id;workId=contract.workId;}else{workId=payload.workId||null;if(!workId)throw Error('Selecione a obra para este gasto.');requireWork(workId);}}const competence=String(payload.competence||payload.date.slice(0,7));if(!monthValid(competence))throw Error('Informe uma competência válida.');const entry={id:old?.id||id('desc'),personId:person.id,contractId,workId,scope,date:payload.date,competence,amountCents:payload.amountCents,description:text(payload.description,180,'a descrição do desconto/gasto'),kind:text(payload.kind||'Outro',60,'o tipo')};if(old)Object.assign(old,entry);else state.adjustments.push(entry);return copy(entry);},
  async deleteAdjustment(adjustmentId){const index=state.adjustments.findIndex(a=>a.id===adjustmentId);if(index<0)throw Error('Desconto/gasto não encontrado.');state.adjustments.splice(index,1);return {id:adjustmentId};},

  async resetDemo(){if(AppSettings?.get?.().connection?.enabled)throw Error('Desconecte a planilha antes de restaurar os dados de demonstração.');state=seed();return copy(state);}
 };

 const arrayKeys=['works','expenses','people','contracts','payments','additives','employeeDebts','contractorAdvances','workCommitments','adjustments','openingBalances'];
 const emptyState=()=>Object.fromEntries([['schemaVersion',12],...arrayKeys.map(k=>[k,[]])]);
 const normalizeRemote=input=>{const out=emptyState();if(!input||typeof input!=='object')return out;out.schemaVersion=Number(input.schemaVersion||12);arrayKeys.forEach(k=>out[k]=Array.isArray(input[k])?copy(input[k]):[]);return out;};
 const configuredUrl=()=>{try{const c=AppSettings?.get?.().connection;return c?.enabled?String(c.url||'').trim():'';}catch(_){return '';}};
 const calendarYear=()=>Number(new Date().getFullYear());
 const AUTO_SYNC_MS=30000;
 const LOCAL_PREFIX='financeiroIntegra.remoteCache.v1.0.';
 let activeUrl='',dataYear=calendarYear(),operationalYear=calendarYear(),availableYears=[calendarYear()],queue=[],lastRevision=null,lastSuccessfulSyncAt='',lastAttemptAt='',syncing=false,syncTimer=null,hasLocalSnapshot=false,consecutiveFailures=0,didInitialSync=false;

 function urlHash(value){let h=2166136261,s=String(value||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
 function cacheKey(url,year){return LOCAL_PREFIX+urlHash(url)+'.'+String(year);}
 function loadLocal(url,year){hasLocalSnapshot=false;queue=[];lastRevision=null;lastSuccessfulSyncAt='';lastAttemptAt='';try{const raw=localStorage.getItem(cacheKey(url,year));if(!raw)return false;const saved=JSON.parse(raw);if(!saved||saved.url!==url||Number(saved.year)!==Number(year)||!saved.state)return false;state=normalizeRemote(saved.state);queue=Array.isArray(saved.queue)?saved.queue:[];lastRevision=Number.isFinite(Number(saved.lastRevision))?Number(saved.lastRevision):null;lastSuccessfulSyncAt=String(saved.lastSuccessfulSyncAt||'');lastAttemptAt=String(saved.lastAttemptAt||'');hasLocalSnapshot=true;return true;}catch(_){return false;}}
 function persistLocal(){if(!activeUrl)return;try{localStorage.setItem(cacheKey(activeUrl,dataYear),JSON.stringify({version:1,url:activeUrl,year:dataYear,state,queue,lastRevision,lastSuccessfulSyncAt,lastAttemptAt,savedAt:new Date().toISOString()}));hasLocalSnapshot=true;}catch(err){console.warn('Financeiro: não foi possível persistir a cópia local.',err);}}
 function notifyConnection(){try{window.dispatchEvent(new CustomEvent('financeiro:connection',{detail:repo.getConnectionInfo()}));}catch(_){}}
 function notifyData(){try{window.dispatchEvent(new CustomEvent('financeiro:data',{detail:{source:'remote',year:dataYear}}));}catch(_){}}
 function absorbMeta(packet){if(!packet||typeof packet!=='object')return;const ay=Number(packet.activeYear||0);if(Number.isInteger(ay)&&ay>=2000&&ay<=2200)operationalYear=ay;const yrs=Array.isArray(packet.availableYears)?packet.availableYears.map(Number).filter(y=>Number.isInteger(y)&&y>=2000&&y<=2200):[];if(yrs.length)availableYears=[...new Set(yrs)].sort((a,b)=>a-b);if(!availableYears.includes(operationalYear))availableYears.push(operationalYear),availableYears.sort((a,b)=>a-b);}
 function markHealthy(){consecutiveFailures=0;repo.mode='remote';repo.lastSyncError='';lastSuccessfulSyncAt=new Date().toISOString();persistLocal();notifyConnection();}
 function markFailure(err){repo.lastSyncError=err?.message||String(err||'Falha de conexão.');consecutiveFailures++;if(navigator.onLine===false||consecutiveFailures>=2)repo.mode='offline';notifyConnection();}
 function resetYearContext(year){dataYear=Number(year)||calendarYear();state=emptyState();queue=[];lastRevision=null;lastSuccessfulSyncAt='';lastAttemptAt='';hasLocalSnapshot=false;didInitialSync=false;if(activeUrl)loadLocal(activeUrl,dataYear);}
 function ensureContext(){const url=configuredUrl();if(!url){activeUrl='';hasLocalSnapshot=false;queue=[];lastRevision=null;repo.mode='demo';repo.lastSyncError='';operationalYear=calendarYear();availableYears=[operationalYear];dataYear=operationalYear;return '';}if(url!==activeUrl){activeUrl=url;operationalYear=calendarYear();availableYears=[operationalYear];resetYearContext(operationalYear);repo.mode=navigator.onLine===false?'offline':'remote';repo.lastSyncError='';consecutiveFailures=0;notifyConnection();}return url;}
 function sameRecord(a,b){try{return JSON.stringify(a)===JSON.stringify(b);}catch(_){return false;}}
 function buildChanges(before,after){const changes=[];arrayKeys.forEach(key=>{const prev=new Map((before?.[key]||[]).map(item=>[String(item.id),item]));const next=new Map((after?.[key]||[]).map(item=>[String(item.id),item]));prev.forEach((item,id)=>{if(!next.has(id))changes.push({table:key,op:'delete',id});});next.forEach((item,id)=>{const old=prev.get(id);if(!old)changes.push({table:key,op:'insert',record:copy(item)});else if(!sameRecord(old,item))changes.push({table:key,op:'update',record:copy(item)});});});return changes;}
 function changeId(ch){return String(ch?.id||ch?.record?.id||'');}
 function compactQueue(input){const out=[],pos=new Map();(input||[]).forEach(raw=>{const ch=copy(raw),id=changeId(ch),key=String(ch.table||'')+'|'+id;if(!ch.table||!id)return;if(!pos.has(key)){pos.set(key,out.length);out.push(ch);return;}const i=pos.get(key),prev=out[i];if(!prev){pos.set(key,out.length);out.push(ch);return;}if(prev.op==='insert'&&ch.op==='delete'){out[i]=null;pos.delete(key);return;}if(prev.op==='insert'&&(ch.op==='update'||ch.op==='upsert')){out[i]={table:ch.table,op:'insert',record:copy(ch.record)};return;}if((prev.op==='update'||prev.op==='upsert')&&(ch.op==='update'||ch.op==='upsert')){out[i]={table:ch.table,op:prev.op==='upsert'?'upsert':'update',record:copy(ch.record)};return;}if(ch.op==='delete'){out[i]={table:ch.table,op:'delete',id};return;}if(prev.op==='delete'&&(ch.op==='insert'||ch.op==='update'||ch.op==='upsert')){out[i]={table:ch.table,op:'upsert',record:copy(ch.record)};return;}out[i]=ch;});return out.filter(Boolean);}
 function enqueue(changes){if(!changes?.length)return;queue=compactQueue([...queue,...changes]);persistLocal();}
 function applyQueuedChange(target,ch){const key=String(ch.table||''),arr=target[key];if(!Array.isArray(arr))return;const id=changeId(ch);if(!id)return;const index=arr.findIndex(x=>String(x.id)===id);if(ch.op==='delete'){if(index>=0)arr.splice(index,1);return;}const record=copy(ch.record||{});if(index>=0)arr[index]=record;else arr.push(record);}
 function overlayQueue(remote){const merged=normalizeRemote(remote);queue.forEach(ch=>applyQueuedChange(merged,ch));return merged;}
 async function pullRemote(required=false){const url=ensureContext();if(!url)return false;try{const packet=await DataConnection.getState(url,dataYear),remote=packet?.state||packet?.data||packet;absorbMeta(packet);state=queue.length?overlayQueue(remote):normalizeRemote(remote);if(Number.isFinite(Number(packet?.revision)))lastRevision=Number(packet.revision);lastAttemptAt=new Date().toISOString();markHealthy();persistLocal();notifyData();return true;}catch(err){lastAttemptAt=new Date().toISOString();markFailure(err);persistLocal();if(required)throw Error('Sem conexão com a planilha: '+repo.lastSyncError);return false;}}
 async function flushQueue(url){if(!queue.length)return {applied:0,revision:lastRevision};if(dataYear!==operationalYear)throw Error('Ano arquivado é somente para consulta.');let total=0;while(queue.length){const batch=queue.slice(0,100),result=await DataConnection.syncBatch(url,batch,lastRevision,dataYear);absorbMeta(result);queue.splice(0,batch.length);total+=Number(result.applied||batch.length);if(Number.isFinite(Number(result.revision)))lastRevision=Number(result.revision);persistLocal();}return {applied:total,revision:lastRevision};}
 async function syncNow(options={}){const url=ensureContext();if(!url||syncing)return false;if(navigator.onLine===false){repo.mode='offline';notifyConnection();return false;}syncing=true;lastAttemptAt=new Date().toISOString();try{const status=await DataConnection.syncStatus(url,dataYear);absorbMeta(status);const remoteRevision=Number(status.revision||0);if(lastRevision===null||remoteRevision!==Number(lastRevision))await pullRemote(true);if(queue.length&&dataYear===operationalYear)await flushQueue(url);if(options.forcePull)await pullRemote(true);markHealthy();return true;}catch(err){markFailure(err);persistLocal();return false;}finally{syncing=false;}}
 function scheduleAutoSync(){if(syncTimer){clearInterval(syncTimer);syncTimer=null;}if(!configuredUrl())return;syncTimer=setInterval(()=>{syncNow();},AUTO_SYNC_MS);}
 function scheduleSoon(){if(!configuredUrl())return;if(!syncTimer)scheduleAutoSync();}

 const localGet=repo.getDashboard.bind(repo);
 repo.getDashboard=async function(){const url=ensureContext();if(!url){repo.mode='demo';return localGet();}if(!hasLocalSnapshot){await pullRemote(true);didInitialSync=true;}scheduleSoon();if(!didInitialSync){didInitialSync=true;setTimeout(()=>syncNow(),350);}return copy(state);};
 const mutators=['createWork','updateWork','deleteWork','setContract','saveExpense','deleteExpense','createPerson','updatePerson','deletePerson','createContract','updateContract','deleteContract','savePayment','deletePayment','syncEmployeeDebtPlan','syncContractorAdvancePlan','saveWorkCommitment','settleWorkCommitment','deleteWorkCommitment','createAdditive','deleteAdditive','saveAdjustment','deleteAdjustment'];
 mutators.forEach(name=>{const local=repo[name].bind(repo);repo[name]=async function(...args){const url=ensureContext();if(!url)return local(...args);if(dataYear!==operationalYear)throw Error(`O ano ${dataYear} está arquivado e disponível somente para consulta.`);if(!hasLocalSnapshot)await pullRemote(true);const before=copy(state),result=await local(...args),changes=buildChanges(before,state);enqueue(changes);persistLocal();scheduleSoon();return result;};});
 repo.setDataYear=async year=>{ensureContext();let target=Number(year);if(!Number.isInteger(target)||target<2000||target>2200)throw Error('Ano inválido.');if(target>operationalYear)target=operationalYear;if(target===dataYear)return copy(state);if(!availableYears.includes(target))throw Error(`Não existe base cadastrada para ${target}.`);persistLocal();if(queue.length&&dataYear===operationalYear)syncNow();resetYearContext(target);await pullRemote(true);return copy(state);};
 repo.syncFromRemote=async()=>{ensureContext();await syncNow({forcePull:true});return copy(state);};
 repo.pushCurrentToRemote=async()=>{const url=ensureContext();if(!url)throw Error('Configure a URL do Apps Script primeiro.');if(dataYear!==operationalYear)throw Error('Ano arquivado é somente para consulta.');if(!hasLocalSnapshot)await pullRemote(true);const remote=await DataConnection.getState(url,dataYear),before=normalizeRemote(remote.state||remote.data||remote),changes=buildChanges(before,state);enqueue(changes);await syncNow();return copy(state);};
 repo.syncNow=syncNow;repo.getPendingCount=()=>queue.length;repo.getDataYear=()=>dataYear;repo.getOperationalYear=()=>operationalYear;repo.getAvailableYears=()=>[...availableYears];repo.isHistoricalYear=()=>dataYear<operationalYear;
 repo.getConnectionInfo=()=>({mode:repo.mode,lastSyncError:repo.lastSyncError||'',url:configuredUrl(),pendingCount:queue.length,lastSuccessfulSyncAt,lastAttemptAt,revision:lastRevision,syncIntervalMs:AUTO_SYNC_MS,dataYear,operationalYear,availableYears:[...availableYears]});
 repo.mode='demo';repo.lastSyncError='';window.Repository=repo;
 window.addEventListener('online',()=>{ensureContext();repo.mode='remote';notifyConnection();syncNow();scheduleAutoSync();});window.addEventListener('offline',()=>{if(configuredUrl()){repo.mode='offline';notifyConnection();}});window.addEventListener('focus',()=>{if(configuredUrl())syncNow();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&configuredUrl())syncNow();});if(configuredUrl())scheduleAutoSync();
})();
