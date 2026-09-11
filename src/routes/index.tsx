import { createFileRoute } from "@tanstack/react-router";
import { ProHome } from "@/components/home/procreate/ProHome";
import { InstallAppBanner } from "@/components/InstallAppButton";
import screenAsset from "@/assets/home-ipad-restored.webp.asset.json";

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
          "https://ritajet.com/__l5e/assets-v1/e715e252-b093-484d-98d9-8e3144845769/home-ipad-restored.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://ritajet.com/__l5e/assets-v1/e715e252-b093-484d-98d9-8e3144845769/home-ipad-restored.webp",
      },
    ],
    links: [
      { rel: "canonical", href: "https://ritajet.com/" },
      { rel: "preload", as: "image", href: screenAsset.url, fetchPriority: "high" },
    ],
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
