import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Footer } from "../components/footer";

import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RestaurantAI | Automação com IA para restaurantes" },
      {
        name: "description",
        content:
          "Automatize atendimento, pedidos e entregas com IA para restaurantes, com multi-tenancy, RBAC e operação em tempo real.",
      },
    ],
  }),
  component: LandingPage,
});

const benefits = [
  {
    title: "Atendimento 24/7",
    description: "Seu agente de IA responde pedidos, dúvidas e confirmações sem depender de equipe o tempo todo.",
  },
  {
    title: "Cardápio inteligente",
    description: "Atualiza itens, disponibilidade e promoções em tempo real direto do painel do restaurante.",
  },
  {
    title: "Pedidos e cozinha em sincronia",
    description: "Coordenar cozinha, caixa e entregas em uma única operação reduz atrasos e retrabalho.",
  },
  {
    title: "Gestão por papel",
    description: "Super Admin, dono e funcionários têm acessos segmentados conforme a operação do restaurante.",
  },
];

const testimonials = [
  { name: "Sofia Teixeira", role: "Dona da Hamburgueria Prime", quote: "O sistema eliminou a fila de WhatsApp e aumentou nossas vendas em 32% em 2 meses.", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=500&q=80" },
  { name: "André Nascimento", role: "Gerente · Pizzaria Vulcão", quote: "A cozinha, caixa e entregas agora operam em um único fluxo, com muito menos erro humano.", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=500&q=80" },
  { name: "Patrícia Lemos", role: "Prop. · Café Aurora", quote: "A IA atende clientes mesmo fora do horário, e a equipe só precisa intervir quando é necessário.", avatar: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=500&q=80" },
  { name: "Carlos Almeida", role: "Dono · Sushi Zen", quote: "O sistema me liberou para pensar em expansão enquanto a IA cuida do atendimento.", avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=500&q=80" },
  { name: "Marina Costa", role: "Gerente · Bistrô Nove", quote: "A gente reduz a fricção entre pedidos e entrega, e o cliente sente na velocidade.", avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=500&q=80" },
  { name: "Rafael Nunes", role: "Proprietário · Grill House", quote: "Conseguimos escalar para 3 unidades com o mesmo padrão de operação e qualidade.", avatar: "https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=500&q=80" },
  { name: "Lúcia Haddad", role: "Dona · Café Novelo", quote: "A IA responde pedidos e também cuida do marketing, com muita consistência na experiência.", avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=500&q=80" },
  {
    name: "Diego Martins",
    role: "Operações · Pizza Nova",
    quote: "A gente deixou de perder pedidos e reforçou o controle do caixa de forma clara.",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=500&q=80",
  },
  { name: "Renata Santos", role: "CEO · Boulangerie da Rua", quote: "A gestão por papel e a automação do WhatsApp deram muito mais previsibilidade para a equipe.", avatar: "https://images.unsplash.com/photo-1546967191-fdfb13ed6b1e?auto=format&fit=crop&w=500&q=80" },
];

const plans = [
  { name: "Básico", price: "R$ 99", description: "Para restaurantes em crescimento", features: ["1 restaurante", "Atendimento por WhatsApp", "Cardápio digital", "Dashboard básica"] },
  { name: "Pro", price: "R$ 249", description: "Para operações com volume maior", features: ["3 restaurantes", "IA avançada", "Gestão de equipe", "Pedidos + caixa + entregas", "Relatórios e métricas"], recommended: true },
  { name: "Enterprise", price: "Sob medida", description: "Para redes multi-loja", features: ["Múltiplas unidades", "RBAC completo", "Suporte prioritário", "Customização e integrações"] },
];

function LandingPage() {
  const [slideIndex, setSlideIndex] = useState(0);
  const totalSlides = Math.ceil(testimonials.length / 3);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % totalSlides);
    }, 4000);

    return () => window.clearInterval(timer);
  }, [totalSlides]);

  const testimonialSlides = Array.from({ length: totalSlides }, (_, index) =>
    testimonials.slice(index * 3, index * 3 + 3),
  );

  return (
    <div className="min-h-screen bg-[#f5f6f2] text-ink">
      <header className="mx-auto max-w-7xl px-4 pb-2 pt-5 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between rounded-full border border-black/5 bg-white/80 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RestaurantAI" width={28} height={28} className="size-7 rounded-md" />
            <div>
              <p className="font-display text-sm font-semibold tracking-tight">RestaurantAI</p>
            </div>
          </div>
          <div className="hidden items-center gap-6 text-sm text-stone-600 md:flex">
            <a href="#funcionalidades" className="transition hover:text-ink">Funcionalidades</a>
            <a href="#depoimentos" className="transition hover:text-ink">Depoimentos</a>
            <a href="#planos" className="transition hover:text-ink">Planos</a>
          </div>
          <Link to="/login" className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-deep">
            Acessar painel
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <span className="inline-flex rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                IA para restaurantes
              </span>
              <h1 className="mt-6 max-w-xl font-display text-4xl font-semibold leading-tight tracking-tight text-ink sm:text-5xl">
                Automatize atendimento, pedidos e entregas com IA sem perder o controle.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
                Centralize WhatsApp, pedidos da cozinha, caixa e entregas em uma plataforma multi-tenant pensada para restaurantes que querem vender mais e operar melhor.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/login" className="rounded-full bg-brand px-6 py-3 text-sm font-medium text-white transition hover:bg-brand-deep">
                  Quero testar agora
                </Link>
                <a href="#planos" className="rounded-full border border-black/10 bg-white px-6 py-3 text-sm font-medium text-ink transition hover:bg-stone-50">
                  Ver planos
                </a>
              </div>
              <div className="mt-8 grid max-w-lg grid-cols-3 gap-4 text-left">
                <div>
                  <p className="font-display text-2xl font-semibold text-ink">3.2x</p>
                  <p className="text-sm text-stone-500">mais pedidos automatizados</p>
                </div>
                <div>
                  <p className="font-display text-2xl font-semibold text-ink">94%</p>
                  <p className="text-sm text-stone-500">resolução pela IA</p>
                </div>
                <div>
                  <p className="font-display text-2xl font-semibold text-ink">24/7</p>
                  <p className="text-sm text-stone-500">atendimento constante</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-black/5 bg-white p-4 shadow-[0_24px_80px_rgba(16,19,18,0.08)]">
              <div className="rounded-[1.5rem] bg-[#101312] p-5 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-stone-400">Operação do dia</p>
                    <p className="mt-2 font-display text-2xl font-semibold">R$ 18.240</p>
                  </div>
                  <span className="rounded-full bg-brand px-2 py-1 text-xs font-medium text-white">+18.7%</span>
                </div>
                <div className="mt-5 space-y-3">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <div className="flex items-center justify-between text-sm text-stone-300">
                      <span>Pedidos resolvidos pela IA</span>
                      <span className="text-white">186</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-white/10">
                      <div className="h-2.5 w-[78%] rounded-full bg-brand" />
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <div className="flex items-center justify-between text-sm text-stone-300">
                      <span>Entregas no prazo</span>
                      <span className="text-white">97%</span>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-white/10">
                      <div className="h-2.5 w-[97%] rounded-full bg-emerald-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="funcionalidades" className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Benefícios</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">Tudo o que sua operação precisa em uma plataforma</h2>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {benefits.map((item) => (
              <div key={item.title} className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
                <div className="mb-4 inline-flex rounded-2xl bg-brand/10 p-3 text-brand">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 12.5 10 15.5 17 8.5" /></svg>
                </div>
                <h3 className="font-display text-xl font-semibold text-ink">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-stone-600">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="depoimentos" className="bg-[#111312] py-16 text-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Depoimentos</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">Líderes de operação que já transformaram o atendimento</h2>
            </div>
            <div className="mt-10 overflow-hidden" aria-roledescription="carrossel" aria-label="Depoimentos de clientes">
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-in-out motion-reduce:transition-none"
                  style={{ transform: `translateX(-${slideIndex * 100}%)` }}
                  aria-live="polite"
                >
                  {testimonialSlides.map((slide, index) => (
                    <div key={index} className="grid w-full shrink-0 gap-5 md:grid-cols-3">
                      {slide.map((item) => (
                        <div key={item.name} className="flex min-h-72 flex-col items-center rounded-3xl border border-white/10 bg-white/[0.06] px-6 py-7 text-center shadow-lg shadow-black/10 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.09]">
                          <img
                            src={item.avatar}
                            alt={`Retrato de ${item.name}`}
                            loading="lazy"
                            className="size-20 rounded-full border-4 border-white/15 object-cover shadow-xl shadow-black/30 ring-2 ring-emerald-300/70"
                          />
                          <p className="mt-4 font-semibold">{item.name}</p>
                          <p className="mt-1 text-sm text-stone-400">{item.role}</p>
                          <div aria-label="5 de 5 estrelas" className="mt-4 tracking-[0.2em] text-amber-300">★★★★★</div>
                          <p className="mt-3 text-sm leading-6 text-stone-200">“{item.quote}”</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-7 flex items-center justify-center gap-4">
                <button
                  type="button"
                  aria-label="Ver grupo anterior de depoimentos"
                  onClick={() => setSlideIndex((current) => (current + totalSlides - 1) % totalSlides)}
                  className="grid size-9 place-items-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/10"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="flex gap-2">
                {Array.from({ length: totalSlides }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Mostrar depoimentos ${index * 3 + 1} a ${Math.min((index + 1) * 3, testimonials.length)}`}
                    aria-current={index === slideIndex ? "true" : undefined}
                    onClick={() => setSlideIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      index === slideIndex ? "w-8 bg-brand" : "w-2.5 bg-white/30 hover:bg-white/50"
                    }`}
                  />
                ))}
                </div>
                <button
                  type="button"
                  aria-label="Ver próximo grupo de depoimentos"
                  onClick={() => setSlideIndex((current) => (current + 1) % totalSlides)}
                  className="grid size-9 place-items-center rounded-full border border-white/15 text-white/80 transition hover:bg-white/10"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="planos" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Planos</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink">Escolha o plano ideal para sua operação</h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <div key={plan.name} className={`rounded-[2rem] border p-6 shadow-sm ${plan.recommended ? "border-brand bg-brand/5 shadow-lg shadow-brand/10" : "border-black/5 bg-white"}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-2xl font-semibold text-ink">{plan.name}</h3>
                  {plan.recommended ? <span className="rounded-full bg-brand px-2 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white">Mais usado</span> : null}
                </div>
                <p className="mt-4 text-3xl font-semibold text-ink">{plan.price}</p>
                <p className="mt-2 text-sm text-stone-600">{plan.description}</p>
                <ul className="mt-6 space-y-3 text-sm text-stone-700">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex size-4 items-center justify-center rounded-full bg-brand/10 text-[10px] text-brand">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/login" className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-4 py-3 text-sm font-medium transition ${plan.recommended ? "bg-brand text-white hover:bg-brand-deep" : "bg-stone-900 text-white hover:bg-stone-800"}`}>
                  Começar agora
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
