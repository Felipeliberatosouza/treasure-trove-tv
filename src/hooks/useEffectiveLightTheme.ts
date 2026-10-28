import { useEffect, useState } from "react";

/** Tela clara efetiva: considera o tema festivo (data-seasonal) acima do tema base (data-theme). */
const read = () => {
  if (typeof document === "undefined") return false;
  const r = document.documentElement;
  return (r.getAttribute("data-seasonal") || r.getAttribute("data-theme")) === "light";
};

export function useEffectiveLightTheme() {
  const [light, setLight] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setLight(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-seasonal"] });
    setLight(read());
    return () => obs.disconnect();
  }, []);
  return light;
}
