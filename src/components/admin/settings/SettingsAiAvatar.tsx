import { useEffect, useState } from "react";
import {
  usePlatformSettings,
  DEFAULT_AI_AVATAR,
  type AiAvatarSettings,
} from "@/hooks/usePlatformSettings";
import { useStorageUpload } from "@/hooks/useStorageUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import professoraIa from "@/assets/professora-ia.jpg";

const SettingsAiAvatar = () => {
  const { data, loading, update } = usePlatformSettings("ai_avatar");
  const { upload, uploading } = useStorageUpload("platform-assets");
  const [form, setForm] = useState<AiAvatarSettings>(DEFAULT_AI_AVATAR);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setForm({ ...DEFAULT_AI_AVATAR, ...(data as AiAvatarSettings) });
  }, [data]);

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const url = await upload(file, `ai-avatar/${Date.now()}-${file.name}`);
    if (url) setForm((f) => ({ ...f, image_url: url }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do avatar.");
      return;
    }
    setSaving(true);
    await update({ ...form, name: form.name.trim(), role_label: form.role_label.trim() });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-muted-foreground">
        Este avatar aparece na capa e nos slides das revisões geradas por IA. O gênero
        selecionado também define a voz da narração.
      </p>

      <div className="flex items-center gap-4">
        <img
          src={form.image_url || professoraIa}
          alt="Prévia do avatar da IA"
          className="h-20 w-20 rounded-full border-2 border-primary object-cover"
        />
        <div className="space-y-2">
          <Label htmlFor="ai-avatar-file">Imagem do avatar</Label>
          <div className="flex items-center gap-2">
            <Input
              id="ai-avatar-file"
              type="file"
              accept="image/*"
              className="max-w-xs"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {!uploading && <Upload className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ai-avatar-name">Nome do avatar</Label>
          <Input
            id="ai-avatar-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex.: Professora Ana"
            maxLength={60}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-avatar-role">Legenda</Label>
          <Input
            id="ai-avatar-role"
            value={form.role_label}
            onChange={(e) => setForm({ ...form, role_label: e.target.value })}
            placeholder="Ex.: Professora virtual"
            maxLength={60}
          />
        </div>
        <div className="space-y-2">
          <Label>Gênero (voz da narração)</Label>
          <Select
            value={form.gender}
            onValueChange={(v) => setForm({ ...form, gender: v as AiAvatarSettings["gender"] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Feminino</SelectItem>
              <SelectItem value="male">Masculino</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ai-avatar-url">URL da imagem (opcional)</Label>
          <Input
            id="ai-avatar-url"
            value={form.image_url}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            placeholder="https://…"
          />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salvar
      </Button>
    </div>
  );
};

export default SettingsAiAvatar;
