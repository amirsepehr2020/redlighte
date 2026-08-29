# Redlighte Articles SEO Engine

## Publishing checklist

- One stable canonical URL per published article.
- One descriptive H1.
- A useful, unique title and meta description.
- Article JSON-LD with headline, description, dates, author, publisher, image, and mainEntityOfPage.
- Add meaningful internal links to relevant articles and Redlighte pages.
- Add related articles when they genuinely help the reader.
- Keep drafts out of the sitemap.
- Update `dateModified` after substantial edits.
- Avoid keyword stuffing, doorway pages, and thin content.

## Topic-cluster strategy

Build clusters around a clear search intent. Each cluster should have a useful pillar article plus supporting articles that answer narrower questions. Supporting articles should link to the pillar and to closely related pages; the pillar should link back to the strongest supporting pages.

## Content quality

Articles should be written for people first: answer the query directly, explain concepts clearly, use descriptive headings, and add original value. SEO metadata should describe the page accurately rather than manipulate rankings.

## Future automation

The registry in `articles/data/articles.json` is the source of truth for discovery metadata. A future build/deploy step can validate published entries, generate sitemap entries, check canonical URLs, detect duplicate slugs, and calculate a basic SEO completeness score without changing the runtime article layout.
