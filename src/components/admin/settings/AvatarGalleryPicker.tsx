import { AVATAR_CATALOG, type CatalogAvatar } from "@/components/study/avatarCatalog";
import RiggedAvatar from "@/components/study/RiggedAvatar";
import { Label } from "@/components/ui/label";

interface AvatarGalleryPickerProps {
  value?: string;
  onSelect: (avatar: CatalogAvatar) => void;
}

const Preview = ({ avatar }: { avatar: CatalogAvatar }) => {
  if (avatar.kind === "video" && avatar.videoUrl) {
    return <video src={avatar.videoUrl} className="h-full w-full object-cover" muted loop autoPlay playsInline />;
  }
  return avatar.style ? (
    <div className="flex h-full w-full items-end justify-center bg-secondary">
      <RiggedAvatar style={avatar.style} speaking gestures />
    </div>
  ) : null;
};

/** Galeria de avatares prontos (ilustrados articulados e em vídeo) para escolha do administrador. */
const AvatarGalleryPicker = ({ value, onSelect }: AvatarGalleryPickerProps) => {
  const groups: { title: string; items: CatalogAvatar[] }[] = [
    { title: "Personagens ilustrados (mexem boca, braços e mãos)", items: AVATAR_CATALOG.filter((a) => a.kind === "ilustrado") },
    { title: "Avatares em vídeo (pessoas reais)", items: AVATAR_CATALOG.filter((a) => a.kind === "video") },
  ];

  return (
    <div className="space-y-4">
      <Label>Escolha o avatar</Label>
      {groups.map((group) => (
        <div key={group.title} className="space-y-2">
          <p className="text-xs text-muted-foreground">{group.title}</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {group.items.map((av) => (
              <button
                key={av.id}
                type="button"
                onClick={() => onSelect(av)}
                aria-pressed={value === av.id}
                className={`space-y-1 rounded-lg border-2 p-1 transition-colors ${
                  value === av.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                }`}
              >
                <span className="block aspect-square overflow-hidden rounded-full border border-border">
                  <Preview avatar={av} />
                </span>
                <span className="block truncate text-center text-[11px]">{av.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default AvatarGalleryPicker;
