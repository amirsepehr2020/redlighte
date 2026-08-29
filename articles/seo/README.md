# Redlighte Articles — SEO Engine

## Quality gates

Every published article should have a unique title, useful description, clean slug, canonical URL, author, publish/update dates, reading time, category, tags, and Article JSON-LD.

## Topic authority

Articles belong to a category and, when appropriate, a topic cluster. Pillar topics should link to supporting articles and supporting articles should link back to the pillar when the relationship is genuinely useful.

## Internal linking

Prefer contextual links inside the article. Use the related-article area for additional discovery. Never add links only to manipulate rankings.

## Indexing rules

- Published, useful articles: index.
- Draft or archived content: noindex and exclude from sitemap.
- Empty or near-empty category pages: do not index until they provide standalone value.

## SEO validator

Run the validator from the repository root:

```bash
node articles/seo/validate.mjs
```

The validator checks the published registry metadata and fails when an article falls below the publishing quality threshold.

## Publishing checklist

1. Pick a search-intent-driven topic.
2. Assign the correct category and cluster.
3. Write a descriptive title and meta description.
4. Use one H1 and a logical H2/H3 hierarchy.
5. Add useful internal links where relevant.
6. Add or update Article JSON-LD.
7. Verify canonical URL and dates.
8. Run the SEO validator.
9. Add the published URL to the sitemap.
10. Review the rendered page on mobile before publishing.
