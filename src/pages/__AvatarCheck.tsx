import RiggedAvatar from "@/components/study/RiggedAvatar";
import { AVATAR_CATALOG } from "@/components/study/avatarCatalog";
export default function P(){return <div style={{display:"flex",flexWrap:"wrap",gap:12,padding:20,background:"#ddd"}}>{AVATAR_CATALOG.filter(a=>a.style).map((a,i)=><div key={a.id} style={{width:200,height:220,background:"#fff"}}><RiggedAvatar style={a.style!} speaking={false} viseme={i%2?"A":"rest"}/></div>)}</div>}
