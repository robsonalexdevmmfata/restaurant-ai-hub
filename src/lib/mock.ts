import c1 from "@/assets/c1.jpg";
import c2 from "@/assets/c2.jpg";
import c3 from "@/assets/c3.jpg";
import c4 from "@/assets/c4.jpg";

export type Sender = "cliente" | "ia" | "humano";

export type Message = {
  id: string;
  sender: Sender;
  text: string;
  time: string;
};

export type CartItem = { name: string; qty: number; price: number };

export type Chat = {
  id: string;
  name: string;
  avatar: string;
  time: string;
  mode: "ia" | "humano";
  status: string;
  messages: Message[];
  cart: CartItem[];
  note: string;
  address: string;
  addressRef: string;
  eta: string;
};

export const chats: Chat[] = [
  {
    id: "carla",
    name: "Carla Mendes",
    avatar: c1,
    time: "18:42",
    mode: "ia",
    status: "Pedido em andamento",
    messages: [
      { id: "m1", sender: "cliente", text: "Oi! Gostaria de pedir uma pizza de 8 fatias, pode ser?", time: "18:38" },
      { id: "m2", sender: "ia", text: "Claro! Temos borda recheada de catupiry ou cheddar. Qual você prefere?", time: "18:39" },
      { id: "m3", sender: "cliente", text: "Borda recheada de catupiry, por favor. E mais um refrigerante de 1L.", time: "18:41" },
      {
        id: "m4",
        sender: "ia",
        text: "Perfeito! Sua pizza grande com borda de catupiry (R$ 62,90) + refrigerante 1L (R$ 8,00). Total de R$ 70,90. Posso confirmar?",
        time: "18:42",
      },
    ],
    cart: [
      { name: "Pizza grande borda catupiry", qty: 1, price: 62.9 },
      { name: "Refrigerante 1L", qty: 1, price: 8 },
    ],
    note: "Sem cebola, por favor. Tampo 50/50.",
    address: "Rua das Acácias, 214 · Jd. Paraíso",
    addressRef: "Ref.: portão azul",
    eta: "35 min",
  },
  {
    id: "joao",
    name: "João Pedro",
    avatar: c2,
    time: "18:39",
    mode: "humano",
    status: "Aguardando atendente",
    messages: [
      { id: "m1", sender: "cliente", text: "Qual o prazo de entrega?", time: "18:36" },
      { id: "m2", sender: "ia", text: "Hoje estamos entregando em cerca de 40 minutos na sua região.", time: "18:37" },
      { id: "m3", sender: "cliente", text: "Preciso para um evento, consigo falar com alguém?", time: "18:39" },
      { id: "m4", sender: "humano", text: "Oi João, aqui é o Marco. Me conta quantas pessoas são?", time: "18:39" },
    ],
    cart: [{ name: "Pizza família calabresa", qty: 3, price: 74.5 }],
    note: "Pedido para evento corporativo às 21h.",
    address: "Av. Brigadeiro Faria, 1020 · Centro",
    addressRef: "Ref.: recepção do prédio",
    eta: "40 min",
  },
  {
    id: "analeo",
    name: "Ana & Léo",
    avatar: c3,
    time: "18:31",
    mode: "ia",
    status: "Pedido confirmado",
    messages: [
      { id: "m1", sender: "cliente", text: "Confirmou meu pedido?", time: "18:30" },
      { id: "m2", sender: "ia", text: "Sim! Pedido #4821 confirmado e já entrou na produção. 🍕", time: "18:31" },
    ],
    cart: [
      { name: "Pizza média marguerita", qty: 1, price: 48.9 },
      { name: "Água com gás", qty: 2, price: 6 },
    ],
    note: "Massa fina.",
    address: "Rua Iguatemi, 88 · Vila Nova",
    addressRef: "Ref.: casa dos fundos",
    eta: "30 min",
  },
  {
    id: "renata",
    name: "Renata Alves",
    avatar: c4,
    time: "18:24",
    mode: "ia",
    status: "Escolhendo itens",
    messages: [
      { id: "m1", sender: "cliente", text: "Boa noite, vocês têm opção vegetariana?", time: "18:23" },
      { id: "m2", sender: "ia", text: "Temos a Vegetariana da Casa e a Marguerita. Quer ver os ingredientes?", time: "18:24" },
    ],
    cart: [],
    note: "Sem lactose se possível.",
    address: "Rua dos Pinheiros, 455 · Pinheiros",
    addressRef: "Ref.: apto 71",
    eta: "35 min",
  },
];

export const hourly = [
  { hour: "11h", value: 20, peak: false },
  { hour: "12h", value: 28, peak: false },
  { hour: "13h", value: 55, peak: false },
  { hour: "14h", value: 70, peak: false },
  { hour: "15h", value: 50, peak: false },
  { hour: "16h", value: 42, peak: false },
  { hour: "17h", value: 60, peak: true },
  { hour: "18h", value: 88, peak: true },
  { hour: "19h", value: 100, peak: true },
  { hour: "20h", value: 74, peak: true },
  { hour: "21h", value: 58, peak: false },
  { hour: "22h", value: 34, peak: false },
  { hour: "23h", value: 22, peak: false },
];

export const kpis = [
  { label: "Atendimentos hoje", value: "482", note: "▲ 12% vs ontem", accent: true },
  { label: "Pedidos fechados pela IA", value: "137", note: "28% do total", accent: false },
  { label: "Faturamento estimado", value: "R$ 9.640", note: "▲ 8% vs ontem", accent: true },
  { label: "Taxa de resolução da IA", value: "94%", note: "12 assumidos por humano", accent: false },
];

export type MenuItem = {
  id: string;
  category: string;
  name: string;
  description: string;
  price: number;
  available: boolean;
};

export const menu: MenuItem[] = [
  { id: "1", category: "Pizzas salgadas", name: "Marguerita", description: "Molho de tomate, muçarela, manjericão fresco", price: 48.9, available: true },
  { id: "2", category: "Pizzas salgadas", name: "Calabresa artesanal", description: "Calabresa fatiada, cebola roxa, orégano", price: 54.9, available: true },
  { id: "3", category: "Pizzas salgadas", name: "Vegetariana da Casa", description: "Abobrinha, berinjela, tomate seco, muçarela", price: 56.9, available: true },
  { id: "4", category: "Pizzas doces", name: "Banana com canela", description: "Banana caramelizada, canela, leite condensado", price: 39.9, available: false },
  { id: "5", category: "Adicionais", name: "Borda recheada catupiry", description: "Borda generosa com catupiry original", price: 12, available: true },
  { id: "6", category: "Bebidas", name: "Refrigerante 1L", description: "Cola, guaraná ou laranja", price: 8, available: true },
  { id: "7", category: "Bebidas", name: "Água com gás 500ml", description: "Garrafa individual gelada", price: 6, available: true },
];

export const defaultPrompt = `Você é o atendente virtual da Pizzaria Vulcão. Seja educado, objetivo e use no máximo duas frases por mensagem.
Sempre confirme o tamanho da pizza e ofereça borda recheada de catupiry ou cheddar.
Antes de fechar o pedido, confirme endereço completo, forma de pagamento e leia o resumo do carrinho.
Se o cliente pedir desconto, reclamar ou pedir para falar com uma pessoa, transfira imediatamente para o atendimento humano.`;

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
