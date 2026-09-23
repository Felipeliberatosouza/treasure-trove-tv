/**
 * Helpers de exibição unificada dos cards de conteúdo
 * (aulas gravadas por professor e aulas com professor virtual).
 */

/** Formata segundos em MM:SS ou H:MM:SS. */
export const formatDuration = (seconds?: number | null): string => {
  if (!seconds || seconds <= 0) return "";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

/** Estimativa de duração da narração dos slides (≈14 caracteres por segundo + respiro). */
export const estimateSlidesDuration = (slides?: { narracao?: string }[] | null): number => {
  if (!Array.isArray(slides) || slides.length === 0) return 0;
  const chars = slides.reduce((acc, s) => acc + (s?.narracao?.length || 0), 0);
  return Math.round(chars / 14 + slides.length * 2.5);
};

/** "Prof." / "Profa." conforme o gênero do avatar. */
export const shortRoleLabel = (gender?: string | null): string =>
  (gender || "").toLowerCase().startsWith("f") ? "Profa." : "Prof.";

/** Nome exibido abaixo do card para conteúdo de professor virtual. */
export const aiInstructorLabel = (gender: string | undefined, name: string): string =>
  `${shortRoleLabel(gender)} virtual ${name} — IA Revisão Fácil`.replace(/\s+/g, " ").trim();

/** Frase da barra cinza sobre o vídeo, para professor virtual. */
export const aiOverlayLabel = (gender: string | undefined, name: string): string =>
  `Aula com ${shortRoleLabel(gender).toLowerCase()} virtual ${name}`.replace(/\s+/g, " ").trim();

/** Frase da barra cinza sobre o vídeo, para professor real. */
export const teacherOverlayLabel = (name?: string | null): string =>
  name ? `Aula com Prof. ${name}` : "Aula gravada por professor";

/**
 * Nome exibido abaixo do card para professor real.
 * Sem nome cadastrado, não exibimos rótulo genérico (a frase
 * "Aula gravada por professor" fica apenas sobre a capa).
 */
export const teacherInstructorLabel = (name?: string | null): string =>
  name ? `Prof. ${name}` : "";
