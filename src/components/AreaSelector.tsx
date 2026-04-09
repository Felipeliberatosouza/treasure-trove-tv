import { useCourseAreas } from "@/hooks/useCourseAreas";
import { Badge } from "@/components/ui/badge";

interface AreaSelectorProps {
  selected: string[];
  onChange: (areas: string[]) => void;
  max?: number;
}

const AreaSelector = ({ selected, onChange, max = 3 }: AreaSelectorProps) => {
  const { areas, loading } = useCourseAreas(true);

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((a) => a !== name));
    } else if (selected.length < max) {
      onChange([...selected, name]);
    }
  };

  if (loading) return <p className="text-xs text-muted-foreground">Carregando áreas...</p>;
  if (areas.length === 0) return null;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">
        Selecione até {max} área(s) ({selected.length}/{max})
      </p>
      <div className="flex flex-wrap gap-2">
        {areas.map((area) => {
          const isSelected = selected.includes(area.name);
          return (
            <Badge
              key={area.id}
              variant={isSelected ? "default" : "outline"}
              className={`cursor-pointer transition-colors ${
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-secondary"
              } ${!isSelected && selected.length >= max ? "opacity-40 cursor-not-allowed" : ""}`}
              onClick={() => toggle(area.name)}
            >
              {area.name}
            </Badge>
          );
        })}
      </div>
    </div>
  );
};

export default AreaSelector;
