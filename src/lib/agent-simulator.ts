import type { CartItem, MenuItem } from "@/lib/mock";
import { brl } from "@/lib/mock";

export type AgentResponse = {
  reply: string;
  cart: CartItem[];
  waitingForConfirmation: boolean;
  handoff: boolean;
  confirmed: boolean;
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function findMentionedItem(text: string, items: MenuItem[]) {
  const normalized = normalize(text);
  let bestMatch: MenuItem | undefined;
  let bestScore = 0;

  for (const item of items) {
    const name = normalize(item.name);
    if (normalized.includes(name)) return item;
    const tokens = name.split(/\s+/).filter((token) => token.length >= 5);
    const score = tokens.filter((token) => normalized.includes(token)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore ? bestMatch : undefined;
}

function cartTotal(cart: CartItem[]) {
  return cart.reduce((total, item) => total + item.qty * item.price, 0);
}

export function runRestaurantAgent(
  customerText: string,
  activeMenu: MenuItem[],
  currentCart: CartItem[],
  waitingForConfirmation: boolean,
): AgentResponse {
  const text = normalize(customerText);
  const handoff = /desconto|mais barato|preco melhor|atendente|falar com (alguem|uma pessoa|humano)|humano|especial|alerg|reclam|cancelar|problema/.test(text);
  if (handoff) {
    return {
      reply: "Vou pausar o atendimento automático e chamar uma pessoa da equipe. Mantive o contexto e o carrinho desta conversa.",
      cart: currentCart,
      waitingForConfirmation: false,
      handoff: true,
      confirmed: false,
    };
  }

  const positiveConfirmation = /\b(sim|confirmo|confirmar|pode fechar|pode confirmar|fechado|isso mesmo)\b/.test(text);
  if (waitingForConfirmation && positiveConfirmation && currentCart.length) {
    return {
      reply: `Pedido confirmado! O total é ${brl(cartTotal(currentCart))}. Já enviei para a cozinha e para o caixa.`,
      cart: currentCart,
      waitingForConfirmation: false,
      handoff: false,
      confirmed: true,
    };
  }

  const mentionedItem = findMentionedItem(text, activeMenu);
  const addIntent = /quero|adicion|coloca|inclui|vou levar|me ve|manda|pode ser|gostaria/.test(text);
  if (mentionedItem && addIntent) {
    const quantityMatch = text.match(/\b(\d+)\b/);
    const quantity = Math.min(20, Math.max(1, Number(quantityMatch?.[1] ?? 1)));
    const nextCart = [...currentCart];
    const existingItem = nextCart.find((item) => item.name === mentionedItem.name);
    if (existingItem) existingItem.qty += quantity;
    else nextCart.push({ name: mentionedItem.name, qty: quantity, price: mentionedItem.price });

    const addOn = activeMenu.find((item) => item.category.toLowerCase().includes("adicional"));
    const drink = activeMenu.find((item) => item.category.toLowerCase().includes("bebida"));
    const suggestions = [addOn && `uma ${addOn.name} (${brl(addOn.price)})`, drink && `um ${drink.name} (${brl(drink.price)})`]
      .filter(Boolean)
      .join(" ou ");
    const offer = suggestions ? ` Quer adicionar ${suggestions}?` : "";
    return {
      reply: `Adicionei ${quantity}x ${mentionedItem.name} por ${brl(mentionedItem.price)} cada. O carrinho está em ${brl(cartTotal(nextCart))}.${offer} Posso confirmar o pedido?`,
      cart: nextCart,
      waitingForConfirmation: true,
      handoff: false,
      confirmed: false,
    };
  }

  if (mentionedItem && /ingrediente|contem|leva|feito com|o que vai|com o que/.test(text)) {
    return {
      reply: `${mentionedItem.name}: ${mentionedItem.description}. ${brl(mentionedItem.price)}.`,
      cart: currentCart,
      waitingForConfirmation,
      handoff: false,
      confirmed: false,
    };
  }

  if (mentionedItem && /preco|quanto|valor|custa/.test(text)) {
    return {
      reply: `${mentionedItem.name} custa ${brl(mentionedItem.price)}. Quer que eu adicione ao seu pedido?`,
      cart: currentCart,
      waitingForConfirmation,
      handoff: false,
      confirmed: false,
    };
  }

  if (/borda|bebida|adicional|sugest/.test(text)) {
    const suggestions = activeMenu
      .filter((item) => /adicional|bebida/i.test(item.category))
      .slice(0, 4)
      .map((item) => `${item.name} (${brl(item.price)})`);
    return {
      reply: suggestions.length ? `Posso sugerir: ${suggestions.join(", ")}. Qual gostaria de adicionar?` : "No momento não há adicionais ou bebidas disponíveis.",
      cart: currentCart,
      waitingForConfirmation,
      handoff: false,
      confirmed: false,
    };
  }

  const available = activeMenu.slice(0, 5).map((item) => `${item.name} (${brl(item.price)})`).join(", ");
  return {
    reply: available
      ? `Olá! Posso ajudar com ingredientes, preços ou montar seu pedido. Hoje temos: ${available}.`
      : "Olá! Nosso cardápio está sendo atualizado. Quer falar com uma pessoa da equipe?",
    cart: currentCart,
    waitingForConfirmation,
    handoff: false,
    confirmed: false,
  };
}
