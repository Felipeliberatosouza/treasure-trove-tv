import { useEffect, useState } from "react";
import {
  usePlatformSettings,
  DEFAULT_AI_GENERATION_PARAMS,
  AI_CONTENT_TYPES,
  emptyAiDisciplineAvatar,
  type AiGenerationParamsSettings,
  type AiDisciplineAvatar,
  type AiContentTypeId,
} from "@/hooks/usePlatformSettings";
import { useStorageUpload } from "@/hooks/useStorageUpload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import professoraIa from "@/assets/professora-ia.jpg";

const SettingsAiGeneration = () => {
  const { data, loading, update } = usePlatformSettings("ai_generation_params");
  const { upload, uploading } = useStorageUpload("platform-assets");
  const [form, setForm] = useState<AiGenerationParamsSettings>(DEFAULT_AI_GENERATION_PARAMS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({ avatars: Array.isArray(data.avatars) ? data.avatars : [] });
    }
  }, [data]);

  const patch = (id: string, changes: Partial<AiDisciplineAvatar>) =>
    setForm((f) => ({
      avatars: f.avatars.map((a) => (a.id === id ? { ...a, ...changes } : a)),
    }));

  const handleUpload = async (id: string, file: File | undefined) => {
    if (!file) return;
    const url = await upload(file, `ai-avatar/${Date.now()}-${file.name}`);
    if (url) patch(id, { image_url: url });
  };

  const toggleType = (avatar: AiDisciplineAvatar, type: AiContentTypeId, checked: boolean) => {
    const next = checked
      ? [...avatar.content_types, type]
      : avatar.content_types.filter((t) => t !== type);
    patch(avatar.id, { content_types: next });
  };

  const handleSave = async () => {
    if (form.avatars.some((a) => !a.name.trim())) {
      toast.error("Informe o nome de todos os avatares.");
      return;
    }
    setSaving(true);
    await update({
      avatars: form.avatars.map((a) => ({
        ...a,
        name: a.name.trim(),
        role_label: a.role_label.trim(),
        disciplines: a.disciplines.map((d) => d.trim()).filter(Boolean),
      })),
    });
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
    <div className="max-w-3xl space-y-5">
      <p className="text-sm text-muted-foreground">
        Crie avatares por disciplina e vincule cada um aos tipos de conteúdo gerados por IA.
        Quando nenhum avatar combinar com a disciplina, a plataforma usa o avatar padrão
        definido em “Avatar da IA”. O gênero escolhido define a voz da narração.
      </p>

      {form.avatars.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nenhum avatar por disciplina cadastrado.
        </p>
      )}

      {form.avatars.map((avatar) => (
        <Card key={avatar.id}>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={avatar.image_url || professoraIa}
                  alt={`Prévia do avatar ${avatar.name || "sem nome"}`}
                  className="h-16 w-16 rounded-full border-2 border-primary object-cover"
                />
                <div className="space-y-2">
                  <Label htmlFor={`file-${avatar.id}`}>Imagem</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`file-${avatar.id}`}
                      type="file"
                      accept="image/*"
                      className="max-w-xs"
                      onChange={(e) => handleUpload(avatar.id, e.target.files?.[0])}
                    />
                    {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Remover avatar"
                onClick={() =>
                  setForm((f) => ({ avatars: f.avatars.filter((a) => a.id !== avatar.id) }))
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`name-${avatar.id}`}>Nome do avatar</Label>
                <Input
                  id={`name-${avatar.id}`}
                  value={avatar.name}
                  maxLength={60}
                  placeholder="Ex.: Professor Lucas"
                  onChange={(e) => patch(avatar.id, { name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`role-${avatar.id}`}>Legenda</Label>
                <Input
                  id={`role-${avatar.id}`}
                  value={avatar.role_label}
                  maxLength={60}
                  placeholder="Ex.: Professor virtual"
                  onChange={(e) => patch(avatar.id, { role_label: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Gênero (voz da narração)</Label>
                <Select
                  value={avatar.gender}
                  onValueChange={(v) =>
                    patch(avatar.id, { gender: v as AiDisciplineAvatar["gender"] })
                  }
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
                <Label htmlFor={`disc-${avatar.id}`}>Disciplinas (separadas por vírgula)</Label>
                <Input
                  id={`disc-${avatar.id}`}
                  value={avatar.disciplines.join(", ")}
                  placeholder="Ex.: Direito, Direito Civil"
                  onChange={(e) =>
                    patch(avatar.id, { disciplines: e.target.value.split(",") })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tipos de conteúdo vinculados</Label>
              <div className="flex flex-wrap gap-4">
                {AI_CONTENT_TYPES.map((type) => (
                  <label key={type.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={avatar.content_types.includes(type.id)}
                      onCheckedChange={(checked) =>
                        toggleType(avatar, type.id, checked === true)
                      }
                    />
                    {type.label}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Sem seleção, o avatar vale para todos os tipos de conteúdo.
              </p>
            </div>
          </CardContent>
        </Card>
      ))}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setForm((f) => ({ avatars: [...f.avatars, emptyAiDisciplineAvatar()] }))
          }
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar avatar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
};

export default SettingsAiGeneration;
