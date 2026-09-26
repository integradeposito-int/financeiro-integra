# Financeiro Íntegra V1.0 — pacote para GitHub Pages

## Como publicar

1. Extraia o ZIP no computador.
2. Envie todo o conteúdo extraído para a raiz do repositório, mantendo as pastas `assets`, `vendor` e `setup`. O `index.html` deve aparecer diretamente na raiz, junto de `app.js` e `styles.css`.
3. Inclua também o arquivo `.nojekyll`, que sinaliza publicação estática sem processamento Jekyll.
4. Em Settings > Pages, selecione publicação por branch (Deploy from a branch), a branch que recebeu os arquivos (normalmente `main`) e a pasta `/(root)`. Salve.
5. Aguarde a publicação e abra o endereço informado pelo GitHub Pages, normalmente `https://SEU-USUARIO.github.io/SEU-REPOSITORIO/`.

Envie os arquivos extraídos, não o ZIP. Este pacote não exige instalação de dependências nem etapa de build.

## O que foi preparado

O conteúdo da pasta `dist` do pacote original foi colocado na raiz deste ZIP. Foram acrescentados apenas `.nojekyll` e estes documentos de publicação/validação. Os 26 arquivos originais do aplicativo foram preservados byte a byte, incluindo HTML, CSS, JavaScript, logos, guia PDF, bibliotecas e arquivos de instalação do Google Sheets.

## Conexão com a planilha

Depois de publicar, abra Configurações no endereço online e configure/teste a URL da implantação do Apps Script terminada em `/exec`. As configurações salvas quando o HTML era aberto localmente não são transferidas automaticamente para o domínio online.

O Apps Script e a planilha continuam separados do GitHub Pages. Os arquivos em `setup` são fornecidos para download; o GitHub Pages não executa o Apps Script. A validação deste pacote não grava dados em sua planilha. A confirmação da sincronização real deve ser feita com sua implantação após a publicação.
