import { useEffect, useState } from "react";
import LipSyncVideoAvatar from "@/components/study/LipSyncVideoAvatar";
import { AVATAR_CATALOG } from "@/components/study/avatarCatalog";
import type { Viseme } from "@/utils/phonemeLipSync";
const seq: Viseme[] = ["A", "A", "O", "E", "MBP", "A"];
export default function LipHarness() {
  const v = (new URLSearchParams(location.search).get("v") as Viseme) || "A";
  return <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{AVATAR_CATALOG.filter(a => a.kind === "video").map(a => (
    <div key={a.id} style={{ width: 300, height: 300 }}><LipSyncVideoAvatar url={a.videoUrl!} trackKey={a.mouthTrack!} alt="" speaking viseme={v} /></div>))}</div>;
}
