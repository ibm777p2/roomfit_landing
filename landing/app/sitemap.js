import { SITE_URL } from "@/lib/content";

export default function sitemap() {
  return [{ url: SITE_URL, changeFrequency: "weekly", priority: 1 }];
}
