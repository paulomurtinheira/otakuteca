# Otakuteca

A tua lista pessoal de anime e manga. Funciona no PC e no iPhone (instala-se como app) e a lista fica guardada num repositório privado teu do GitHub.

Os dados dos títulos (capas, sinopses, episódios, datas de emissão) vêm do [AniList](https://anilist.co), que é gratuito e não precisa de chave.

## O que tem

- **Lista** com estados (a ver, planeado, concluído, pausa, abandonado), progresso, nota de 0 a 10, notas pessoais, "como foi?" (😭 🔥 🤯…), favoritos, revisões e datas
- **Descobrir**: pesquisa, em alta, temporada atual e **Para ti** (recomendações feitas a partir dos títulos a que deste nota alta)
- **Agenda**: o que tens por ver e quando sai o próximo episódio, com contagem decrescente
- **Stats**: dias de ecrã, calendário de atividade, géneros, notas, estúdios, o teu "perfil" otaku e 15 conquistas
- **Retrospetiva** do ano em stories, **Roleta** para decidir o que ver e **Tier list** (dá para guardar como imagem)
- Importa do AniList (nome de utilizador) e do MyAnimeList (ficheiro XML)

## Publicar (uma vez)

A app é só ficheiros estáticos. O mais simples é o GitHub Pages:

1. Cria um repositório **público** chamado `otakuteca` (o código não tem dados pessoais) e põe lá o conteúdo desta pasta.
2. Em *Settings → Pages* escolhe *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. Passado um minuto a app está em `https://O-TEU-NOME.github.io/otakuteca/`.

## Entrar com Google (opcional)

Em vez do GitHub, cada pessoa pode entrar com o seu Gmail: a lista fica num ficheiro escondido na Google Drive dela (pasta da app, que só a app vê). Não há servidor nem contas nossas.

Quem publica a app configura isto **uma vez**:

1. Em <https://console.cloud.google.com/projectcreate> cria um projeto e ativa a **Google Drive API**.
2. "Ecrã de consentimento OAuth" → Externo → preenche o nome e o email → **Publicar app**. O acesso pedido (`drive.appdata`, email e perfil) não é sensível, por isso não precisa de verificação da Google.
3. "Credenciais" → "ID de cliente OAuth" → Aplicação Web → em "Origens JavaScript autorizadas" põe o endereço da app (ex.: `https://O-TEU-NOME.github.io`) e, para testar, `http://localhost:5180`.
4. Copia o ID (acaba em `.apps.googleusercontent.com`) para `GOOGLE_CLIENT_ID` em `js/config.js`. Com isso preenchido, quem usa a app só carrega em "Entrar com Google". O ID é público por natureza, pode ficar no repositório.

A Google só dá login por 1 hora a páginas sem servidor: quando expira, a app mostra "Toca para renovar login" e um toque em qualquer sítio renova.

## Guardar a lista no GitHub

Os dados ficam num **segundo repositório, privado**, separado do código.

1. Cria o repositório `otakuteca-dados` com **Private** e "Add a README".
2. Em <https://github.com/settings/personal-access-tokens/new> cria um token *fine-grained*: *Only select repositories* → `otakuteca-dados`, e em *Repository permissions* põe **Contents: Read and write**.
3. Na app: *Mais → Definições → Guardar no GitHub*. Cola `o-teu-nome/otakuteca-dados` e o token, e carrega em *Testar e guardar*.
4. Repete o passo 3 em cada aparelho. A lista aparece sozinha.

Cada alteração é um commit no `otakuteca-dados`, por isso tens histórico completo e podes voltar a qualquer versão. O token fica só no aparelho (nunca vai para o repositório).

## iPhone

Abre o endereço no **Safari** → Partilhar → *Adicionar ao ecrã principal*. A app instalada tem armazenamento próprio, separado do Safari: liga o GitHub (passo 3) já dentro da app do ecrã principal.

## Testar no PC

```
node dev-server.cjs
```

e abre <http://localhost:5180>.

## Como funciona o sync

A lista é um ficheiro JSON com uma linha por título. Em cada sincronização a app lê o ficheiro, junta com o que tens (por título ganha a alteração mais recente, e apagar também conta) e só escreve se algo mudou. Sem rede, tudo continua a funcionar e sincroniza quando voltares online.
