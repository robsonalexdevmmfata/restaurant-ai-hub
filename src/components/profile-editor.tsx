import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { Btn, Field, inputCls, Modal } from "@/components/kit";
import { updateProfile, type Tenant } from "@/lib/auth";
import { validateImageUpload } from "@/lib/media-validation";
import { showToast } from "@/lib/toast";

export function ProfileEditor({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const [name, setName] = useState(tenant.name);
  const [avatar, setAvatar] = useState(tenant.avatar);
  const [error, setError] = useState("");
  function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const issue = validateImageUpload(file);
    if (issue) { setError(issue); return; }
    const reader = new FileReader();
    reader.onload = () => { setAvatar(String(reader.result)); setError(""); };
    reader.readAsDataURL(file);
  }
  return <Modal open title="Meu perfil" onClose={onClose}>
    <form className="space-y-4" onSubmit={(event) => {
      event.preventDefault();
      try { updateProfile({ name, avatar }); showToast({ title: "Perfil atualizado", variant: "success" }); onClose(); }
      catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar."); }
    }}>
      <div className="flex items-center gap-4">
        <img src={avatar} alt="Foto do perfil" className="size-20 rounded-full object-cover" />
        <label className="flex cursor-pointer items-center gap-2 text-sm text-brand"><ImagePlus className="size-4" /> Alterar foto
          <input type="file" aria-label="Foto do perfil" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={upload} />
        </label>
      </div>
      <Field label="Nome"><input required className={inputCls} value={name} onChange={(event) => setName(event.target.value)} /></Field>
      <Field label="E-mail"><input className={inputCls} value={tenant.email} readOnly /></Field>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Btn type="submit" className="w-full">Salvar perfil</Btn>
    </form>
  </Modal>;
}