with open(r"C:\Users\Administrator\.gemini\antigravity\brain\fa41fcbc-d020-4c7d-910e-06dd519c89f6\scratch\search_results.txt", "r", encoding="utf-8") as f:
    text = f.read()

# Let's search for headers in the plain text.
# The headings in the converted plain text might look like "Send Buttons #" or "Send List #" or similar.
import re
headers = re.findall(r'(\w+\s+\w+(?:\s+\w+)?\s*#)', text)
print("Found headers in text:")
for h in headers:
    print("-", h)

# Let's search for "Send Buttons #" in the text and print the 4000 characters following it.
out = []
for header in ["Send Image #", "Send Voice #", "Send Video #", "Send File #", "Send Poll #", "Send List #", "Send Buttons #"]:
    pos = text.find(header)
    if pos != -1:
        out.append(f"\n=================== {header} ===================")
        segment = text[pos:pos+4000]
        # Clean non-ascii
        clean_segment = "".join([c if ord(c) < 128 else " " for c in segment])
        out.append(clean_segment)
        out.append("="*60)
    else:
        out.append(f"Header '{header}' not found!")

with open(r"C:\Users\Administrator\.gemini\antigravity\brain\fa41fcbc-d020-4c7d-910e-06dd519c89f6\scratch\sections_dump.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(out))
print("Done writing sections_dump.txt")
