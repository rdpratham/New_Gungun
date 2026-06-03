# ZoomInfo MCP Connector

Real-time ZoomInfo data search and enrichment via the Model Context Protocol (MCP).

## Tools Available

| Tool | Description |
|---|---|
| `search_companies` | Search companies by name, industry, revenue, size, location, tech stack |
| `search_contacts` | Search contacts by name, title, department, seniority, company |
| `enrich_company` | Full company profile from name, domain, or ZoomInfo ID |
| `enrich_contact` | Full contact profile from name+company, email, or ZoomInfo ID |
| `enrich_intent` | Buyer-intent signals (topics a company is researching) |
| `enrich_news` | Recent news and press mentions for a company |
| `enrich_scoops` | Internal intelligence: new initiatives, tech changes, hiring signals |
| `find_similar_companies` | Companies similar to a given company |
| `find_similar_contacts` | Contacts matching a given persona |
| `search_intent` | Find companies showing intent on specific topics |
| `get_recommended_contacts` | Recommended buyers at a target company |
| `account_research` | Full account research report (firmographics + intent + contacts) |
| `contact_research` | Full contact research report |
| `get_gtm_context` | Go-to-market context with talking points for outreach |
| `lookup` | Free-form lookup by domain, name, or natural language query |

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure credentials

Copy `.env.example` to `.env` and fill in your ZoomInfo credentials:

```bash
cp .env.example .env
```

**Option A — Client ID + RSA Private Key (recommended)**
```
ZOOMINFO_CLIENT_ID=your_client_id
ZOOMINFO_PRIVATE_KEY=your_rsa_private_key
```

**Option B — Username + Password**
```
ZOOMINFO_USERNAME=you@example.com
ZOOMINFO_PASSWORD=yourpassword
```

### 3. Run the server

```bash
python server.py
```

### 4. Connect to Claude Code

Add to your `~/.claude/mcp_config.json`:

```json
{
  "mcpServers": {
    "zoominfo": {
      "command": "python",
      "args": ["/absolute/path/to/zoominfo-mcp/server.py"],
      "env": {
        "ZOOMINFO_CLIENT_ID": "your_client_id",
        "ZOOMINFO_PRIVATE_KEY": "your_private_key"
      }
    }
  }
}
```

Then restart Claude Code and the ZoomInfo tools will be available.

## Example Queries

**Search for SaaS companies in California with 100-500 employees:**
```
search_companies(industry="Software", state="California", employee_count_min=100, employee_count_max=500)
```

**Find VP-level contacts in Engineering at a company:**
```
search_contacts(company_name="Acme Corp", management_level="VP", department="Engineering")
```

**Get buyer intent for a target account:**
```
enrich_intent(domain="acme.com", topics=["cloud migration", "data security"])
```

**Full account research before a sales call:**
```
account_research(domain="acme.com")
```
