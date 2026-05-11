# Schema Template for LLM Wiki

This file provides templates for the schema configuration file (CLAUDE.md or AGENTS.md) that tells the LLM how to structure and maintain the wiki.

## Basic Schema Structure

```markdown
# Wiki Schema

## Directory Structure
- raw/          # Raw sources (immutable)
- wiki/          # Wiki pages (LLM-generated)
- index.md       # Content catalog
- log.md         # Operation log

## Page Templates

### Source Summary Page
File: wiki/sources/{slug}.md
```markdown
# {title}

**Source:** {url or file path}  
**Date:** {YYYY-MM-DD}  
**Tags:** {tags}

## Summary
{2-3 paragraph summary}

## Key Points
- Point 1
- Point 2

## Quotes
> {important quote} (p. X)

## Related Pages
- [[page1]]
- [[page2]]
```

### Entity Page
File: wiki/entities/{slug}.md
```markdown
# {entity name}

## Basic Info
{description}

## Mentions
- {source 1}: {how mentioned}
- {source 2}: {how mentioned}

## Related Concepts
- [[concept1]]
- [[concept2]]
```

### Concept Page
File: wiki/concepts/{slug}.md
```markdown
# {concept name}

## Definition
{clear definition}

## Details
{expanded explanation}

## Examples
- {example 1}
- {example 2}

## Related Concepts
- [[concept1]]
- [[concept2]]
```

## Workflows

### Ingest Workflow
1. Read source from raw/
2. Discuss key takeaways with user
3. Create/update wiki pages:
   - Create source summary in wiki/sources/
   - Update or create entity pages in wiki/entities/
   - Update or create concept pages in wiki/concepts/
   - Update index.md
4. Append entry to log.md
5. Present updates to user for review

### Query Workflow
1. Search index.md or use search tool (qmd) to find relevant pages
2. Read relevant wiki pages
3. Synthesize answer with citations
4. Ask user if they want to save the answer as a new wiki page

### Lint Workflow
Periodically check wiki health:
1. Check for contradictions between pages
2. Find orphan pages (no inbound links)
3. Identify important concepts mentioned but lacking their own page
4. Check for missing cross-references
5. Identify data gaps that could be filled with web search
6. Report findings and suggest improvements

## Conventions

### File Naming
- Use lowercase with hyphens: `entity-name.md`
- For dates: `YYYY-MM-DD-title.md`

### Linking
- Use Wikilinks format: `[[page-name]]`
- Create links when mentioning related concepts/entities

### Frontmatter (Optional)
```yaml
---
title: Page Title
date: 2026-05-10
sources: [source1, source2]
tags: [concept, important]
---
```

## Logging Format

All operations should be logged to log.md with this format:

```markdown
## [{YYYY-MM-DD}] {action} | {title}

### Sources
- {source 1}
- {source 2}

### Pages Created
- wiki/sources/...
- wiki/entities/...

### Pages Updated
- wiki/concepts/...

### Notes
{any important notes, contradictions found, etc.}
```

## Example Commands for the LLM

When the user says:
- "Process this article" → Run Ingest Workflow
- "What does X mean?" → Run Query Workflow
- "Check wiki health" → Run Lint Workflow
- "Summarize what we know about X" → Query + create summary page
- "Compare X and Y" → Query + create comparison page

## Tips for the LLM

1. **Always update index.md** after creating/updating pages
2. **Always log operations** to log.md
3. **Ask before creating pages** - don't assume
4. **Use the user's language** - if they write in Chinese, create pages in Chinese
5. **Cross-reference aggressively** - links are the power of a wiki
6. **Flag contradictions** - note when new sources contradict old claims
7. **File good answers** - save query answers as new wiki pages
