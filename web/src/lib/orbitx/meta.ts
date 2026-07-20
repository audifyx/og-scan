/**
 * Update document meta tags for social sharing and SEO
 */
export function updateMeta({
  title,
  description,
  image,
  url,
}: {
  title: string;
  description: string;
  image?: string;
  url?: string;
}) {
  // Update title
  document.title = title;

  // Update or create meta tags
  updateOrCreateMetaTag("name", "description", description);
  updateOrCreateMetaTag("property", "og:title", title);
  updateOrCreateMetaTag("property", "og:description", description);
  updateOrCreateMetaTag("property", "og:type", "website");
  updateOrCreateMetaTag("name", "twitter:title", title);
  updateOrCreateMetaTag("name", "twitter:description", description);

  if (image) {
    updateOrCreateMetaTag("property", "og:image", image);
    updateOrCreateMetaTag("property", "og:image:type", "image/jpeg");
    updateOrCreateMetaTag("name", "twitter:image", image);
    updateOrCreateMetaTag("name", "twitter:card", "summary_large_image");
  }

  if (url) {
    updateOrCreateMetaTag("property", "og:url", url);
    updateCanonical(url);
  }
}

function updateOrCreateMetaTag(
  attrName: string,
  attrValue: string,
  content: string
) {
  let tag = document.querySelector(`meta[${attrName}="${attrValue}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attrName, attrValue);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function updateCanonical(url: string) {
  let link = document.querySelector("link[rel='canonical']");
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}
