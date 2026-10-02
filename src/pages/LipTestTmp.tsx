import LipSyncVideoAvatar from "@/components/study/LipSyncVideoAvatar";
import { findCatalogAvatar } from "@/components/study/avatarCatalog";
const LipTestTmp = () => {
  const v = new URLSearchParams(location.search).get("v") as any;
  const ids = ["vid-ana", "vid-bia", "vid-helena", "vid-lucas", "vid-tiago", "vid-rafael"];
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(3,300px)", gap: 10 }}>
    {ids.map((id) => { const c = findCatalogAvatar(id)!; return <div key={id} style={{ width: 300, height: 300 }}>
      <LipSyncVideoAvatar url={c.videoUrl!} trackKey={c.mouthTrack!} alt={id} speaking={v !== "rest"} viseme={v === "rest" ? null : v} phrase="Olá, vamos juntos!" /></div>; })}
  </div>;
};
export default LipTestTmp;
