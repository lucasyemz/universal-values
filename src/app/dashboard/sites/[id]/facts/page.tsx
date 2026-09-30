import { redirectRetiredFacts } from "@/modules/global-facts/retired-route";

// Compatibility for existing bookmarks; Facts is no longer a product screen.
export default async function RetiredFactsPage({ params }: { params: Promise<{ id: string }> }) {
  return redirectRetiredFacts((await params).id);
}
