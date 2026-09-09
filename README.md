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
