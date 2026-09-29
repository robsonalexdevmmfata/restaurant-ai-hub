export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Marca */}
          <div className="md:col-span-2">
            <h2 className="text-xl font-bold text-foreground">
              Restaurant AI Hub
            </h2>

            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              Automação inteligente e gestão integrada para revolucionar a
              operação do seu restaurante.
            </p>
          </div>

          {/* Produto */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Produto
            </h3>

            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <a href="#planos" className="transition-colors hover:text-foreground">
                  Planos
                </a>
              </li>

              <li>
                <a href="#recursos" className="transition-colors hover:text-foreground">
                  Recursos
                </a>
              </li>

              <li>
                <a href="#pdv" className="transition-colors hover:text-foreground">
                  PDV & Cozinha
                </a>
              </li>
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Empresa
            </h3>

            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <a href="#sobre" className="transition-colors hover:text-foreground">
                  Sobre nós
                </a>
              </li>

              <li>
                <a href="#contato" className="transition-colors hover:text-foreground">
                  Contato
                </a>
              </li>

              <li>
                <a href="/termos" className="transition-colors hover:text-foreground">
                  Termos de uso
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Suporte */}
        <div className="mt-10 border-t border-border pt-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Suporte
              </h3>

              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <a
                  href="/ajuda"
                  className="transition-colors hover:text-foreground"
                >
                  Central de Ajuda
                </a>

                <a
                  href="/status"
                  className="transition-colors hover:text-foreground"
                >
                  Status da API
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} Agência Info Tech Ltda. Todos os
            direitos reservados.
          </p>

          <p>
            Desenvolvido por{" "}
            <span className="font-medium text-foreground">
              Robson Alex
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

