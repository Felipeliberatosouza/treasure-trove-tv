import { useEffect, useRef, useState } from "react";
import type { Viseme } from "@/utils/phonemeLipSync";

/** Postura dos braços: rotação (graus) de braço e antebraço de cada lado. */
export interface GesturePose {
  armL: number;
  armR: number;
  foreL: number;
  foreR: number;
  head: number;
}

const REST: GesturePose = { armL: 6, armR: -6, foreL: 0, foreR: 0, head: 0 };

/** Gestos variados: explicar, enfatizar, apontar para o quadro e mão aberta. */
const POSES: GesturePose[] = [
  { armL: -22, armR: -6, foreL: -30, foreR: 0, head: -1.5 }, // explica com a mão esquerda
  { armL: 6, armR: 24, foreL: 0, foreR: 32, head: 1.5 }, // explica com a mão direita
  { armL: -14, armR: 14, foreL: -20, foreR: 20, head: 0 }, // ênfase com as duas mãos
  { armL: 6, armR: 40, foreL: 0, foreR: 10, head: 3 }, // aponta para o quadro
  { armL: -8, armR: 8, foreL: -40, foreR: 40, head: -1 }, // mãos abertas, acolhendo
];

/**
 * Gestos orientados pela fala: braços descansam nas pausas e trocam de postura
 * em intervalos irregulares (4–7 s), sem repetir o mesmo gesto em seguida.
 */
export const useNaturalGestures = (active: boolean, viseme?: Viseme | null): GesturePose => {
  const [pose, setPose] = useState<GesturePose>(REST);
  const lastIdx = useRef(-1);
  const silentSince = useRef<number | null>(null);
  const [pausing, setPausing] = useState(false);

  // Detecta pausas reais na fala (silêncio > 450 ms) pelos tempos da ElevenLabs.
  useEffect(() => {
    if (!active) return;
    if (viseme && viseme !== "rest") {
      silentSince.current = null;
      setPausing(false);
      return;
    }
    if (viseme === "rest") {
      silentSince.current ??= performance.now();
      const t = window.setTimeout(() => setPausing(true), 450);
      return () => window.clearTimeout(t);
    }
  }, [active, viseme]);

  useEffect(() => {
    if (!active || pausing) {
      setPose(REST);
      return;
    }
    let timer = 0;
    const next = () => {
      let i = Math.floor(Math.random() * POSES.length);
      if (i === lastIdx.current) i = (i + 1) % POSES.length;
      lastIdx.current = i;
      // Alterna gesto e postura neutra para não parecer mecânico.
      setPose(Math.random() < 0.3 ? REST : POSES[i]);
      timer = window.setTimeout(next, 4000 + Math.random() * 3000);
    };
    timer = window.setTimeout(next, 600 + Math.random() * 900);
    return () => window.clearTimeout(timer);
  }, [active, pausing]);

  return pose;
};
