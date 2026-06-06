import { highlightCode, stripCodeAnnotations } from "@/lib/highlight-code";
import { getIconForLanguageExtension } from "@/assets/language/icons";
import CopyButton from "@/components/copy-button";
import { cn } from "@/lib/utils";

export async function CodeBlock({
  code,
  language,
  title,
  className,
  copyButton = true,
  showLineNumbers = false,
  withWrapper = false,
  wrapperClassName,
}: {
  code: string;
  language: string;
  title?: string | undefined;
  className?: string;
  copyButton?: boolean;
  showLineNumbers?: boolean;
  withWrapper?: boolean;
  wrapperClassName?: string;
}) {
  const cleanedCode = stripCodeAnnotations(code);
  const highlightedCode = await highlightCode(cleanedCode, language, {
    showLineNumbers,
  });

  if (withWrapper) {
    return (
      <div
        data-code-block-wrapper=""
        className={cn(
          "mt-4 overflow-hidden border border-border bg-background",
          wrapperClassName,
        )}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <figcaption
            className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5"
            data-language={language}
            data-rehype-pretty-code-title=""
          >
            {getIconForLanguageExtension(language)}
            <span className="font-mono">{title ?? language}</span>
          </figcaption>
          {copyButton && <CopyButton code={cleanedCode} />}
        </div>
        <figure data-rehype-pretty-code-figure="">
          <div
            className={cn(className, "bg-background shadow-none")}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </figure>
      </div>
    );
  }

  return (
    <figure className="relative" data-rehype-pretty-code-figure="">
      {title && (
        <figcaption
          className="text-muted-foreground/50 flex items-center gap-1.5 text-xs [&_svg]:size-3.5"
          data-language={language}
          data-rehype-pretty-code-title=""
        >
          {getIconForLanguageExtension(language)}
          <span className="font-mono">{title}</span>
        </figcaption>
      )}
      {copyButton && (
        <div className="sticky top-0 z-10 flex h-0 justify-end">
          <CopyButton withBlurBg code={cleanedCode} className="mt-2 mr-2" />
        </div>
      )}
      <div className={cn("", className)} dangerouslySetInnerHTML={{ __html: highlightedCode }} />
    </figure>
  );
}
