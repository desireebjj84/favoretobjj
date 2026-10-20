# Roadmap — Favoreto BJJ Attendance

## Done
- [ ] Formulários vermelho, amarelo e verde: envio pelos responsáveis, revisão administrativa e grau após aprovação.
- [x] Graus coloridos extras no perfil infantil, com escolha e remoção de cada cor pela equipe, sem alterar os graus brancos.
- Lovable Cloud enabled: locations, students, classes, sessions, attendance, roles, branding
- Seed: 3 units + sample class grid + sample students
- Design system, auth (email + Google), role-aware screens
- Screens: Today, Calendar, Students + history, QR check-in, Reports (full/low/demand/alerts), Settings
- i18n EN / PT / ES, Favoreto logo + favicon
- Class manager screen: admin adds/edits/removes classes per academy
- Installable on phones: web app manifest + logo icons (192/512/maskable/apple-touch), theme color
- Embeddable student portal: iframe detection, email-first sign-in note + "open in new tab", ?lang= URL param, camera hint
- Portal in Portuguese on the academy site: ?lang=pt in the embedded link (en / es available), plus in-app EN/PT/ES switch

## Waiting on user
- Real class schedule (user can enter it in the class manager, or send it to be loaded)
- [x] Tela de auto-cadastro de alunos (/my-students) com vínculo automático à conta

- [ ] Belt progress: apply belt sequence + classes required per belt (waiting on Desirèe)
- [x] My Profile area: belt/stripes display + editable name/phone/address (done, verified)
- [x] Apagar os 16 alunos de exemplo do seed (keep: Frederico da cunha, real)
- [x] Menu lateral: mover barra de botões do rodapé para a lateral (desktop), manter rodapé no celular
- [x] Faixa por idade: 16+ segue sequência adulta (branca→azul); cinza/amarela/laranja/verde só <16
- [x] Publicar correção da aba "Meus alunos" + demais mudanças (publicado 15/10)
- [x] Calendário: cada aula virou um cartão espaçado, botão de reserva maior (44px de toque)
- [x] Booking em todas as unidades: aluno pode reservar em qualquer unidade (etiqueta da unidade quando vê "Todas")
- [x] Check-in mostra aluno de outra unidade que reservou aquela aula (testado com reserva real de Gael em Hialeah, depois apagada)
- [x] Primeira tela (login/entrada): fundo preto, escrita em dourado-ouro e branco, logo no topo sem fundo branco
- [x] Tela de reservas (staff): hoje + próximos dias (passadas só sob demanda), com nome e faixa de quem reservou; entrar na aula e ver alunos com suas faixas
- [x] Menu principal: "Favoreto" em amarelo-ouro e "BJJ" em branco
- [x] Horário da aula embaixo do nome (calendário, hoje, reservas)
- [x] Página da aula: clicar numa aula abre quem fez check-in (nome, faixa, horário), quem reservou sem entrar e as faltas
- [x] Lista de presença: mostrar somente nome e faixa (sem horário)
- [x] Contador de vagas: cada aula mostra reservas/vagas restantes (ex. 2/13) no calendário, hoje e reservas
- [x] Confirmar presença após check-in (Veio/Não veio); só confirmadas contam para a faixa
- [~] Aulas por faixa (adulto/criança): tabela belt_requirements criada; faixa azul adulto = 65 aulas/grau cadastrada — aguardando os números das demais faixas
