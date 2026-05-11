# Obsidian Setup Guide for LLM Wiki

Obsidian is the recommended "IDE" for your LLM Wiki. This guide explains how to set it up for optimal wiki management.

## Why Obsidian?

- **Graph View**: Visualize connections between wiki pages
- **Dataview**: Run queries over page metadata
- **Marp**: Create slide decks from wiki content
- **Local**: All files stored locally in markdown
- **Flexible**: Highly customizable with community plugins

## Initial Setup

### 1. Download and Install

1. Go to https://obsidian.md
2. Download for your platform (Windows/macOS/Linux)
3. Install and launch

### 2. Create New Vault

**Option A: Open existing wiki/ directory**
1. Click "Open folder as vault"
2. Select your `wiki/` directory
3. Obsidian will index all markdown files

**Option B: Create new vault**
1. Click "Create new vault"
2. Name it (e.g., "My Wiki")
3. Choose location (e.g., `~/wiki/`)

### 3. Configure Attachments

Configure where images and attachments are saved:

1. Settings → Files and links
2. Set "Attachment folder path" to: `raw/assets/`
3. Set "New link format" to: "Shortest path possible"
4. Enable "Use [[Wikilinks]]"

### 4. Download Images Locally

When clipping web articles, download images locally:

1. Settings → Hotkeys
2. Search for "Download attachments"
3. Bind to a hotkey (e.g., `Ctrl+Shift+D`)
4. When viewing a clipped article, hit the hotkey to download all images

**Note**: LLMs can't natively read markdown with inline images in one pass. Workaround: Read text first, then view referenced images separately.

## Recommended Plugins

### 1. Dataview

**Purpose**: Query and display data from your wiki pages.

**Installation:**
1. Settings → Community plugins → Turn off Restricted mode
2. Browse → Search "Dataview" → Install → Enable

**Usage Example:**
```markdown
```dataview
TABLE summary, date
FROM "wiki/sources"
SORT date DESC
LIMIT 10
```
```

This creates a dynamic table of your 10 most recent sources.

### 2. Marp

**Purpose**: Create slide decks from markdown.

**Installation:**
1. Settings → Community plugins → Browse
2. Search "Marp for Obsidian" → Install → Enable

**Usage:**
```markdown
---
marp: true
theme: default
---
# Slide 1
Content for slide 1

---
# Slide 2
Content for slide 2
```

Export: Command palette → "Marp: Export slide deck"

### 3. Graph Analysis (Optional)

**Purpose**: Advanced graph analysis and metrics.

**Installation:**
Browse community plugins → "Graph Analysis"

**Usage:**
- Right-click graph view → "Graph Analysis"
- See metrics: degree centrality, betweenness, etc.
- Identify hub pages and orphans

### 4. Obsidian Web Clipper (Browser Extension)

**Purpose**: Clip web pages as markdown.

**Installation:**
1. Install browser extension: https://obsidian.md/clipper
2. Configure format and target folder

**Workflow:**
1. Browse to article you want to save
2. Click Obsidian icon in browser toolbar
3. Adjust title, tags, target folder
4. Click "Clip" → saves to `raw/articles/`

## Workflow: Obsidian + LLM

### Side-by-Side Setup

```
┌────────────────────┬────────────────────┐
│                    │                    │
│   Obsidian         │   WorkBuddy        │
│   (Wiki IDE)      │   (LLM Agent)      │
│                    │                    │
│  - View pages      │  - Ingest sources  │
│  - Follow links    │  - Update pages    │
│  - Graph view      │  - Cross-reference │
│  - Edit manually   │  - Query wiki      │
│                    │                    │
└────────────────────┴────────────────────┘
```

### Typical Session

1. **User**: "I want to ingest this article about LLMs"
2. **User saves article** to `raw/articles/llm-overview.md`
3. **LLM** (WorkBuddy):
   - Reads article
   - Creates `wiki/sources/llm-overview.md`
   - Updates `wiki/index.md`
   - Updates related pages
   - Appends to `log.md`
4. **User** (Obsidian):
   - Opens `wiki/sources/llm-overview.md`
   - Follows links to related pages
   - Views graph to see new connections
   - May manually edit or add notes

## Tips and Tricks

### 1. Use Graph View Regularly

- Open graph view (icon in left sidebar)
- See how pages are connected
- Identify:
  - **Hub pages**: Highly connected, central concepts
  - **Orphans**: No inbound links, may need cross-references
  - **Clusters**: Related topics that form groups

### 2. Leverage Wikilinks

When writing in Obsidian, use `[[page-name]]` to create links.

The LLM should:
- Create links when mentioning related concepts
- Check for existing pages before creating new ones
- Use consistent naming conventions

### 3. Use Tags Strategically

Add tags to pages for easy filtering:

```markdown
---
tags: [concept, important, to-expand]
---

# Page Title
```

Query with Dataview:
```dataview
LIST
FROM #important
```

### 4. Organize with Folders

Suggested structure:
```
wiki/
├── sources/        # Source summaries
├── entities/       # People, organizations
├── concepts/       # Ideas, theories
├── comparisons/     # Comparative analyses
└── projects/        # Project-specific notes
```

### 5. Review Log Regularly

Open `log.md` to see:
- What was ingested recently
- What queries were run
- What contradictions were found

Use Obsidian's "Quick Switcher" (`Ctrl+O`) to jump to pages mentioned in log.

## Advanced: Custom CSS (Optional)

Add custom styles to make your wiki more readable:

1. Settings → Appearance → CSS snippets
2. Create `snippets/wiki-enhancements.css`
3. Add custom styles:

```css
/* Make wikilinks more visible */
.internal-link {
  color: #7C3AED;
  font-weight: 500;
}

/* Style for entity pages */
.page-entity {
  border-left: 3px solid #10B981;
  padding-left: 1em;
}
```

## Troubleshooting

### Images Not Displaying

**Cause**: Images linked with URLs that may break.

**Fix**: Use Obsidian Web Clipper's "Download images" feature to save locally.

### Graph View Too Crowded

**Cause**: Too many pages, hard to see connections.

**Fix**:
- Use Graph View filters
- Filter by tags or folders
- Create separate graphs for different topics

### Dataview Queries Not Working

**Cause**: Missing or malformed YAML frontmatter.

**Fix**:
- Ensure pages have proper frontmatter
- Check field names match query
- Use Dataview's query validator

## Next Steps

1. Set up Obsidian with your wiki/ directory
2. Install Dataview and Marp plugins
3. Configure attachment folder
4. Start ingesting sources with LLM
5. View results in Obsidian side-by-side

**Remember**: Obsidian is the IDE, LLM is the programmer, Wiki is the codebase.
