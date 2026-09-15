import { permanentRedirect } from "next/navigation";

// 308 (permanente): `/` nunca sirvió contenido propio, siempre fue un alias de
// `/eventos` — no hay plan de que deje de serlo. Un 307 le dice a los crawlers
// que revisen de nuevo en cada rastreo; 308 deja que cacheen la redirección y
// transfieran el "link equity" de `/` a `/eventos`.
export default function Home() {
  permanentRedirect("/eventos");
}
