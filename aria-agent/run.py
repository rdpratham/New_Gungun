#!/usr/bin/env python3
"""
ARIA — Account Research & Intelligence Agent
Entry point. Prints the system prompt for reference.
The actual agent runs via Claude Code with CLAUDE.md loaded.
"""

import os

PROMPT_PATH = os.path.join(os.path.dirname(__file__), "SYSTEM_PROMPT.md")

def main():
    with open(PROMPT_PATH) as f:
        print(f.read())

if __name__ == "__main__":
    main()
