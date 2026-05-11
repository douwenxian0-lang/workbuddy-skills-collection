---
name: llm-wiki
description: Use this skill when the user wants to build, maintain, or query a personal knowledge base using LLM-assisted wiki management. Triggers include requests to organize information, create wiki structures, manage knowledge bases, or when the user mentions "wiki", "knowledge base", "PKM", "personal knowledge management", "Obsidian", or wants to implement a system for accumulating and connecting knowledge over time.
agent_created: true
---

# LLM Wiki

Guide for building and maintaining a personal knowledge base using LLMs. This skill implements Andrej Karpathy's LLM Wiki pattern - using LLMs to incrementally build and maintain a persistent, structured collection of markdown files that serves as a personal knowledge base.

## Core Idea

Traditional RAG re-discovers knowledge from scratch on every query. LLM Wiki takes a different approach - the LLM incrementally builds and maintains a **persistent wiki** that sits between the user and raw sources.

Key differences:
- Wiki is a **persistent, compounding artifact**
- Cross-references are pre-built
- Contradictions are already flagged
- Synthesis reflects everything read
- Knowledge accumulates rather than being re-derived each time

## Architecture

### Three Layers

1. **Raw Sources** - Immutable collection of source documents (articles, papers, images, data files). LLM reads but never modifies.

2. **The Wiki** - Directory of LLM-generated markdown files (summaries, entity pages, concept pages, comparisons). LLM owns this layer entirely.

3. **The Schema** - Configuration file (CLAUDE.md for Claude Code, AGENTS.md for Codex) that tells the LLM how the wiki is structured, conventions, and workflows.

### Directory Structure

```
project/
├── raw/                    # Raw source documents (immutable)
│   ├── articles/
│   ├── papers/
│   └── images/
├── wiki/                   # LLM-generated wiki pages
│   ├── index.md           # Content-oriented catalog
│   ├── README.md          # Wiki overview
│   ├── entities/          # Person/entity pages
│   ├── concepts/          # Concept/idea pages
│   └── sources/           # Source summaries
├── CLAUDE.md              # Schema/configuration (for Claude)
├── AGENTS.md              # Schema/configuration (for Codex)
└── log.md                 # Chronological operation log
```

## Core Operations

### 1. Ingest

Process new sources and integrate into the wiki.

**Workflow:**
1. User drops new source into `raw/`
2. LLM reads source and discusses key takeaways with user
3. LLM creates/updates wiki pages:
   - Summary page for the source
   - Updates index.md
   - Updates relevant entity/concept pages (may touch 10-15 pages)
   - Appends entry to log.md
4. User reviews updates and provides feedback

**Best Practice:** Ingest sources one at a time with user involvement. User reads summaries, checks updates, and guides LLM on what to emphasize.

### 2. Query

Answer questions against the wiki.

**Workflow:**
1. User asks question
2. LLM searches index.md or uses search tool (qmd) to find relevant pages
3. LLM reads relevant wiki pages
4. LLM synthesizes answer with citations
5. **Key:** Good answers can be filed back into wiki as new pages

**Output Forms:**
- Markdown pages
- Comparison tables
- Slide decks (Marp)
- Charts (matplotlib)
- Canvas visualizations

### 3. Lint

Periodically health-check the wiki.

**Checks:**
- Contradictions between pages
- Stale claims (newer sources have superseded)
- Orphan pages (no inbound links)
- Important concepts mentioned but lacking their own page
- Missing cross-references
- Data gaps (can be filled with web search)

## Indexing and Logging

### index.md (Content-Oriented)

Catalog of everything in the wiki:
- Each page listed with link and one-line summary
- Organized by category (entities, concepts, sources, etc.)
- Updated on every ingest
- LLM reads this first to find relevant pages

Example structure:
```markdown
# Wiki Index

## Entities
- [[john-doe]] - AI researcher at Stanford
- [[jane-smith]] - Author of "Understanding LLMs"

## Concepts
- [[transformers]] - Architecture for sequence modeling
- [[rag]] - Retrieval-augmented generation

## Sources
- [[2026-05-karpathy-llm-wiki]] - Karpathy's LLM Wiki article
```

### log.md (Chronological)

Append-only record of operations:
- Ingests, queries, lint passes
- Parseable format for Unix tools

Example:
```markdown
## [2026-05-10] ingest | Karpathy LLM Wiki Article
- Source: raw/articles/karpathy-llm-wiki.md
- Created: wiki/sources/2026-05-karpathy-llm-wiki.md
- Updated: wiki/concepts/llm-wiki.md, wiki/concepts/rag.md
- Contradiction flagged: wiki/concepts/rag.md (line 45)

## [2026-05-10] query | Compare RAG vs LLM Wiki
- Created: wiki/comparisons/rag-vs-llm-wiki.md
```

**Tip:** Each entry starts with consistent prefix `## [YYYY-MM-DD] action | title` for easy parsing:
```bash
grep "^## \[" log.md | tail -5  # Last 5 entries
```

## Tools

### Obsidian (Recommended)

Obsidian serves as the "IDE" for the wiki:
- View and edit markdown files
- Graph view to see connections
- Dataview for dynamic queries over frontmatter
- Marp for slide decks from wiki content

**Setup:**
1. Open wiki/ directory as Obsidian vault
2. Install plugins: Dataview, Marp, Graph Analysis
3. Configure attachment folder: Settings → Files and links → Attachment folder path

### qmd (Optional, for larger wikis)

Local search engine for markdown files:
- Hybrid BM25/vector search
- LLM re-ranking
- Both CLI and MCP server

Installation:
```bash
pip install qmd
```

Usage:
```bash
qmd index wiki/          # Index the wiki
qmd search "query"      # Search the wiki
```

### Git (Version Control)

The wiki is a git repo:
- Version history
- Branching for experiments
- Collaboration

```bash
git init wiki/
git add .
git commit -m "Initial wiki structure"
```

## Workflow Example

### Scenario: User wants to understand LLM Wiki concept

1. **User:** "I want to understand the LLM Wiki concept from Karpathy's article"

2. **Ingest source:**
   - User saves article to `raw/articles/karpathy-llm-wiki.md`
   - LLM processes: creates `wiki/sources/karpathy-llm-wiki.md`
   - Updates `index.md`
   - Updates related pages: `wiki/concepts/rag.md`, `wiki/concepts/knowledge-base.md`

3. **Query:**
   - User: "How does LLM Wiki differ from RAG?"
   - LLM searches index, reads relevant pages
   - Synthesizes answer with citations
   - **Files answer back to wiki:** `wiki/comparisons/rag-vs-llm-wiki.md`

4. **Lint:**
   - User: "Check wiki health"
   - LLM checks for contradictions, orphans, missing cross-references
   - Reports findings and suggests improvements

## Setting Up a New Wiki

### Step 1: Create Schema File

Create `CLAUDE.md` (or `AGENTS.md`):

```markdown
# Wiki Schema

## Directory Structure
- raw/          # Raw sources (immutable)
- wiki/          # Wiki pages (LLM-generated)
- index.md       # Content catalog
- log.md         # Operation log

## Page Templates

### Source Summary Page
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

## Related Pages
- [[page1]]
- [[page2]]
```

### Entity Page
```markdown
# {entity name}

## Basic Info
{description}

## Mentions
- {source 1}: {how mentioned}
- {source 2}: {how mentioned}

## Related Concepts
- [[concept1]]
```

## Workflows

### Ingest
1. Read source from raw/
2. Discuss key takeaways
3. Create/update wiki pages
4. Update index.md
5. Append to log.md

### Query
1. Search index.md or use qmd
2. Read relevant pages
3. Synthesize answer with citations
4. Offer to file answer back to wiki

### Lint
1. Check for contradictions
2. Find orphan pages
3. Identify missing pages for mentioned concepts
4. Check cross-references
```

### Step 2: Initialize Directory Structure

```bash
mkdir -p wiki/{entities,concepts,sources,comparisons}
touch wiki/index.md
touch log.md
```

### Step 3: First Ingest

1. Place source in `raw/`
2. Tell LLM: "Please process this source and update the wiki"
3. Review generated pages
4. Iterate and improve schema

## Best Practices

1. **Human curates, LLM maintains:** User decides what to read and what questions to ask. LLM does the grunt work.

2. **One source at a time:** Better to ingest slowly with involvement than batch ingest without review.

3. **File good answers back:** Don't let good answers disappear into chat history. Save them as wiki pages.

4. **Use Obsidian alongside:** Open Obsidian on one side, LLM on the other. Browse results in real-time.

5. **Evolve the schema:** As you use the wiki, improve CLAUDE.md to better fit your domain.

6. **Periodic lint passes:** Keep the wiki healthy as it grows.

## Resources

### scripts/
(To be populated with automation scripts as needed)

### references/
(To be populated with detailed reference material)

### assets/
(To be populated with templates as needed)

---

**Key Insight:** The LLM handles the maintenance that humans don't want to do. The human focuses on curation, exploration, and sense-making. The LLM handles summarization, cross-referencing, filing, and bookkeeping.

## References

- Original article: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Obsidian: https://obsidian.md
- qmd: https://github.com/tobi/qmd
- Marp: https://marp.app
