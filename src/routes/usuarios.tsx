import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Btn, Field, inputCls, Modal, PageGate, useLoad } from "@/components/kit";
import { getToken } from "@/lib/api";
import { data, roleLabel } from "@/lib/data";
import { useRequireTenant } from "@/lib/use-require-tenant";

export const Route = createFileRoute("/usuarios")({
  head: () => ({
    meta: [
      { title: "Equipe e permissões — RestauranteAI" },
      { name: "description", content: "Gerencie usuários e permissões do restaurante." },
      { property: "og:title", content: "Equipe e permissões — RestauranteAI" },
      { property: "og:description", content: "Gerencie usuários e permissões do restaurante." },
    ],
  }),
  component: UsuariosPage,
});

const roles = ["gerente", "atendente", "cozinha", "caixa", "motoboy"] as const;

function UsuariosPage() {
  const { tenant } = useRequireTenant(["owner", "gerente"]);
  const users = useLoad(() => data.listUsers(), [tenant?.restaurantSlug]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "cozinha" });
  const [err, setErr] = useState("");
  const [actionError, setActionError] = useState("");
  const hasBackendSession = Boolean(getToken());
  if (!tenant) return <PageGate />;

  async function save() {
    if (!hasBackendSession) {
      setErr("Entre por uma conta conectada ao backend para criar um acesso persistente.");
      return;
    }
    try {
      await data.createUser(f);
      setOpen(false); setF({ name: "", email: "", password: "", role: "cozinha" }); setErr("");
      users.reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Não foi possível criar o usuário."); }
  }

  async function updateUser(id: number, input: { role?: string; isActive?: boolean }) {
    try {
      await data.updateUser(id, input);
      setActionError("");
      users.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível atualizar o usuário.");
    }
  }

  async function removeUser(id: number) {
    if (!hasBackendSession) return;
    if (!confirm("Excluir o acesso deste usuário?")) return;
    try {
      await data.deleteUser(id);
      setActionError("");
      users.reload();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível excluir o usuário.");
    }
  }

  return (
    <AppShell tenant={tenant} title="Usuários" subtitle="Acessos exclusivos da equipe deste restaurante" action={<Btn disabled={!hasBackendSession} onClick={() => setOpen(true)}><Plus className="size-4" /> Novo usuário</Btn>}>
      <div className="mb-4 rounded-xl border border-brand/15 bg-brand/5 p-4 text-[13px] text-stone-700">
        <p className="font-semibold">Equipe de {tenant.restaurant}</p>
        <p className="mt-1 text-stone-600">
          Os logins são vinculados ao restaurante <span className="font-medium">{tenant.restaurantSlug}</span> no servidor. A equipe entra pelo mesmo endereço usando seu e-mail e senha; não precisa informar slug.
        </p>
        {!hasBackendSession && <p className="mt-2 font-medium text-amber-800">Modo demonstração: conecte o backend e entre com uma conta persistida para cadastrar usuários reais.</p>}
      </div>
      {users.error && <p role="alert" className="mb-3 text-[13px] text-red-700">{users.error}</p>}
      {actionError && <p role="alert" className="mb-3 text-[13px] text-red-700">{actionError}</p>}
      {!users.data ? <Skeleton className="h-48" /> : (
        <Card className="divide-y divide-black/5">
          {users.data.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="grid size-9 place-items-center rounded-full bg-brand/10 text-[13px] font-semibold text-brand-deep">{(u.name ?? u.email)[0]?.toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{u.name ?? "Sem nome"}</p>
                <p className="truncate text-[12px] text-stone-500">{u.email}</p>
              </div>
              {u.role === "owner" || u.role === "OWNER" ? <span className="text-[12px] font-medium">{roleLabel[u.role] ?? "Proprietário"}</span> : (
                <>
                  <select disabled={!hasBackendSession} className="rounded-md bg-white px-2 py-1.5 text-[12px] ring-1 ring-black/10 disabled:opacity-60" value={u.role} onChange={(e) => void updateUser(u.id, { role: e.target.value })}>
                    {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                  </select>
                  <Btn disabled={!hasBackendSession} variant="ghost" onClick={() => void updateUser(u.id, { isActive: !u.isActive })}>{u.isActive ? "Desativar" : "Ativar"}</Btn>
                  <Btn disabled={!hasBackendSession} variant="danger" aria-label="Excluir" onClick={() => void removeUser(u.id)}><Trash2 className="size-4" /></Btn>
                </>
              )}
            </div>
          ))}
        </Card>
      )}
      <Modal open={open} title="Novo usuário" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <Field label="Nome"><input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="E-mail"><input type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Senha (mínimo 6 caracteres)"><input minLength={6} required type="password" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Função">
            <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
            </select>
          </Field>
          {err ? <p className="text-[12px] text-red-600">{err}</p> : null}
          <Btn disabled={!hasBackendSession} className="w-full" onClick={save}>Criar usuário</Btn>
        </div>
      </Modal>
    </AppShell>
  );
}
