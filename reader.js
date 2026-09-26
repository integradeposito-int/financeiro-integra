/* Local reading only. No document is uploaded or archived. */
(function(){
 const D=Domain,normal=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const clean=s=>String(s||'').replace(/\s+/g,' ').replace(/^[\s:;|–—-]+|[\s:;|–—-]+$/g,'').trim();

 async function extractText(raw){
  const text=String(raw||'').replace(/\r/g,'').replace(/[\t ]+/g,' '),lines=text.split('\n').map(s=>s.trim()).filter(Boolean),normLines=lines.map(normal),normText=normal(text);
  const isInvoice=/\b(?:danfe|nf[- ]?e|nfe|nota\s+fiscal)\b/.test(normText),isReceipt=!isInvoice&&/\b(?:pix|comprovante|recibo|transferencia|pagamento)\b/.test(normText);
  const r={description:'',date:'',amountCents:null,supplier:'',category:'',warnings:[],text,documentType:isInvoice?'invoice':isReceipt?'receipt':'generic'};
  const moneyRe=/(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/gi;
  const dateRe=/\b(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})\b/g;

  function moneyIn(value){
   const out=[];for(const m of String(value||'').matchAll(moneyRe)){const n=D.parseMoney(m[1]);if(n!==null&&n>0)out.push({value:n,index:m.index||0,raw:m[0]});}return out;
  }
  function dateIn(value){
   const out=[];for(const m of String(value||'').matchAll(dateRe)){const iso=`${m[3]}-${m[2]}-${m[1]}`;if(D.dateValid(iso))out.push(iso);}return out;
  }
  function bestCandidate(candidates,minGap=1){
   if(!candidates.length)return null;
   const byValue=new Map();for(const c of candidates){const old=byValue.get(c.value);if(!old||c.score>old.score)byValue.set(c.value,c);}
   const sorted=[...byValue.values()].sort((a,b)=>b.score-a.score);
   if(sorted.length===1)return sorted[0].value;
   if(sorted[0].score>=sorted[1].score+minGap)return sorted[0].value;
   return null;
  }
  const addCandidate=(arr,value,score)=>{if(value!==null&&value!==undefined&&value!=='')arr.push({value,score});};

  // VALOR: nota fiscal prioriza o total da NF-e; recibo/Pix prioriza valor pago/transferido.
  const amountCandidates=[];
  const strongAmount=[
   [220,/(?:valor\s+total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe)|v\.?\s*total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe)|total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe)|valor\s+total\s+do\s+documento|total\s+do\s+documento)/i],
   [210,/(?:valor\s+(?:da\s+)?transa[cç][aã]o|valor\s+(?:do\s+)?pagamento|valor\s+pago|valor\s+transferido|valor\s+enviado|total\s+pago)/i],
   [185,/(?:valor\s+a\s+pagar|total\s+a\s+pagar|valor\s+l[ií]quido|total\s+geral)/i],
   [135,/(?:valor\s+total\s+dos\s+servi[cç]os|valor\s+do\s+servi[cç]o|valor\s+total)/i],
   [80,/(?:valor\s+total\s+dos\s+produtos|total\s+dos\s+produtos|total\s+produtos)/i]
  ];
  const amountNoise=/(?:base\s+de\s+c[aá]lculo|icms|ipi|pis|cofins|tribut|imposto|frete|seguro|desconto|troco|aprox|valor\s+unit[aá]rio)/i;
  for(let i=0;i<lines.length;i++){
   const line=lines[i],norm=normLines[i];
   if(isReceipt){
    const m=line.match(/(?:^|\b)valor\s*[:\-]?\s*(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\b/i);
    if(m){const n=D.parseMoney(m[1]);addCandidate(amountCandidates,n,230);}
   }
   for(const [score,re] of strongAmount){
    const match=re.exec(line);if(!match)continue;
    const after=moneyIn(line.slice((match.index||0)+match[0].length));
    if(after.length)addCandidate(amountCandidates,after[0].value,score+15);
    else{
     const same=moneyIn(line);
     if(same.length===1)addCandidate(amountCandidates,same[0].value,score+8);
     for(let j=i+1;j<Math.min(lines.length,i+4);j++){
      if(amountNoise.test(normLines[j])&&moneyIn(lines[j]).length<2)continue;
      const vals=moneyIn(lines[j]);if(!vals.length)continue;
      let pick=vals[0];
      if(vals.length>1){
       const ratio=(match.index||0)/Math.max(line.length,1);
       const idx=Math.max(0,Math.min(vals.length-1,Math.round(ratio*(vals.length-1))));
       pick=vals[idx];
       if(/total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe)|valor\s+total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe)/i.test(match[0])&&ratio>.45)pick=vals[vals.length-1];
      }
      addCandidate(amountCandidates,pick.value,score-(j-i));
      break;
     }
   }
  }
  }
  const nearPatterns=[
   [245,/(?:valor\s+total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe)|v\.?\s*total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe)|total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe))[^\d\n]{0,70}(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi],
   [235,/(?:valor\s+(?:da\s+)?transa[cç][aã]o|valor\s+(?:do\s+)?pagamento|valor\s+pago|valor\s+transferido|valor\s+enviado|total\s+pago)[^\d\n]{0,70}(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi]
  ];
  for(const [score,re] of nearPatterns)for(const m of text.matchAll(re)){const n=D.parseMoney(m[1]);addCandidate(amountCandidates,n,score);}
  r.amountCents=bestCandidate(amountCandidates,2);
  if(r.amountCents===null){
   const all=[...new Set(moneyIn(text).map(x=>x.value))];
   if(all.length===1)r.amountCents=all[0];
   else if(all.length>1)r.warnings.push('Há vários valores no documento e o total não ficou claro. Confira o valor do gasto.');
  }
  if(r.amountCents===null&&!r.warnings.some(x=>/valor/i.test(x)))r.warnings.push('Valor não identificado com segurança. Confira o valor do gasto.');

  // DATA: NF-e prioriza emissão; recibo/Pix prioriza a data da transação/pagamento.
  const dateCandidates=[];
  const dateScoreLine=n=>{
   if(/data(?:\s*\/\s*hora)?\s+(?:d[ae]\s+)?emiss[aã]o|emitid[ao]\s+em|emiss[aã]o/.test(n))return 190;
   if(/data\s+(?:da|do)\s+(?:transa[cç][aã]o|pagamento|pix)|realizad[oa]\s+em|efetuad[oa]\s+em/.test(n))return 185;
   if(isReceipt&&/^data\b/.test(n))return 150;
   if(/data\s+(?:da|do)\s+(?:nota|documento)/.test(n))return 135;
   if(/data\s+do\s+fato|compet[eê]ncia/.test(n))return 90;
   if(/vencimento|entrada\s*\/\s*sa[ií]da|data\s+de\s+sa[ií]da|autoriza[cç][aã]o|protocolo/.test(n))return -40;
   if(/\bdata\b/.test(n))return 25;
   return 0;
  };
  const strongDate=/(?:data(?:\s*\/\s*hora)?\s+(?:d[ae]\s+)?emiss[aã]o|emitid[ao]\s+em|data\s+(?:da|do)\s+(?:transa[cç][aã]o|pagamento|pix)|realizad[oa]\s+em|efetuad[oa]\s+em)[^\d]{0,35}(\d{2}[\/.\-]\d{2}[\/.\-]\d{4})/gi;
  for(const m of text.matchAll(strongDate)){const ds=dateIn(m[1]);if(ds[0])addCandidate(dateCandidates,ds[0],230);}
  for(let i=0;i<lines.length;i++){
   const base=dateScoreLine(normLines[i]),own=dateIn(lines[i]);own.forEach(v=>addCandidate(dateCandidates,v,base+(base>0?10:0)));
   if(base>=90&&!own.length){for(let j=i+1;j<Math.min(lines.length,i+3);j++)dateIn(lines[j]).forEach(v=>addCandidate(dateCandidates,v,base-(j-i)));}
  }
  if(!dateCandidates.length){const all=[...new Set(dateIn(text))];if(all.length===1)addCandidate(dateCandidates,all[0],10);}
  r.date=bestCandidate(dateCandidates,2)||'';
  if(!r.date)r.warnings.push('Data do documento não identificada com segurança. Confira a data do gasto.');

  // FORNECEDOR / PRESTADOR: só preenche quando há um indício forte. É melhor deixar em branco do que inserir um texto fiscal errado.
  const supplierCandidates=[];
  const badSupplier=/^(?:danfe|nf-?e|nfe|nota\s+fiscal|documento\s+auxiliar|identifica[cç][aã]o\s+do\s+emitente|emitente|fornecedor|loja|raz[aã]o\s+social|nome\s*\/\s*raz[aã]o\s+social|cnpj|cpf|inscri[cç][aã]o|endere[cç]o|rua\b|avenida\b|av\.|telefone|fone|chave\s+de\s+acesso|consulta|protocolo|data\b|valor\b|total\b|cliente|destinat[aá]rio|recebemos\b|recibo\b|comprovante\b|pagamento\b|transfer[eê]ncia\b|pix\b|pagador\b|natureza\s+da\s+opera[cç][aã]o|venda\b|inscri[cç][aã]o\b|dados\s+adicionais|informa[cç][oõ]es\b)/i;
  const plausibleSupplier=s=>{s=clean(s);return s.length>=3&&s.length<=120&&/[A-Za-zÀ-ÿ]/.test(s)&&!badSupplier.test(s)&&!/^[\d\W]+$/.test(s)&&!/(?:chave|protocolo|autoriza[cç][aã]o|substitu[ií]d|tribut[aá]ri|opera[cç][aã]o|destinat[aá]rio)/i.test(s);};
  function addSupplier(value,score){value=clean(value).replace(/\s+(?:CNPJ|CPF)\s*[:\-].*$/i,'');if(plausibleSupplier(value))addCandidate(supplierCandidates,value,score);}
  for(let i=0;i<lines.length;i++){
   const line=lines[i],n=normLines[i];
   let m=line.match(/(?:fornecedor|emitente|loja|raz[aã]o\s+social|nome\s+empresarial|favorecid[oa]|benefici[aá]ri[oa]|recebedor(?:a)?|prestador(?:a)?|profissional)\s*[:|\-]\s*(.+)$/i);
   if(m)addSupplier(m[1],230);
   if(/identifica[cç][aã]o\s+do\s+emitente|dados\s+do\s+emitente/.test(n)){
    for(let j=i+1;j<Math.min(lines.length,i+5);j++){
     if(/\b(?:ltda|eireli|me|epp|s\/?a|sa)\b/i.test(lines[j]))addSupplier(lines[j],205-(j-i));
     else if(j===i+1)addSupplier(lines[j],165);
    }
   }
  }
  if(isInvoice){
   for(let i=0;i<Math.min(lines.length,28);i++)if(/\b(?:ltda|eireli|epp|s\/?a)\b/i.test(lines[i]))addSupplier(lines[i],180-i/10);
  }
  r.supplier=bestCandidate(supplierCandidates,3)||'';

  // DESCRIÇÃO: nota fiscal tenta o item; recibo só usa uma descrição que realmente apareça no documento.
  const descMatch=text.match(/(?:descri[cç][aã]o|servi[cç]o|compra|objeto|finalidade|mensagem)\s*:\s*([^\n]+)/i);
  const descHeader=normLines.findIndex(s=>/descri[cç][aã]o.*(?:produto|servi[cç]o)|produto\s*\/\s*servi[cç]o/.test(s));
  if(descMatch)r.description=clean(descMatch[1]).slice(0,250);
  else if(isInvoice&&descHeader>=0){
   const items=[];
   for(let i=descHeader+1;i<Math.min(lines.length,descHeader+10);i++){
    const s=clean(lines[i]),n=normal(s);
    if(/(?:natureza da operacao|calculo do imposto|transportador|dados adicionais|informacoes complementares|inscricao estadual|base de calculo|valor do frete)/.test(n))break;
    if(!s||/(ncm|cfop|cst|csosn|unid|quant|valor unit|valor total|bc icms|aliq|codigo|cod\.?\s*prod)/.test(n))continue;
    if(/^[\d.,\s\-/]+$/.test(s)||moneyIn(s).length>=2)continue;
    const item=s.replace(/^\d{1,14}\s+/, '');
    if(item.length>=3)items.push(item);if(items.length>=2)break;
   }
   r.description=items.join('; ').slice(0,250);
  }

  // CATEGORIA: em recibo/Pix não usa o nome do favorecido para adivinhar o serviço.
  let categorySource='';
  if(isReceipt){
   const context=lines.filter((s,i)=>/(?:descri[cç][aã]o|observa[cç][aã]o|mensagem|finalidade|referente|servi[cç]o|mao\s+de\s+obra|material|frete|loca[cç][aã]o)/i.test(normLines[i]));
   categorySource=normal([r.description,...context].filter(Boolean).join('\n'));
  }else categorySource=normal(r.description||text);
  const scores={Material:0,'Mão de obra':0,'Serviços':0,Transporte:0,Equipamentos:0};
  const hit=(name,re,weight)=>{const m=categorySource.match(re);if(m)scores[name]+=weight*(m.length||1);};
  hit('Equipamentos',/\b(?:locacao|aluguel)\b/g,6);hit('Equipamentos',/\b(?:andaime|betoneira|guindaste|munck|escavadeira|retroescavadeira|compactador|martelete|equipamento|maquina)\w*/g,4);
  hit('Transporte',/\b(?:frete|transporte|carreto|transportadora)\w*/g,8);
  hit('Mão de obra',/\bmao\s+de\s+obra\b/g,12);hit('Mão de obra',/\b(?:pedreiro|servente|carpinteiro|armador|soldador|montador|eletricista|encanador|pintor|equipe)\w*/g,4);
  hit('Serviços',/\b(?:nota\s+fiscal\s+de\s+servico|nfs-?e|servico|topograf|projeto|engenharia|marcenaria|instalacao|manutencao|consultoria)\w*/g,5);
  hit('Material',/\b(?:material|materiais)\b/g,12);hit('Material',/\b(?:cimento|areia|brita|tijolo|bloco|argamassa|concreto|aco|vergalhao|ferragem|madeira|compensado|prego|parafuso|porca|bucha|tubo|conexao|eletroduto|condulete|piso|revestimento|tinta|impermeabilizante|telha|chapa|perfil|cabo|fio|disjuntor|tomada|interruptor|luminaria|mangueira|adesivo|silicone|massa|gesso|cal|ceramica|arame)\w*/g,4);
  const ranked=Object.entries(scores).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  if(ranked.length&&(!ranked[1]||ranked[0][1]>=ranked[1][1]+2))r.category=ranked[0][0];
  else if(ranked.length>1)r.warnings.push('A categoria não ficou clara. Selecione a categoria antes de salvar.');

  if(!r.description){
   if(!isReceipt&&r.category==='Material')r.description='Compra de material';
   else if(!isReceipt&&r.category==='Transporte')r.description='Frete / transporte';
   else if(!isReceipt&&r.category==='Equipamentos')r.description='Locação / uso de equipamento';
   else if(!isReceipt&&r.category==='Mão de obra')r.description='Mão de obra';
   else if(!isReceipt&&r.category==='Serviços')r.description='Serviço';
   else r.warnings.push('Descrição não identificada. Informe o que foi comprado ou contratado.');
  }
  if(!r.category&&!r.warnings.some(x=>/categoria/i.test(x)))r.warnings.push('Categoria não identificada com segurança. Selecione a categoria do gasto.');
  if(!r.supplier)r.warnings.push(isReceipt?'Favorecido/prestador não identificado. O fornecedor pode ficar em branco.':'Fornecedor não identificado com segurança. O campo pode ficar em branco.');
  return r;
 }

 const bytes=k=>Uint8Array.from(atob(ReaderAssets[k]),c=>c.charCodeAt(0)),url=k=>URL.createObjectURL(new Blob([bytes(k)],{type:'text/javascript'}));let pdfPromise;
 function library(){return pdfPromise||(pdfPromise=(async()=>{const lib=await import(url('pdf'));lib.GlobalWorkerOptions.workerSrc=url('pdfWorker');return lib;})().catch(e=>{pdfPromise=null;throw e;}));}
 function grouped(items){const rows=[];for(const i of items){if(!i.str?.trim())continue;let row=rows.find(r=>Math.abs(r.y-i.transform[5])<3);if(!row){row={y:i.transform[5],items:[]};rows.push(row);}row.items.push({text:i.str,x:i.transform[4]});}rows.sort((a,b)=>b.y-a.y);rows.forEach(r=>r.items.sort((a,b)=>a.x-b.x));let text=rows.map(r=>r.items.map(i=>i.text).join(' ')).join('\n');
  for(let k=0;k<rows.length;k++)for(const item of rows[k].items){if(!/^(?:valor\s+total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe)|v\.?\s*total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe)|total\s+(?:da|do)\s+(?:nota|nf[- ]?e|nfe)|valor\s+total\s+do\s+documento)$/i.test(item.text.trim()))continue;const next=rows[k].items.find(x=>x.x>item.x+3);for(let j=k+1;j<Math.min(rows.length,k+3);j++){const v=rows[j].items.find(x=>x.x>=item.x-8&&x.x<(next?.x||item.x+150)&&/^\s*(?:R\$\s*)?\d[\d.]*,\d{2}\s*$/.test(x.text));if(v){text+='\nVALOR TOTAL DA NOTA: '+v.text;break;}}}return text;
 }
 async function extractFile(file,{signal,onProgress=()=>{}}={}){
  if(!file||file.size>15*1024*1024)throw Error('Selecione um documento de até 15 MB.');const isPDF=file.type==='application/pdf'||/\.pdf$/i.test(file.name);if(!isPDF&&!(/^image\/(jpeg|png|webp)$/.test(file.type)||/\.(png|jpe?g|webp)$/i.test(file.name)))throw Error('Use PDF, JPG, PNG ou WebP.');
  let worker,task,pdf,workerURL,coreURL,timer,stopped=false;const check=()=>{if(stopped||signal?.aborted)throw Error('Leitura cancelada.');},stop=()=>{stopped=true;worker?.terminate();task?.destroy();};
  async function ocr(canvas){check();if(!worker){onProgress('Preparando reconhecimento em português…');workerURL=URL.createObjectURL(new Blob([bytes('core'),'\n',bytes('ocrWorker')],{type:'text/javascript'}));worker=await Tesseract.createWorker([{code:'por',data:bytes('por')}],1,{workerPath:workerURL,workerBlobURL:false,cacheMethod:'none',logger:m=>{if(!stopped&&m.status==='recognizing text')onProgress(`Reconhecendo texto: ${Math.round(m.progress*100)}%`);}});check();}const r=await worker.recognize(canvas);check();return r.data.text;}
  async function process(){let texts=[],ocrCount=0;try{check();if(isPDF){onProgress('Abrindo PDF…');const lib=await library();check();task=lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true});pdf=await task.promise;if(pdf.numPages>15)throw Error('Use um PDF de até 15 páginas.');for(let n=1;n<=pdf.numPages;n++){check();onProgress(`Lendo página ${n} de ${pdf.numPages}…`);const page=await pdf.getPage(n),direct=grouped((await page.getTextContent()).items);if(direct.replace(/\s/g,'').length>=30)texts.push(direct);else{ocrCount++;const v=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2.5,2000/Math.max(v.width,v.height))}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;texts.push(await ocr(canvas));canvas.width=canvas.height=1;}page.cleanup();}}
    else{const u=URL.createObjectURL(file);try{const img=new Image();img.src=u;await img.decode();check();const scale=Math.min(1,2400/Math.max(img.width,img.height)),c=document.createElement('canvas');c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(img,0,0,c.width,c.height);texts.push(await ocr(c));c.width=c.height=1;ocrCount++;}finally{URL.revokeObjectURL(u);}}
    check();const text=texts.join('\n\n');if(text.trim().length<5)throw Error('Nenhum texto legível encontrado. Use uma imagem mais nítida ou preencha manualmente.');const r=await extractText(text);r.method=ocrCount?'OCR em português':'Texto do PDF';r.pages=pdf?.numPages||1;return r;
   }finally{await worker?.terminate();await pdf?.destroy();if(workerURL)URL.revokeObjectURL(workerURL);if(coreURL)URL.revokeObjectURL(coreURL);}}
  let rejectAbort;const interrupted=new Promise((_,reject)=>{rejectAbort=()=>{stop();reject(Error('Leitura cancelada. Você pode preencher manualmente.'));};signal?.addEventListener('abort',rejectAbort,{once:true});timer=setTimeout(()=>{stop();reject(Error('A leitura demorou demais. Tente um arquivo menor.'));},180000);});
  try{return await Promise.race([process(),interrupted]);}catch(e){if(e.name==='PasswordException')throw Error('Este PDF tem senha. Use uma cópia desbloqueada.');throw e instanceof Error?e:Error(String(e));}finally{clearTimeout(timer);signal?.removeEventListener('abort',rejectAbort);}
 }
 window.Reader={extractText,extractFile};
})();
