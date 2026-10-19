import { createFileRoute } from "@tanstack/react-router";
import { ShowroomPage } from "@/components/showroom/ShowroomPage";

export const Route = createFileRoute("/showroom")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Caisse showroom — Medjadja Olive" },
      { name: "description", content: "Caisse du showroom : détail, cadeaux, vente en gros, crédits clients et bons A5." },
      { property: "og:title", content: "Caisse showroom — Medjadja Olive" },
      { property: "og:description", content: "Vente au comptoir des produits Medjadja Olive." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShowroomPage,
});
