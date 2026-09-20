import { useEffect, useState } from "react";
import {
  usePlatformSettings,
  DEFAULT_AI_AVATAR,
  DEFAULT_AI_GENERATION_PARAMS,
  AI_CONTENT_TYPES,
  AI_AVATAR_VOICES,
  AI_AVATAR_ANIMATIONS,
  AI_AVATAR_SLIDE_CONTEXTS,
  AI_AVATAR_POSITIONS,
  AI_AVATAR_SIZES,
  avatarPlacement,
  defaultVoiceForGender,
  aiRoleLabel,
  emptyAiDisciplineAvatar,
  type AiAvatarSettings,
  type AiAvatarAnimation,
  type AiAvatarPosition,
  type AiAvatarSize,
  type AiGenerationParamsSettings,
  type AiDisciplineAvatar,
  type AiContentTypeId,
} from "@/hooks/usePlatformSettings";
import AvatarGalleryPicker from "./AvatarGalleryPicker";
import VoicePreviewButton, { VOICE_SAMPLE_TEXT } from "./VoicePreviewButton";
import type { CatalogAvatar } from "@/components/study/avatarCatalog";
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

/** Mudanças aplicadas ao escolher um avatar da galeria. */
const fromCatalog = (c: CatalogAvatar, currentName: string): Partial<AiAvatarSettings> => ({
  avatar_id: c.id,
  gender: c.gender,
  voice: defaultVoiceForGender(c.gender),
  role_label: aiRoleLabel(c.gender),
  name: currentName.trim() || `${c.gender === "male" ? "Professor" : "Professora"} ${c.label.replace(" (vídeo)", "")}`,
});

/** Controles de animação e de posição/tamanho do avatar em cada tipo de slide. */
const AvatarStageFields = ({
  avatar,
  onChange,
}: {
  avatar: AiAvatarSettings;
  onChange: (changes: Partial<AiAvatarSettings>) => void;
}) => {
  const setPlacement = (
    context: (typeof AI_AVATAR_SLIDE_CONTEXTS)[number]["id"],
    changes: Partial<{ position: AiAvatarPosition; size: AiAvatarSize }>,
  ) =>
    onChange({
      placements: {
        ...(avatar.placements || {}),
        [context]: { ...avatarPlacement(avatar, context), ...changes },
      },
    });

  return (
    <div className="space-y-4 sm:col-span-2">
      <div className="space-y-2">
        <Label>Animação durante a narração</Label>
        <Select
          value={avatar.animation || "gestos"}
          onValueChange={(v) => onChange({ animation: v as AiAvatarAnimation })}
        >
          <SelectTrigger className="max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AI_AVATAR_ANIMATIONS.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Posição do avatar por tipo de slide</Label>
        <div className="space-y-2">
          {AI_AVATAR_SLIDE_CONTEXTS.map((ctx) => {
            const place = avatarPlacement(avatar, ctx.id);
            return (
              <div key={ctx.id} className="grid items-center gap-2 sm:grid-cols-3">
                <span className="text-sm text-muted-foreground">{ctx.label}</span>
                <Select value={place.position} onValueChange={(v) => setPlacement(ctx.id, { position: v as AiAvatarPosition })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_AVATAR_POSITIONS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={place.size} onValueChange={(v) => setPlacement(ctx.id, { size: v as AiAvatarSize })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_AVATAR_SIZES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/**
 * Cadastro e edição de avatares da IA em um único item:
 * o avatar padrão e os avatares vinculados a disciplinas/tipos de conteúdo.
 * Os avatares vêm de uma galeria pronta (ilustrados articulados e em vídeo).
 */
const SettingsAiAvatars = () => {
  const { data: avatarData, loading: avatarLoading, update: updateAvatar } =
    usePlatformSettings("ai_avatar");
  const { data: paramsData, loading: paramsLoading, update: updateParams } =
    usePlatformSettings("ai_generation_params");

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

  const patch = (id: string, changes: Partial<AiDisciplineAvatar>) =>
    setParams((p) => ({
      avatars: p.avatars.map((a) => (a.id === id ? { ...a, ...changes } : a)),
    }));

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
        role_label: aiRoleLabel(avatar.gender),
        voice: avatar.voice || defaultVoiceForGender(avatar.gender),
      }),
      updateParams({
        avatars: params.avatars.map((a) => ({
          ...a,
          name: a.name.trim(),
          role_label: aiRoleLabel(a.gender),
          voice: a.voice || defaultVoiceForGender(a.gender),
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
    <div className="max-w-3xl space-y-6">
      <div className="space-y-5">
        <div>
          <h3 className="font-semibold">Avatar padrão</h3>
          <p className="text-sm text-muted-foreground">
            Usado nas revisões geradas por IA quando nenhum avatar por disciplina combina.
            O gênero do avatar define a voz da narração e a legenda ({aiRoleLabel(avatar.gender)}).
          </p>
        </div>

        <AvatarGalleryPicker
          value={avatar.avatar_id}
          onSelect={(c) => setAvatar((a) => ({ ...a, ...fromCatalog(c, a.name) }))}
        />

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
            <Label>Voz da narração</Label>
            <Select
              value={avatar.voice || defaultVoiceForGender(avatar.gender)}
              onValueChange={(v) => setAvatar({ ...avatar, voice: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AI_AVATAR_VOICES.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <VoicePreviewButton
              voice={avatar.voice || defaultVoiceForGender(avatar.gender)}
              gender={avatar.gender}
            />
            <p className="text-xs text-muted-foreground">
              Vale para todas as narrações feitas com este avatar. Legenda: {aiRoleLabel(avatar.gender)}.
              Frase do exemplo: “{VOICE_SAMPLE_TEXT}”
            </p>
          </div>
          <AvatarStageFields avatar={avatar} onChange={(changes) => setAvatar({ ...avatar, ...changes })} />
        </div>
      </div>

      <div className="space-y-5 border-t border-border pt-5">
        <div>
          <h3 className="font-semibold">Avatares por disciplina</h3>
          <p className="text-sm text-muted-foreground">
            Vincule avatares da galeria a disciplinas e aos tipos de conteúdo gerados por IA.
          </p>
        </div>

        {params.avatars.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Nenhum avatar por disciplina cadastrado.
          </p>
        )}

        {params.avatars.map((av) => (
          <Card key={av.id}>
            <CardContent className="space-y-4 p-4">
              <div className="flex justify-end">
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

              <AvatarGalleryPicker
                value={av.avatar_id}
                onSelect={(c) => patch(av.id, fromCatalog(c, av.name))}
              />

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
                  <Label>Voz da narração</Label>
                  <Select
                    value={av.voice || defaultVoiceForGender(av.gender)}
                    onValueChange={(v) => patch(av.id, { voice: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_AVATAR_VOICES.map((v) => (
                        <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <VoicePreviewButton
                    voice={av.voice || defaultVoiceForGender(av.gender)}
                    gender={av.gender}
                  />
                  <p className="text-xs text-muted-foreground">
                    Legenda exibida: {aiRoleLabel(av.gender)}
                  </p>
                </div>
                <AvatarStageFields avatar={av} onChange={(changes) => patch(av.id, changes)} />
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor={`disc-${av.id}`}>Disciplinas (separadas por vírgula)</Label>
                  <Input
                    id={`disc-${av.id}`}
                    value={av.disciplines.join(", ")}
                    placeholder="Ex.: Direito, Direito Civil"
                    onChange={(e) => patch(av.id, { disciplines: e.target.value.split(",") })}
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
                        onCheckedChange={(checked) => toggleType(av, type.id, checked === true)}
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
          onClick={() => setParams((p) => ({ avatars: [...p.avatars, emptyAiDisciplineAvatar()] }))}
        >
          <Plus className="mr-2 h-4 w-4" /> Adicionar avatar
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>
    </div>
  );
};

export default SettingsAiAvatars;
