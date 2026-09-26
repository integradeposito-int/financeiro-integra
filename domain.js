(function(){
  const categories=['Material','Mão de obra','Serviços','Transporte','Equipamentos','Outros'];
  const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
  const parseMoney=value=>{let s=String(value??'').replace(/R\$/gi,'').replace(/\s/g,'');if(!/^\d+(?:\.\d{3})*(?:,\d{1,2})?$/.test(s))return null;const n=Math.round(Number(s.replace(/\./g,'').replace(',','.'))*100);return Number.isSafeInteger(n)&&n<=1e14?n:null;};
  const inputMoney=cents=>cents===null?'':(cents/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const dateValid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const total=(expenses,workId)=>expenses.filter(e=>!workId||e.workId===workId).reduce((s,e)=>s+e.amountCents,0);
  const summary=(work,expenses)=>{const spent=total(expenses,work.id);const balance=work.contractCents===null?null:work.contractCents-spent;return {spent,balance,margin:balance===null?null:balance/work.contractCents*100};};
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.Domain={categories,money,parseMoney,inputMoney,dateValid,today,total,summary,escape};
})();
