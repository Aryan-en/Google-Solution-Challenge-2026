"""Gemini API integration for AI-powered bias explanations."""

import os
import json
import httpx
from typing import Any

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


async def get_bias_explanation(bias_results: dict[str, Any]) -> dict[str, str]:
    """
    Send bias analysis results to Gemini and get a natural language explanation.

    Returns dict with 'explanation', 'reasoning', and 'suggestions' keys.
    """
    if not GEMINI_API_KEY:
        return {
            "explanation": "Gemini API key not configured. Please set GEMINI_API_KEY environment variable.",
            "reasoning": "N/A",
            "suggestions": "N/A",
        }

    prompt = f"""You are an AI fairness expert. Analyze the following hiring bias detection results and provide:

1. **Explanation**: A clear, non-technical explanation of what the data shows about hiring fairness.
2. **Reasoning**: Why this bias might exist and what factors could be contributing.
3. **Suggestions**: Specific, actionable recommendations to mitigate the detected bias.

Bias Analysis Results:
{json.dumps(bias_results, indent=2)}

Key metrics:
- Selection rates by group: {json.dumps(bias_results.get('selection_rates', {}))}
- Disparate Impact ratio: {bias_results.get('disparate_impact', 'N/A')}
- Bias detected: {bias_results.get('bias_detected', 'N/A')}

Note: A Disparate Impact ratio below 0.8 indicates potential adverse impact under the 4/5ths rule used by the EEOC.

Respond in this exact JSON format:
{{
  "explanation": "...",
  "reasoning": "...",
  "suggestions": "..."
}}"""

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{GEMINI_URL}?key={GEMINI_API_KEY}",
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "temperature": 0.7,
                        "maxOutputTokens": 2048,
                    },
                },
            )
            response.raise_for_status()
            data = response.json()

            text = data["candidates"][0]["content"]["parts"][0]["text"]

            # Extract JSON from the response (handle markdown code blocks)
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            result = json.loads(text.strip())
            return {
                "explanation": result.get("explanation", ""),
                "reasoning": result.get("reasoning", ""),
                "suggestions": result.get("suggestions", ""),
            }
    except Exception as e:
        return {
            "explanation": f"Error communicating with Gemini API: {str(e)}",
            "reasoning": "Unable to generate reasoning due to API error.",
            "suggestions": "Please check your GEMINI_API_KEY and try again.",
        }
