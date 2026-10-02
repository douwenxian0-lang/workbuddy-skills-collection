---
name: motionsites-prompt
description: >
  Generate structured prompts for AI web design tools (Bolt, Lovable, Claude Code, Cursor) 
  following the MotionSites format. Use when user wants to create Hero sections, landing pages, 
  or web designs with React, Tailwind CSS, and Framer Motion. Trigger keywords: 
  "create hero section", "generate landing page", "motionsites prompt", "web design prompt"
agent_created: true
---

# MotionSites Prompt Generator

This skill generates structured prompts for AI web design tools following the MotionSites format. The format is optimized for creating high-quality Hero sections and landing pages using React, Tailwind CSS, and Framer Motion.

## When to Use This Skill

Use this skill when the user wants to:
- Create a Hero section for a website
- Generate a landing page with animations
- Build a SaaS/Agency/Portfolio website
- Create prompts for AI web design tools (Bolt, Lovable, Claude Code, Cursor)

## MotionSites Prompt Format

Every prompt follows this structured format:

### 1. Metadata Header
```markdown
# [Project Name]

> **Category:** [Landing Page/SaaS/Portfolio/Agency]
> **Type:** [landing-page/saas/portfolio/agency]
> **License:** [free/pro]
```

### 2. Video Preview Section
Embed video previews of the intended design output:
```markdown
## 🎬 Video Preview

![Video Preview 0](../assets/videos/[filename]_0.mp4)
![Video Preview 1](../assets/videos/[filename]_1.mp4)
```

### 3. Prompt Section (📋)
The core implementation prompt with all technical specifications:

```markdown
## 📋 Prompt

\```text
Prompt to recreate this [page type]:

[Project description with theme, branding, and style guidelines]

DESIGN SYSTEM (index.css)
[Color tokens in HSL format]
[Liquid glass / glassmorphism CSS classes if applicable]
[Tailwind config specifications]

SECTION 1: [SECTION NAME] (layout specifications)
[Detailed implementation guidelines]

SECTION 2: [SECTION NAME] (layout specifications)
[Detailed implementation guidelines]

[... repeat for each section]

KEY DEPENDENCIES
- framer-motion (animations)
- hls.js (HLS video streaming if applicable)
- Google Fonts: [font names and weights]
\```
```

## Tech Stack Requirements

All prompts must specify:
- **Framework**: React
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Video (if applicable)**: HLS.js

## Design Categories

Prompts are organized into these categories:
1. **Landing Pages & Websites** - Full landing pages for agencies, SaaS products
2. **SaaS & AI Applications** - Dashboard previews, app showcases
3. **Hero Sections & Components** - Individual Hero blocks with animations
4. **Portfolio & Personal** - Designer/developer portfolios
5. **Video & Agency** - Video-forward agency landing pages

## Usage Workflow

1. Ask the user for:
   - Category (Landing/SaaS/Portfolio/Agency)
   - Project name/branding
   - Style preferences (dark/light, colors, fonts)
   - Sections needed (Hero, About, Features, CTA, etc.)

2. Generate the prompt following the MotionSites format above

3. Output the complete prompt in a code block with the 📋 emoji header

4. Instruct the user to copy the prompt and paste into their AI tool (Lovable, Bolt, Claude Code, etc.)

## Example Usage

**User**: "Create a hero section for my AI automation agency"

**Response**: Generate a complete MotionSites-format prompt with:
- Metadata header
- Video preview section (if reference exists)
- Complete implementation prompt with design system, section guidelines, and dependencies

## References

- MotionSites repository: https://github.com/aayushsoam/motionsites.ai
- MotionSites website: https://motionsites.ai
- Prompt gallery: https://motionsites.ai/templates

## Notes

- Always include the 📋 emoji before the prompt code block
- Specify exact color tokens in HSL format
- Include all dependencies (framer-motion, hls.js, Google Fonts)
- Reference the MotionSites Export Tool in the footer
