function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function stripCodeAnnotations(code: string) {
  return code.replace(/\/\/\s*\[!code.*\]\s*/g, "");
}

export async function highlightCode(
  code: string,
  _language: string,
  options?: { showLineNumbers?: boolean },
) {
  const showLineNumbers = options?.showLineNumbers ?? true;
  const lines = escapeHtml(code).split("\n");

  const rows = lines
    .map((line, index) => {
      if (!showLineNumbers) {
        return `<span data-line><span>${line || " "}</span></span>`;
      }

      return `<span data-line><span class="mr-4 inline-block w-8 select-none text-right text-muted-foreground/60">${
        index + 1
      }</span><span>${line || " "}</span></span>`;
    })
    .join("");

  return `<pre class="shiki"><code>${rows}</code></pre>`;
}
