"""
scripts/md_to_pdf.py
Converts docs/HANDOVER.md into an executive-grade corporate PDF using Playwright.
"""
import os
import re
from playwright.sync_api import sync_playwright

def parse_markdown_to_html(md_text: str) -> str:
    lines = md_text.splitlines()
    html_lines = []
    in_code_block = False
    in_table = False
    table_header_parsed = False
    in_list = False

    for line in lines:
        stripped = line.strip()

        # Fenced code blocks
        if stripped.startswith("```"):
            if in_code_block:
                html_lines.append("</code></pre>")
                in_code_block = False
            else:
                lang = stripped[3:].strip()
                html_lines.append(f'<pre><code class="language-{lang}">')
                in_code_block = True
            continue

        if in_code_block:
            safe = line.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            html_lines.append(safe)
            continue

        # Tables
        if "|" in line:
            if not in_table:
                if in_list:
                    html_lines.append("</ul>")
                    in_list = False
                in_table = True
                table_header_parsed = False
                html_lines.append("<table>")

            # Check if separator row
            if re.match(r"^\|?[\s:-|]+\|?$", stripped):
                table_header_parsed = True
                continue

            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            tag = "th" if not table_header_parsed else "td"
            row_html = "<tr>" + "".join(f"<{tag}>{c}</{tag}>" for c in cells) + "</tr>"
            html_lines.append(row_html)
            continue
        else:
            if in_table:
                html_lines.append("</table>")
                in_table = False
                table_header_parsed = False

        # Lists
        if stripped.startswith(("* ", "- ")) or re.match(r"^\d+\.\s", stripped):
            if not in_list:
                html_lines.append("<ul>")
                in_list = True
            item_text = re.sub(r"^(\*|\-|\d+\.)\s+", "", stripped)
            html_lines.append(f"<li>{item_text}</li>")
            continue
        else:
            if in_list:
                html_lines.append("</ul>")
                in_list = False

        if not stripped:
            continue

        # Headers
        if stripped.startswith("### "):
            html_lines.append(f"<h3>{stripped[4:]}</h3>")
        elif stripped.startswith("## "):
            html_lines.append(f"<h2>{stripped[3:]}</h2>")
        elif stripped.startswith("# "):
            html_lines.append(f"<h1>{stripped[2:]}</h1>")
        elif stripped.startswith("---"):
            html_lines.append("<hr/>")
        else:
            html_lines.append(f"<p>{stripped}</p>")

    if in_table:
        html_lines.append("</table>")
    if in_list:
        html_lines.append("</ul>")
    if in_code_block:
        html_lines.append("</code></pre>")

    content = "\n".join(html_lines)

    # Inline formatting: bold, italic, code, links
    content = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", content)
    content = re.sub(r"\*(.+?)\*", r"<em>\1</em>", content)
    content = re.sub(r"`([^`]+)`", r"<code>\1</code>", content)
    content = re.sub(r"\[(.+?)\]\((.+?)\)", r'<a href="\2">\1</a>', content)

    return content

HTML_TEMPLATE = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Puen Publishing Handover Document</title>
<style>
  @page {
    size: A4;
    margin: 20mm 15mm 20mm 15mm;
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 9pt;
      color: #64748b;
    }
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.55;
    color: #1e293b;
    font-size: 10pt;
  }
  h1 {
    color: #0f172a;
    font-size: 19pt;
    border-bottom: 2.5px solid #2563eb;
    padding-bottom: 6px;
    margin-top: 0;
    margin-bottom: 14px;
  }
  h2 {
    color: #1e3a8a;
    font-size: 13pt;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 4px;
    margin-top: 22px;
    margin-bottom: 10px;
    page-break-after: avoid;
  }
  h3 {
    color: #334155;
    font-size: 11pt;
    margin-top: 14px;
    margin-bottom: 6px;
    page-break-after: avoid;
  }
  p {
    margin-top: 0;
    margin-bottom: 8px;
  }
  ul, ol {
    margin-top: 0;
    margin-bottom: 10px;
    padding-left: 20px;
  }
  li {
    margin-bottom: 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0 16px 0;
    font-size: 8.8pt;
    page-break-inside: avoid;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 6px 10px;
    text-align: left;
    vertical-align: top;
  }
  th {
    background-color: #f1f5f9;
    color: #0f172a;
    font-weight: 600;
  }
  tr:nth-child(even) td {
    background-color: #f8fafc;
  }
  code {
    background-color: #f1f5f9;
    color: #0f172a;
    padding: 1.5px 5px;
    border-radius: 3px;
    font-family: "Consolas", "Monaco", "Courier New", monospace;
    font-size: 8.8pt;
  }
  pre {
    background-color: #0f172a;
    color: #f8fafc;
    padding: 10px 14px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 8.5pt;
    margin: 10px 0;
    page-break-inside: avoid;
  }
  pre code {
    background-color: transparent;
    color: inherit;
    padding: 0;
  }
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 18px 0;
  }
  a {
    color: #2563eb;
    text-decoration: none;
  }
</style>
</head>
<body>
__BODY_CONTENT__
</body>
</html>"""

def convert_handover_to_pdf(src_md="docs/HANDOVER.md", dst_pdf="docs/HANDOVER.pdf"):
    print(f"Reading {src_md}...")
    with open(src_md, "r", encoding="utf-8") as f:
        md_text = f.read()

    body_html = parse_markdown_to_html(md_text)
    full_html = HTML_TEMPLATE.replace("__BODY_CONTENT__", body_html)

    print(f"Rendering PDF with Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.set_content(full_html)
        page.pdf(
            path=dst_pdf,
            format="A4",
            print_background=True,
            margin={"top": "18mm", "bottom": "18mm", "left": "14mm", "right": "14mm"}
        )
        browser.close()
    
    print(f"SUCCESS: Generated {dst_pdf} ({os.path.getsize(dst_pdf)} bytes)")

if __name__ == "__main__":
    convert_handover_to_pdf()
