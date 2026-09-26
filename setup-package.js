(function(){
 'use strict';
 function downloadStatic(path,name){const a=document.createElement('a');a.href=path;a.download=name||path.split('/').pop();document.body.append(a);a.click();a.remove();}
 function downloadText(name,text,type='text/plain;charset=utf-8'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 window.SetupPackage={
   downloadSpreadsheet(){downloadStatic('assets/financeiro_integra_modelo_v1.0_google_sheets.xlsx','financeiro_integra_modelo_v1.0_google_sheets.xlsx');},
   downloadAppsScript(){downloadStatic('setup/APPS-SCRIPT-V1.0.gs','APPS-SCRIPT-V1.0.gs');},
   downloadInstructions(){downloadStatic('setup/INSTALACAO-GOOGLE-SHEETS-V1.0.txt','INSTALACAO-GOOGLE-SHEETS-V1.0.txt');},
   downloadConfig(){downloadText('configuracao-financeiro.json',AppSettings.exportConfig(),'application/json;charset=utf-8');}
 };
})();
