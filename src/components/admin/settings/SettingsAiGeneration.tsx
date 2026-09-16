import { useEffect, useState } from "react";
import {
  usePlatformSettings,
  DEFAULT_AI_AVATAR,
  DEFAULT_AI_GENERATION_PARAMS,
  AI_CONTENT_TYPES,
  emptyAiDisciplineAvatar,
  type AiAvatarSettings,
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
import { Save, Loader2, Plus, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import professoraIa from "@/assets/professora-ia.jpg";

type SubTab = "avatar" | "disciplinas";

const SettingsAiGeneration = () => {
  const [subTab, setSubTab] = useState<SubTab>("avatar");

  // Avatar padrão (fallback usado quando nenhum avatar por disciplina combina).
  const {
    data: avatarData,
    loading: avatarLoading,
    update: updateAvatar,
  } = usePlatformSettings("ai_avatar");
  const { data: paramsData, loading: paramsLoading, update: updateParams } =
    usePlatformSettings("ai_generation_params");
  const { upload, uploading } = useStorageUpload("platform-assets");

  const [avatar, setAvatar] = useState<AiAvatarSettings>(DEFAULT_AI_AVATAR);
  const [params, setParams] = useState<AiGenerationParamsSettings>(DEFAULT_AI_GENERATION_PARAMS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (avatarData) setAvatar({ ...DEFAULT_AI_AVATAR, ...(avatarData as AiAvatarSettings) });
  }, [avatarData]);

  useEffect(() => {
    if (paramsData) {
      setParams({ avatars: Array.isArray(paramsData.avatars) ? paramsData.avatars : [] });
    }
  }, [paramsData]);

  const handleAvatarUpload = async (file: File | undefined) => {
    if (!file) return;
    const url = await upload(file, `ai-avatar/${Date.now()}-${file.name}`);
    if (url) setAvatar((a) => ({ ...a, image_url: url }));
  };

  const patch = (id: string, changes: Partial<AiDisciplineAvatar>) =>
    setParams((p) => ({
      avatars: p.avatars.map((a) => (a.id === id ? { ...a, ...changes } : a)),
    }));

  const handleDisciplineUpload = async (id: string, file: File | undefined) => {
    if (!file) return;
    const url = await upload(file, `ai-avatar/${Date.now()}-${file.name}`);
    if (url) patch(id, { image_url: url });
  };

  const toggleType = (av: AiDisciplineAvatar, type: AiContentTypeId, checked: boolean) => {
    const next = checked
      ? [...av.content_types, type]
      : av.content_types.filter((t) => t !== type);
    patch(av.id, { content_types: next });
  };

  const handleSave = async () => {
    if (!avatar.name.trim()) {
      toast.error("Informe o nome do avatar padrão.");
      return;
    }
    if (params.avatars.some((a) => !a.name.trim())) {
      toast.error("Informe o nome de todos os avatares por disciplina.");
      return;
    }
    setSaving(true);
    await Promise.all([
      updateAvatar({
        ...avatar,
        name: avatar.name.trim(),
        role_label: avatar.role_label.trim(),
      }),
      updateParams({
        avatars: params.avatars.map((a) => ({
          ...a,
          name: a.name.trim(),
          role_label: a.role_label.trim(),
          disciplines: a.disciplines.map((d) => d.trim()).filter(Boolean),
        })),
      }),
    ]);
    setSaving(false);
    toast.success("Parâmetros de IA salvos.");
  };

  if (avatarLoading || paramsLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      {/* Sub-abas dentro de Parâmetros de IA */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSubTab("avatar")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
            subTab === "avatar"
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Avatar
        </button>
        <button
          onClick={() => setSubTab("disciplinas")}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors ${
            subTab === "disciplinas"
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Avatares por disciplina
        </button>
      </div>

      {subTab === "avatar" && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Este é o avatar padrão da plataforma, usado nas revisões geradas por IA quando
            nenhum avatar por disciplina combina. O gênero selecionado define a voz da narração.
          </p>

          <div className="flex items-center gap-4">
            <img
              src={avatar.image_url || professoraIa}
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
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
                />
                {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                {!uploading && <Sparkles className="h-4 w-4 text-muted-foreground" />}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-avatar-name">Nome do avatar</Label>
              <Input
                id="ai-avatar-name"
                value={avatar.name}
                onChange={(e) => setAvatar({ ...avatar, name: e.target.value })}
                placeholder="Ex.: Professora Ana"
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-avatar-role">Legenda</Label>
              <Input
                id="ai-avatar-role"
                value={avatar.role_label}
                onChange={(e) => setAvatar({ ...avatar, role_label: e.target.value })}
                placeholder="Ex.: Professora virtual"
                maxLength={60}
              />
            </div>
            <div className="space-y-2">
              <Label>Gênero (voz da narração)</Label>
              <Select
                value={avatar.gender}
                onValueChange={(v) =>
                  setAvatar({ ...avatar, gender: v as AiAvatarSettings["gender"] })
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
              <Label htmlFor="ai-avatar-url">URL da imagem (opcional)</Label>
              <Input
                id="ai-avatar-url"
                value={avatar.image_url}
                onChange={(e) => setAvatar({ ...avatar, image_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Precisa de avatares diferentes para cada disciplina? Vá em
            <button
              className="mx-1 underline text-foreground"
              onClick={() => setSubTab("disciplinas")}
            >
              Avatares por disciplina
            </button>
            para cadastrar e vincular avatares específicos.
          </p>
        </div>
      )}

      {subTab === "disciplinas" && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Crie avatares por disciplina e vincule cada um aos tipos de conteúdo gerados por IA.
            Quando nenhum avatar combinar com a disciplina, a plataforma usa o avatar padrão.
            O gênero escolhido define a voz da narração.
          </p>

          {params.avatars.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Nenhum avatar por disciplina cadastrado.
            </p>
          )}

          {params.avatars.map((av) => (
            <Card key={av.id}>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={av.image_url || professoraIa}
                      alt={`Prévia do avatar ${av.name || "sem nome"}`}
                      className="h-16 w-16 rounded-full border-2 border-primary object-cover"
                    />
                    <div className="space-y-2">
                      <Label htmlFor={`file-${av.id}`}>Imagem</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`file-${av.id}`}
                          type="file"
                          accept="image/*"
                          className="max-w-xs"
                          onChange={(e) => handleDisciplineUpload(av.id, e.target.files?.[0])}
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
                      setParams((p) => ({ avatars: p.avatars.filter((a) => a.id !== av.id) }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`name-${av.id}`}>Nome do avatar</Label>
                    <Input
                      id={`name-${av.id}`}
                      value={av.name}
                      maxLength={60}
                      placeholder="Ex.: Professor Lucas"
                      onChange={(e) => patch(av.id, { name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`role-${av.id}`}>Legenda</Label>
                    <Input
                      id={`role-${av.id}`}
                      value={av.role_label}
                      maxLength={60}
                      placeholder="Ex.: Professor virtual"
                      onChange={(e) => patch(av.id, { role_label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gênero (voz da narração)</Label>
                    <Select
                      value={av.gender}
                      onValueChange={(v) =>
                        patch(av.id, { gender: v as AiDisciplineAvatar["gender"] })
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
                    <Label htmlFor={`disc-${av.id}`}>Disciplinas (separadas por vírgula)</Label>
                    <Input
                      id={`disc-${av.id}`}
                      value={av.disciplines.join(", ")}
                      placeholder="Ex.: Direito, Direito Civil"
                      onChange={(e) =>
                        patch(av.id, { disciplines: e.target.value.split(",") })
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
                          checked={av.content_types.includes(type.id)}
                          onCheckedChange={(checked) =>
                            toggleType(av, type.id, checked === true)
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

          <Button
            variant="outline"
            onClick={() =>
              setParams((p) => ({ avatars: [...p.avatars, emptyAiDisciplineAvatar()] }))
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar avatar
          </Button>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
};

export default SettingsAiGeneration;
