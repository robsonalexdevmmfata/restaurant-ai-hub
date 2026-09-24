import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { AppShell, Card, Skeleton } from "@/components/app-shell";
import { Btn, Field, inputCls, Modal, PageGate, useLoad } from "@/components/kit";
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

const roles = ["ADMIN", "GERENTE", "GARCOM", "COZINHA", "CAIXA", "ENTREGADOR"];

function UsuariosPage() {
  const { tenant } = useRequireTenant();
  const users = useLoad(() => data.listUsers(), []);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "GARCOM" });
  const [err, setErr] = useState("");
  if (!tenant) return <PageGate />;

  async function save() {
    try {
      await data.createUser(f);
      setOpen(false); setF({ name: "", email: "", password: "", role: "GARCOM" });
      users.reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <AppShell tenant={tenant} title="Usuários" subtitle="Equipe do restaurante e suas permissões" action={<Btn onClick={() => setOpen(true)}><Plus className="size-4" /> Novo usuário</Btn>}>
      {!users.data ? <Skeleton className="h-48" /> : (
        <Card className="divide-y divide-black/5">
          {users.data.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="grid size-9 place-items-center rounded-full bg-brand/10 text-[13px] font-semibold text-brand-deep">{(u.name ?? u.email)[0]?.toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{u.name ?? "Sem nome"}</p>
                <p className="truncate text-[12px] text-stone-500">{u.email}</p>
              </div>
              {u.role === "OWNER" ? <span className="text-[12px] font-medium">{roleLabel.OWNER}</span> : (
                <>
                  <select className="rounded-md bg-white px-2 py-1.5 text-[12px] ring-1 ring-black/10" value={u.role} onChange={async (e) => { await data.updateUser(u.id, { role: e.target.value }); users.reload(); }}>
                    {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
                  </select>
                  <Btn variant="ghost" onClick={async () => { await data.updateUser(u.id, { isActive: !u.isActive }); users.reload(); }}>{u.isActive ? "Desativar" : "Ativar"}</Btn>
                  <Btn variant="danger" aria-label="Excluir" onClick={async () => { if (confirm("Excluir usuário?")) { await data.deleteUser(u.id); users.reload(); } }}><Trash2 className="size-4" /></Btn>
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
          <Field label="Senha"><input type="password" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
          <Field label="Função">
            <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              {roles.map((r) => <option key={r} value={r}>{roleLabel[r]}</option>)}
            </select>
          </Field>
          {err ? <p className="text-[12px] text-red-600">{err}</p> : null}
          <Btn className="w-full" onClick={save}>Criar usuário</Btn>
        </div>
      </Modal>
    </AppShell>
  );
}
