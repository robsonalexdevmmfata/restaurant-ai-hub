import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CircleAlert, LoaderCircle, MessageCircle, QrCode } from "lucide-react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Btn } from "@/components/kit";
import { ApiError, api, getToken, type ApiAiIntegrationStatus } from "@/lib/api";
import { showToast } from "@/lib/toast";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/conexao")({
  head: () => ({
    meta: [
      { title: "Conexão WhatsApp e IA · RestauranteAI" },
      {
        name: "description",
        content: "Configure o atendimento do WhatsApp com Evolution API e Grok.",
      },
    ],
  }),
  component: Conexao,
});

function Conexao() {
  const { tenant, loading } = useRequireTenant("owner");
  const [status, setStatus] = useState<ApiAiIntegrationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [pairingQr, setPairingQr] = useState<string | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [error, setError] = useState("");
  const hasApiSession = Boolean(getToken());

  useEffect(() => {
    if (tenant && !restaurantName) setRestaurantName(tenant.restaurant);
  }, [restaurantName, tenant]);

  const refreshStatus = useCallback(async () => {
    const result = await api.getAiIntegrationStatus();
    setStatus(result);
    return result;
  }, []);

  useEffect(() => {
    let active = true;
    refreshStatus()
      .then((result) => {
        if (active) setStatus(result);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof ApiError && cause.status === 401
            ? "Para conectar o WhatsApp, entre com a conta real do proprietário. A conta de demonstração não pode criar instâncias."
            : cause instanceof ApiError && cause.status === 403
              ? "Somente o proprietário pode conectar o WhatsApp deste restaurante."
              : "Não foi possível carregar o status do WhatsApp. Tente novamente.",
        );
      })
      .finally(() => {
        if (active) setLoadingStatus(false);
      });
    return () => {
      active = false;
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (!pairingQr || status?.evolutionInstanceConnected) return;
    const timer = window.setInterval(() => {
      void refreshStatus()
        .then((result) => {
          if (result.evolutionInstanceConnected) {
            setPairingQr(null);
            showToast({
              title: "WhatsApp conectado",
              description: "A instância Evolution foi pareada com sucesso.",
              variant: "success",
            });
          }
        })
        .catch((cause: unknown) => {
          setError(
            cause instanceof ApiError && cause.status === 401
              ? "Sua sessão expirou. Entre novamente com a conta real do proprietário."
              : "Não foi possível atualizar o estado da conexão.",
          );
        });
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [pairingQr, refreshStatus, status?.evolutionInstanceConnected]);

  if (loading || !tenant) {
    return (
      <div className="min-h-screen bg-stone-100 p-6">
        <Skeleton className="h-[70vh] w-full" />
      </div>
    );
  }

  async function createOrConnectInstance() {
    setCreatingInstance(true);
    setError("");
    setPairingQr(null);
    try {
      const result = await api.createEvolutionInstance(restaurantName);
      const latestStatus = await refreshStatus();
      setPairingQr(
        result.state === "open" || latestStatus.evolutionInstanceConnected ? null : result.qrCode,
      );
      showToast({
        title: result.created ? "WhatsApp preparado" : "WhatsApp pronto para parear",
        description:
          result.state === "open"
            ? "Este WhatsApp já está conectado."
            : result.qrCode
              ? "Escaneie o QR Code com o WhatsApp do restaurante."
              : "A conexão foi iniciada. Tente gerar o QR Code novamente em alguns segundos.",
        variant: "success",
      });
      if (!result.qrCode && result.state !== "open" && !latestStatus.evolutionInstanceConnected) {
        setError(
          "O QR Code ainda está sendo preparado. Aguarde alguns segundos e tente novamente.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 401
          ? "Para criar a conexão, entre com a conta real do proprietário. A conta de demonstração não tem acesso à Evolution."
          : cause instanceof ApiError
            ? cause.message
            : "Não foi possível preparar a conexão do WhatsApp. Tente novamente.",
      );
    } finally {
      setCreatingInstance(false);
    }
  }

  return (
    <AppShell
      tenant={tenant}
      title="Conexão WhatsApp e IA"
      subtitle="Conecte o WhatsApp do restaurante escaneando um QR Code."
    >
      <div className="mx-auto grid max-w-3xl gap-5">
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
          >
            <CircleAlert className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-semibold">Não foi possível conectar o WhatsApp</p>
              <p className="mt-1">{error}</p>
            </div>
          </div>
        ) : null}

        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <MessageCircle className="size-6" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold">WhatsApp do restaurante</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Conecte o número usado para receber mensagens e atender seus clientes.
                </p>
                {status ? (
                  <p
                    className={`mt-2 text-sm font-medium ${
                      status.evolutionInstanceConnected ? "text-emerald-700" : "text-amber-800"
                    }`}
                  >
                    {status.evolutionInstanceConnected
                      ? "WhatsApp conectado"
                      : "WhatsApp aguardando pareamento"}
                  </p>
                ) : null}
              </div>
            </div>
            {loadingStatus ? (
              <span className="inline-flex items-center gap-2 text-sm text-stone-500">
                <LoaderCircle className="size-4 animate-spin" /> Verificando conexão
              </span>
            ) : status?.evolutionInstanceConnected ? (
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 sm:self-center">
                <span className="size-2 rounded-full bg-emerald-500" /> Conectado
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 self-start rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 sm:self-center">
                <span className="size-2 rounded-full bg-amber-500" /> Não conectado
              </span>
            )}
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <QrCode className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display font-semibold">Configurar conexão</h2>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                Confirme o nome do restaurante. Vamos preparar a conexão e mostrar o QR Code para
                você parear o WhatsApp.
              </p>
              <label
                htmlFor="restaurant-name"
                className="mt-5 block text-sm font-medium text-stone-700"
              >
                Nome do restaurante
              </label>
              <input
                id="restaurant-name"
                value={restaurantName}
                onChange={(event) => setRestaurantName(event.target.value)}
                maxLength={120}
                autoComplete="organization"
                className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                placeholder="Ex.: Sakura Sushi"
              />
              {!hasApiSession ? (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Para conectar um WhatsApp real, entre com a conta cadastrada do proprietário. A
                  conta de demonstração serve apenas para visualizar o painel.
                </p>
              ) : null}
              <Btn
                type="button"
                onClick={() => void createOrConnectInstance()}
                disabled={
                  creatingInstance ||
                  loadingStatus ||
                  !hasApiSession ||
                  restaurantName.trim().length < 2
                }
                className="mt-4"
              >
                {creatingInstance ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <QrCode className="size-4" />
                )}
                Criar conexão e gerar QR
              </Btn>
            </div>
          </div>
          {pairingQr ? (
            <div className="mt-6 grid justify-items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 p-5 text-center">
              <img
                src={pairingQr}
                alt={`QR Code para conectar ${restaurantName} ao WhatsApp`}
                className="size-64 max-w-full rounded-lg bg-white object-contain p-2"
              />
              <p className="text-sm font-semibold text-stone-800">
                Escaneie para conectar o WhatsApp
              </p>
              <p className="max-w-md text-xs leading-relaxed text-stone-600">
                No WhatsApp, abra <strong>Aparelhos conectados → Conectar aparelho</strong>. A tela
                verifica automaticamente quando a conexão for concluída.
              </p>
            </div>
          ) : null}
          {status?.evolutionInstanceConnected ? (
            <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
              O WhatsApp do restaurante está conectado.
            </p>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
