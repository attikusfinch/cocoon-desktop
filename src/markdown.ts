/**
 * Minimal markdown → HTML renderer for chat messages. All input is
 * HTML-escaped before any markup is generated, so the output only ever
 * contains tags this module emits itself.
 */

function escapeHTML(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inline(text: string): string {
  let out = escapeHTML(text);
  // `code`
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
  // **bold**, *italic*
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>");
  // [text](https://url) — http(s) links only
  out = out.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_m, label: string, url: string) => `<a href="${url}" target="_blank" rel="noreferrer noopener">${label}</a>`,
  );
  return out;
}

export function renderMarkdown(src: string): string {
  const lines = src.replaceAll("\r\n", "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${para.map(inline).join("<br/>")}</p>`);
      para = [];
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = line.match(/^```\s*(\S*)\s*$/);
    if (fence) {
      flushPara();
      const lang = fence[1];
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const label = lang ? `<span class="code-lang">${escapeHTML(lang)}</span>` : "";
      out.push(`<pre>${label}<code>${escapeHTML(code.join("\n"))}</code></pre>`);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      flushPara();
      i++;
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushPara();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      out.push("<hr/>");
      i++;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      flushPara();
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${quote.map(inline).join("<br/>")}</blockquote>`);
      continue;
    }

    // Lists
    const ul = /^\s*[-*+]\s+/.test(line);
    const ol = /^\s*\d+[.)]\s+/.test(line);
    if (ul || ol) {
      flushPara();
      const tag = ul ? "ul" : "ol";
      const items: string[] = [];
      const re = ul ? /^\s*[-*+]\s+/ : /^\s*\d+[.)]\s+/;
      while (i < lines.length && re.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(re, ""))}</li>`);
        i++;
      }
      out.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    para.push(line);
    i++;
  }
  flushPara();
  return out.join("\n");
}
