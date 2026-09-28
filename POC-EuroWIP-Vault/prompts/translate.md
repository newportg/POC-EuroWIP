# Translation Prompt

Read everything in `/raw`. Update or create matching markdown files in `/wiki` so the wiki reflects what's in `/raw`. Then move each processed file from `/raw` to `/archive`.

Rules:

- One topic per file in `/wiki`, kebab-case filenames.
- Merge into existing entries, never overwrite blindly.
- Link related entries with relative markdown links.
- Move processed files from `/raw` to `/archive` with the same filename. Never delete.
- If a raw note relates to a folder in `/projects`, also surface it in that project's notes.
- When uncertain, note it inside the entry rather than guessing.