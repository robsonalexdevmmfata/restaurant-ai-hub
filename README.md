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

O link de rastreio demonstra progresso no navegador e lê os pedidos do estado do tenant. O cardápio/branding ainda usa `localStorage`; para publicar catálogo personalizado entre dispositivos, sincronize esses dados com a API antes de produção.

### QR de mesa entre dispositivos

O backend inclui a migração `backend/sql/002_public_dining_tables.sql`, que adiciona o slug e as sessões de mesa no PostgreSQL. Aplique-a antes de iniciar a API. Configure `VITE_API_BASE_URL` com um endereço alcançável pelo celular que escaneia o QR; `localhost` só funciona quando navegador e API estão no mesmo dispositivo. Com a API configurada, a ocupação é consultada entre dispositivos; sem ela, usa o estado local de demonstração. Antes de produção, proteja os endpoints de abertura/fechamento com token QR assinado e limite de requisições.
