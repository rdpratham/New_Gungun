"""Claude API scoring and notes generation for LinkedIn profiles."""

import json
import os
from typing import Optional

import anthropic


SCORING_SYSTEM_PROMPT = """You are an expert B2B sales analyst helping a sales team identify
high-value prospects on LinkedIn. Your job is to evaluate LinkedIn profiles against a set of
search criteria and assess each person's value as a sales prospect.

Focus especially on:
1. Decision-making power and seniority (VP, Director, C-suite score higher)
2. Budget authority (roles with P&L ownership, procurement, or vendor selection)
3. Relevance to the stated business process (e.g., digital transformation, procurement)
4. Keyword alignment with the seller's target domain
5. Company fit (size, industry, geographic match)

Be concise and commercially sharp. Think like a seasoned SDR/AE."""


def build_scoring_prompt(
    profile: dict,
    keywords: Optional[str],
    designation: Optional[str],
    process: Optional[str],
    location: Optional[str],
    company: Optional[str],
) -> str:
    criteria_lines = []
    if keywords:
        criteria_lines.append(f"- Target keywords: {keywords}")
    if designation:
        criteria_lines.append(f"- Target designation: {designation}")
    if process:
        criteria_lines.append(f"- Target business process: {process}")
    if location:
        criteria_lines.append(f"- Target location: {location}")
    if company:
        criteria_lines.append(f"- Target company: {company}")

    criteria_block = "\n".join(criteria_lines) if criteria_lines else "No specific criteria provided."

    return f"""Evaluate the following LinkedIn profile for sales outreach potential.

## Search Criteria
{criteria_block}

## Profile
- Name: {profile.get('name', 'Unknown')}
- Job Title: {profile.get('title', 'N/A')}
- Company: {profile.get('company', 'N/A')}
- Location: {profile.get('location', 'N/A')}
- Profile URL: {profile.get('profile_url', 'N/A')}

## Instructions
Return a JSON object with exactly these fields:
{{
  "score": <integer 0-10>,
  "notes": "<2-3 sentence explanation of why this person is or isn't a good prospect, focusing on decision-making authority, relevance to the stated process/keywords, and likelihood of engagement>"
}}

Scoring guide:
- 9-10: Perfect fit, senior decision-maker, direct keyword/process match
- 7-8: Strong fit, relevant role, good company match
- 5-6: Moderate fit, some alignment but gaps exist
- 3-4: Weak fit, tangential relevance
- 0-2: Poor fit, no meaningful alignment

Return ONLY valid JSON, no markdown fences."""


def score_profiles(
    profiles: list[dict],
    keywords: Optional[str] = None,
    designation: Optional[str] = None,
    process: Optional[str] = None,
    location: Optional[str] = None,
    company: Optional[str] = None,
    api_key: Optional[str] = None,
) -> list[dict]:
    """
    Score each profile using Claude and return enriched profile dicts.
    Uses prompt caching via cache_control for the system prompt.
    """
    client = anthropic.Anthropic(api_key=api_key or os.environ.get("ANTHROPIC_API_KEY"))

    scored = []
    total = len(profiles)

    for i, profile in enumerate(profiles, 1):
        print(f"  Scoring profile {i}/{total}: {profile.get('name', '?')}")

        prompt = build_scoring_prompt(
            profile=profile,
            keywords=keywords,
            designation=designation,
            process=process,
            location=location,
            company=company,
        )

        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=256,
                system=[
                    {
                        "type": "text",
                        "text": SCORING_SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},
                    }
                ],
                messages=[{"role": "user", "content": prompt}],
            )

            raw = response.content[0].text.strip()
            # Strip markdown fences if model wrapped anyway
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            result = json.loads(raw)
            score = max(0, min(10, int(result.get("score", 5))))
            notes = result.get("notes", "")
        except json.JSONDecodeError:
            score = 5
            notes = "Could not parse Claude response."
        except Exception as e:
            print(f"    [warning] Scoring error for {profile.get('name')}: {e}")
            score = 0
            notes = f"Scoring failed: {e}"

        enriched = dict(profile)
        enriched["score"] = score
        enriched["notes"] = notes
        scored.append(enriched)

    return scored
