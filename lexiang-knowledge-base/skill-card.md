## Description: <br>
Provides AI agents with Lexiang knowledge-base search, reading, writing, block editing, file upload, connector import, and configuration workflows. <br>

This skill is ready for commercial/non-commercial use. <br>

## Publisher: <br>
[lexiang](https://clawhub.ai/user/lexiang) <br>

### License/Terms of Use: <br>
MIT-0 <br>


## Use Case: <br>
Employees and developers who use Lexiang can connect an agent to a Lexiang knowledge base to search and summarize content, create or edit pages, upload files, import meeting recordings, and sync local documentation when authorized. <br>

### Deployment Geography for Use: <br>
Global <br>

## Known Risks and Mitigations: <br>
Risk: The skill requires a Lexiang token and tenant configuration to access private knowledge-base content. <br>
Mitigation: Keep LEXIANG_TOKEN private, avoid committing mcp.json with real credentials, and use the documented OAuth or renewal flow when authentication fails. <br>
Risk: Upload and folder-sync workflows can transfer local files, including secrets or personal files, into Lexiang. <br>
Mitigation: Review upload and sync paths before running them, use dry-run plans where available, and avoid syncing folders that may contain sensitive files. <br>
Risk: Write, edit, move, delete, and upload operations can change knowledge-base content. <br>
Mitigation: Execute write operations only for user-specified URLs, IDs, or confirmed targets, and batch large operations as documented. <br>


## Reference(s): <br>
- [ClawHub release page](https://clawhub.ai/lexiang/lexiang-mcp-skill) <br>
- [README](README.md) <br>
- [Lexiang platform](https://lexiangla.com) <br>
- [Lexiang MCP configuration](https://lexiangla.com/mcp) <br>
- [Model Context Protocol](https://modelcontextprotocol.io) <br>
- [Lexiang MCP base reference](references/base.md) <br>
- [Lexiang MCP setup guide](references/setup.md) <br>
- [Lexiang search reference](references/search.md) <br>
- [Lexiang writer reference](references/writer.md) <br>
- [Lexiang file upload reference](references/files.md) <br>
- [Lexiang block operation reference](references/blocks.md) <br>


## Skill Output: <br>
**Output Type(s):** [text, markdown, code, shell commands, configuration, guidance] <br>
**Output Format:** [Markdown responses with MCP tool-call guidance, JSON configuration snippets, and shell command examples.] <br>
**Output Parameters:** [1D] <br>
**Other Properties Related to Output:** [May generate upload or sync plans for user-approved Lexiang targets.] <br>

## Skill Version(s): <br>
2.0.2 (source: server release metadata; artifact frontmatter reports 2.1.0) <br>

## Ethical Considerations: <br>
Users should evaluate whether this skill is appropriate for their environment, review any generated or modified files before relying on them, and apply their organization's safety, security, and compliance requirements before deployment. <br>
