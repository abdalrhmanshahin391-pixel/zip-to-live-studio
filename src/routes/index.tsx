import { createFileRoute } from "@tanstack/react-router";
import { ProHome } from "@/components/home/procreate/ProHome";
import { InstallAppBanner } from "@/components/InstallAppButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RitaJet — Learn. Recall. Pass." },
      {
        name: "description",
        content:
          "RitaJet turns your notes and lecture PDFs into smart flashcards, clean one-page summaries and AI-written practice questions.",
      },
      { property: "og:title", content: "RitaJet — Learn. Recall. Pass." },
      {
        property: "og:description",
        content:
          "Flashcards, PDF summaries and AI practice questions from your own study material.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ritajet.com/" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:image",
        content:
          "https://ritajet.com/__l5e/assets-v1/d79e87a3-84a5-47e3-aafe-db3d8230e0b1/rita-ipad-screen.jpg",
      },
      {
        name: "twitter:image",
        content:
          "https://ritajet.com/__l5e/assets-v1/d79e87a3-84a5-47e3-aafe-db3d8230e0b1/rita-ipad-screen.jpg",
      },
    ],
    links: [{ rel: "canonical", href: "https://ritajet.com/" }],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="rita-cream min-h-screen bg-black text-white">
      <ProHome />
      <InstallAppBanner />
    </div>
  );
}
