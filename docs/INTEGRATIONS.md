# Integrations

This document covers third-party platform integrations that extend Trende's agentic capabilities.

---

## Paragraph.xyz (Editorial Engine) ✅ LIVE

Transform trend analysis reports into published articles on [Paragraph.xyz](https://paragraph.xyz).

### Overview

The Editorial Engine converts passive intelligence consumption into active thought leadership by:
1. Rewriting analytical reports into engaging article formats
2. Formatting citations as footnotes/inline links
3. Publishing directly to Paragraph as drafts

### Authentication Flow

Since Paragraph does not support OAuth, we use **Personal Access Token** (Bearer Token) authentication:

1. User clicks "Publish Findings" on a Trend Report
2. System checks for stored `PARAGRAPH_API_KEY`
3. If missing, modal prompts user to:
   - Go to [Paragraph Dashboard Settings](https://paragraph.xyz/dashboard/settings)
   - Copy API Key from Settings tab
   - Paste into secure input field
4. System verifies key with lightweight API call
5. Key stored client-side, flow proceeds

### Drafting Workflow

**Input**: `Trend Report (Markdown)`, `Citations`, `Trend Name`

**Process**:
1. `PublisherAgent` rewrites report into engaging format (e.g., "The Rise of [Trend]: What You Need to Know")
2. Adds "Key Takeaways" box
3. Formats citations as footnotes

**API Call**:
```
POST https://api.paragraph.ph/v1/posts
{
  "title": "Generated Title",
  "content": "Enhanced Markdown",
  "publishedAt": null  // Draft mode
}
```

**Output**: `preview_url` (e.g., `paragraph.xyz/@user/draft/123`)

### Technical Architecture

**Backend**:
- `backend/integrations/connectors/paragraph.py`
  - `create_post(title, content, api_key)`
  - `verify_credentials(api_key)`
- `backend/agents/nodes/editorial.py`
  - Specialized prompt for analytical → editorial conversion

**Frontend**:
- `components/integrations/ParagraphConnectModal.tsx`
- API key stored in local storage

### User Journey

```
Trend Report → "Publish" → Connect Modal → API Key → Draft Created → Review on Paragraph
```

**Reference**: [Paragraph API Docs](https://paragraph.com/docs/api-reference)

---

## Future Integrations

### Token Launchers (nad.fun, Pump.fun)

Enable one-click token creation from meme pages:
- Extract ticker, name, supply from meme payload
- Deploy verified ERC-20 contract
- Auto-setup liquidity pairs

### Substack/Mirror

Alternative publishing platforms for editorial content:
- Similar flow to Paragraph integration
- Platform-specific formatting

### Social Auto-Posting

Automated distribution to:
- Twitter/X via API
- Farcaster via Warpcast bots
- LinkedIn for professional audiences

### Monitoring Services

Ongoing trend tracking:
- Cron-based re-analysis every 24h
- Delta detection for sentiment/volume shifts
- Alerts via Email/Telegram/Discord

---

## Adding New Integrations

1. Create connector in `backend/integrations/connectors/`
2. Add agent node if AI transformation needed
3. Build frontend UI components
4. Document in this file
