import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { useCourseAreas } from "@/hooks/useCourseAreas";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface AreaSelectorProps {
  selected: string[];
  onChange: (areas: string[]) => void;
  max?: number;
}

const SEARCH_THRESHOLD = 10;

const AreaSelector = ({ selected, onChange, max = 3 }: AreaSelectorProps) => {
  const { areas, loading } = useCourseAreas(true);
  const [search, setSearch] = useState("");

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter((a) => a !== name));
    } else if (selected.length < max) {
      onChange([...selected, name]);
    }
  };

  const sortedAreas = useMemo(
    () =>
      [...areas].sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
      ),
    [areas]
  );

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const filteredAreas = useMemo(() => {
    const q = normalize(search.trim());
    if (!q) return sortedAreas;
    return sortedAreas.filter((a) => normalize(a.name).includes(q));
  }, [sortedAreas, search]);

  if (loading) return <p className="text-xs text-muted-foreground">Carregando áreas...</p>;
  if (areas.length === 0) return null;

  const showSearch = areas.length > SEARCH_THRESHOLD;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">
        Selecione até {max} área(s) ({selected.length}/{max})
      </p>

      {showSearch && (
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar área..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 bg-secondary text-accent-foreground placeholder:text-accent-foreground/60"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {filteredAreas.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhuma área encontrada.</p>
        ) : (
          filteredAreas.map((area) => {
            const isSelected = selected.includes(area.name);
            return (
              <Badge
                key={area.id}
                variant="default"
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-blue-500 text-white hover:bg-blue-600"
                    : "bg-black text-white hover:bg-neutral-800"
                } ${!isSelected && selected.length >= max ? "opacity-40 cursor-not-allowed" : ""}`}
                onClick={() => toggle(area.name)}
              >
                {area.name}
              </Badge>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AreaSelector;
