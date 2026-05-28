import re

with open(r"C:\Users\Administrator\.gemini\antigravity\brain\fa41fcbc-d020-4c7d-910e-06dd519c89f6\scratch\search_results.txt", "r", encoding="utf-8") as f:
    text = f.read()

# Let's search for matches of /api/send
matches = [m.start() for m in re.finditer(r'/api/send', text, re.IGNORECASE)]
out = []
out.append(f"Found {len(matches)} occurrences of '/api/send'")

for idx, pos in enumerate(matches):
    start = max(0, pos - 100)
    end = min(len(text), pos + 500)
    out.append(f"\nMatch {idx} at position {pos}:\n" + text[start:end])
    out.append("-" * 50)

with open(r"C:\Users\Administrator\.gemini\antigravity\brain\fa41fcbc-d020-4c7d-910e-06dd519c89f6\scratch\extracted_sections.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out))

print("Done writing to extracted_sections.txt")
