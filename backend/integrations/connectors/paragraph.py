import os
import re
from typing import Any, Optional

import httpx


class ParagraphAPIError(Exception):
    pass


class ParagraphConnector:
    """
    Minimal Paragraph API connector for draft publishing.

    Defaults align with public docs:
    - Base URL: https://api.paragraph.com/v1
    - Create post: POST /posts
    """

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = (api_key or "").strip()
        self.base_url = os.getenv("PARAGRAPH_API_BASE", "https://api.paragraph.com/v1").rstrip("/")
        self.publication_slug = os.getenv("PARAGRAPH_PUBLICATION_SLUG", "").strip()
        self.timeout_secs = float(os.getenv("PARAGRAPH_TIMEOUT_SECS", "20"))

    async def create_post(
        self,
        title: str,
        content: str,
        publication_id: Optional[str] = None,
        send_newsletter: bool = False,
    ) -> dict[str, Any]:
        if not self.api_key:
            raise ValueError("Paragraph API key is required.")

        payload: dict[str, Any] = {
            "title": title.strip()[:180] or "Trend Analysis",
            "content": content,
            "send": bool(send_newsletter),
            "isDraft": True,
        }
        if publication_id:
            payload["publicationId"] = publication_id

        body = await self._request("POST", "/posts", data=payload)
        post_id = body.get("id")
        slug = body.get("slug")
        url = body.get("url") or body.get("preview_url")

        # Best-effort fallback when API returns only an ID.
        if not url and self.publication_slug and slug:
            url = f"https://paragraph.com/@{self.publication_slug}/{slug}"
        elif not url and self.publication_slug and post_id:
            url = f"https://paragraph.com/@{self.publication_slug}/{post_id}"

        return {
            "id": post_id,
            "slug": slug,
            "url": url,
            "raw": body,
        }

    async def _request(self, method: str, endpoint: str, data: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self.base_url}{endpoint}"
        async with httpx.AsyncClient(timeout=self.timeout_secs) as client:
            response = await client.request(method, url, headers=headers, json=data)

        if response.status_code >= 400:
            # Avoid leaking sensitive headers/key while keeping enough context.
            text = response.text[:500]
            raise ParagraphAPIError(f"Paragraph API error ({response.status_code}): {text}")

        try:
            data = response.json()
        except Exception as exc:
            raise ParagraphAPIError(f"Invalid Paragraph API JSON response: {exc}") from exc

        if not isinstance(data, dict):
            raise ParagraphAPIError("Unexpected Paragraph API response shape.")
        return data


def parse_markdown_title(markdown: str) -> tuple[str, str]:
    """
    Returns (title, content_without_h1).
    Falls back to generic title when no H1 exists.
    """
    text = (markdown or "").strip()
    if not text:
        return ("Trend Analysis", "")

    lines = text.splitlines()
    if lines and lines[0].startswith("# "):
        title = re.sub(r"\s+", " ", lines[0][2:]).strip()[:180] or "Trend Analysis"
        body = "\n".join(lines[1:]).strip()
        return (title, body)
    return ("Trend Analysis", text)
