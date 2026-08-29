# Redlighte Articles

SEO-first editorial section for Redlighte.

## Publish a new article

1. Add the article metadata to `data/articles.json`.
2. Create `articles/<slug>/index.html` from the article template.
3. Keep one canonical URL per article.
4. Add Article JSON-LD with `headline`, `description`, `datePublished`, `dateModified`, `author`, `publisher`, `image`, and `mainEntityOfPage`.
5. Add the final URL to the root `sitemap.xml`.
6. Use internal links to relevant Redlighte pages and related articles.
7. Never add drafts to the sitemap.

## Content rules

- One clear search intent per article.
- One H1 per page.
- Use descriptive H2/H3 headings.
- Write for people first; do not keyword-stuff.
- Keep titles useful and specific.
- Update `dateModified` when substantial content changes.
- Prefer original, useful explanations over thin SEO pages.

## URL convention

`https://redlighte.ir/articles/<slug>/`

Slugs should be lowercase, short, stable, and hyphen-separated.