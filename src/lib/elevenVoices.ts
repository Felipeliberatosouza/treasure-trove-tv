/** Vozes ElevenLabs disponíveis para os professores virtuais. */
export const ELEVEN_FEMALE_VOICES = [
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice" },
  { id: "EXAVITQu4vr4xnSDxMaL", label: "Sarah" },
  { id: "FGY2WhTYpPnrIDTdsKH5", label: "Laura" },
  { id: "XrExE9yKIg1WjnnlVkGX", label: "Matilda" },
  { id: "cgSgspJ2msm6clMCkdW9", label: "Jessica" },
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily" },
];
export const ELEVEN_MALE_VOICES = [
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel" },
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George" },
  { id: "CwhRBWXzGAHq8TQ4Fs17", label: "Roger" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam" },
  { id: "cjVigY5qzO86Huf0OWal", label: "Eric" },
];
export const elevenVoicesFor = (g: "male" | "female") =>
  g === "male" ? ELEVEN_MALE_VOICES : ELEVEN_FEMALE_VOICES;
