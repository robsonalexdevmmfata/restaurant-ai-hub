# Restaurant AI Hub

Crie uma aplicação web moderna de Dashboard e PDV Multi-tenant voltada para donos de restaurantes gerenciarem um Agente de IA de atendimento via WhatsApp.

A aplicação deve conter as seguintes telas e funcionalidades:

1. Tela de Login / Cadastro (Simulada):

- Permite que o usuário (dono do restaurante) entre com e-mail e senha.

- Após o login, o sistema direciona para o Dashboard isolado daquele restaurante (Multi-tenant).

2. Dashboard Principal (Visão Geral):

- Cards de métricas no topo: "Total de Atendimentos Hoje", "Pedidos Fechados pela IA", "Faturamento Estimado do Dia" e "Taxa de Resolução da IA".

- Gráfico simples de volume de atendimento por horário.

3. Tela de Conversas (Inbox / Chat em Tempo Real - Estilo WhatsApp Web):

- Painel dividido em colunas:

  - Esquerda: Lista de chats dos clientes (com foto/avatar, nome, última mensagem, horário e indicador se está com a "IA Ativa" ou "Assumido pelo Humano").

  - Centro: A conversa selecionada, exibindo as mensagens trocadas entre o Cliente e a IA (com balões estilizados diferentes).

  - Direita (Detalhes do Cliente / Pedido Atual): Resumo do carrinho de compras do cliente no momento (ex: itens pedidos, observações, valor total) e dados de entrega (endereço).

- Botões de Ação na conversa:

  - Botão para pausar a IA e assumir o chat manualmente.

  - Campo de input para o atendente humano mandar mensagem se precisar.

4. Tela de Cardápio / Configuração do Agente:

- Uma interface em tabela ou cards para o dono do restaurante gerenciar o cardápio que a IA lê (Categorias, Nome do Prato, Descrição, Preço e Status Disponível/Indisponível).

- Campo de texto para ajustar as "Instruções/Personalização da IA" (ex: "Você é o atendente da Pizzaria X, seja educado, ofereça borda recheada...").

5. Configuração da Conexão (WhatsApp):

- Tela para exibir o QR Code da Evolution API (ou status de "Conectado / Desconectado") e o número da instância do WhatsApp do restaurante.

Design e Experiência:

- Use Tailwind CSS com um design limpo, moderno, profissional (estilo SaaS B2B moderno, cores sóbrias com detalhes em verde WhatsApp ou laranja/fome).

- Interface responsiva, fluida e com estados de carregamento (skeletons) simulados onde couber.

nome RestauranteAI e crie a logo tbm

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d5edb0da-a91d-48b9-8dd6-dcae175d2cee).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Entregas e WhatsApp

O planejador usa Haversine quando o pedido tem latitude/longitude, agrupa por bairro e usa a distância cadastrada como fallback. A busca de CEP é uma geocodificação best-effort; confirme o destino antes de iniciar a rota.

Para notificações reais, configure `VITE_EVOLUTION_NOTIFICATION_PROXY_URL` para um endpoint server-side confiável. Ele recebe `customerPhone`, `orderId`, `event` e `message` em JSON, deve validar a origem/tenant e encaminhar à Evolution usando segredos mantidos no servidor. Nunca coloque `EVOLUTION_API_KEY` em variável `VITE_*`. Sem proxy ou telefone do cliente, as notificações são registradas como simuladas/sem telefone no estado local.

O link de rastreio consulta o status persistido pela API. Produtos, fotos e identidade visual do restaurante usam o PostgreSQL quando configurados; regras de entrega e categorias auxiliares continuam locais neste momento.

### QR de mesa entre dispositivos

O backend inclui a migração `backend/sql/002_public_dining_tables.sql`, que adiciona o slug e as sessões públicas de mesa no PostgreSQL. Para pedidos por QR, o frontend usa `VITE_API_BASE_URL` (ou `VITE_API_URL`) e assume `http://localhost:3001` em desenvolvimento; configure um endereço alcançável pelo celular que escaneia o QR, pois `localhost` só funciona quando navegador e API estão no mesmo dispositivo. Erros da API são mostrados ao cliente em vez de confirmar pedidos somente no estado local. Antes de produção, proteja os endpoints públicos de mesa com token QR assinado e limite de requisições.

### Migrações recentes de pedidos

`backend/sql/004_order_tracking.sql` adiciona o token público de acompanhamento. `backend/sql/005_order_status_history.sql` cria a trilha de estados e registra um snapshot do estado atual dos pedidos existentes; como o sistema não guardava transições anteriores, esse snapshot não representa o histórico antes da migração. Verifique o schema do PostgreSQL antes de aplicar scripts manualmente e execute apenas os que ainda não foram aplicados.

`backend/sql/006_product_images.sql` cria o armazenamento persistente de fotos JPEG dos produtos (até 1,5 MB) e logos (até 1 MB) no PostgreSQL. `backend/sql/007_restaurant_branding.sql` adiciona cor da marca, favicon e CNPJ ao restaurante; logo, cor e favicon são lidos pelo cardápio público. Aplique as migrações pendentes em ordem antes de usar os novos fluxos. O upload de fotos e o salvamento da identidade visual exigem uma sessão autenticada na API.

`backend/sql/008_table_delivery_operations.sql` registra forma de pagamento e solicitação de fechamento da comanda, além de atribuição e histórico persistentes de entregas. O cardápio de mesa usa `restaurant_tables` e `table_sessions` para que novos pedidos acumulem na mesma comanda até o caixa encerrá-la. Entregadores e gerentes autenticados consultam `/api/me/deliveries`; atualizações e histórico ficam no PostgreSQL. O painel do caixa consulta solicitações de fechamento e só encerra a sessão após confirmação manual do recebimento.

`backend/sql/009_restaurant_assets_and_integrations.sql` adiciona capa, políticas públicas, URL privada do webhook n8n e armazenamento persistente de favicons, capas e banners promocionais. Aplique a migração antes de usar os uploads em **Personalização** e **Promoções**. Logo, favicon, capa e banners são enviados pelo painel e gravados no PostgreSQL; use JPEG, PNG ou WebP de até 1 MB. Fotos de produtos continuam usando o endpoint otimizado já existente. O cardápio público e o QR da mesa carregam a capa, informações institucionais e banners publicados.

### Eventos, n8n e Evolution API

O backend envia JSON assincronamente ao webhook configurado por restaurante em **Personalização** nos eventos `ORDER_CREATED`, `ORDER_STATUS_CHANGED` e `TABLE_CLOSE_REQUESTED`. Também notifica o telefone informado no pedido pela Evolution API. Configure `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` no ambiente do backend, conforme `backend/.env.example`; ambas devem ser definidas juntas. Nunca use variáveis `VITE_*` para segredos da Evolution. Falhas externas são registradas no log da API e não desfazem pedidos já confirmados; o dispatcher atual não mantém fila nem novas tentativas persistentes.

#### Agente de IA no WhatsApp (Evolution → backend → Grok)

O atendimento usa a Evolution para entregar eventos diretamente ao backend, que consulta a API da xAI e devolve a resposta à mesma instância. O n8n não participa desse fluxo. Em desenvolvimento local, Evolution, backend e frontend usam, respectivamente, `http://localhost:8080`, `http://localhost:3001` e `http://localhost:8081`. Configure no ambiente privado do backend `GROK_API_KEY`, `GROK_MODEL`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_TOKEN` e `PUBLIC_API_URL`; `PUBLIC_APP_URL` é opcional e gera o link do cardápio na conversa. Consulte `backend/.env.example` para os nomes e formatos. O token do webhook deve ser aleatório e longo; o backend deriva dele um token diferente por restaurante, sem revelar o segredo global aos proprietários. Nunca exponha chaves em variáveis `VITE_*` ou no frontend.

Depois de reiniciar o backend, abra **Conexão** no painel do proprietário, copie a URL secreta exibida e cadastre-a como webhook da instância Evolution com o evento `messages.upsert`. A Evolution precisa alcançar `PUBLIC_API_URL`; não use `localhost` se estiver em outro container ou máquina. O endpoint valida o token, ignora mensagens próprias e grupos, e respeita conversas assumidas por atendimento humano. O agente usa o cardápio disponível e as instruções do restaurante; nesta versão, responde dúvidas e direciona o cliente ao menu online para concluir pedidos.

Antes de ativar o histórico persistido, aplique manualmente `backend/sql/012_grok_whatsapp_agent.sql` ao PostgreSQL e confirme que as migrações anteriores já foram aplicadas. A tela **Conexão** exibe a presença das configurações, mas não valida as credenciais nem o pareamento real da instância.

### Contas da equipe e isolamento por restaurante

O proprietário cadastra cozinheiros, caixas, motoboys, atendentes e gerentes em **Usuários**. A API associa cada conta ao `restaurant_id` do JWT do proprietário, armazena a senha com bcrypt e usa e-mail + senha na tela de login; não é necessário informar slug. As consultas e alterações da equipe ficam limitadas ao restaurante autenticado. Desativar uma conta ou alterar seu papel invalida imediatamente os tokens antigos. Os atalhos de demonstração continuam disponíveis, mas não criam contas persistentes.
