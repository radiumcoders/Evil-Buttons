import {
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import type { MDXComponents } from "mdx/types";
import { getCustomMDXComponents } from "@/components/mdx-custom-components";
import CopyButton from "@/components/copy-button";
import { DocsFrame } from "@/components/docs-frame";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function extractTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => extractTextContent(child)).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractTextContent(node.props.children);
  }

  return "";
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  const customComponents = getCustomMDXComponents();

  return {
    h1: ({ className, ...props }: ComponentPropsWithoutRef<"h1">) => (
      <h1
        className={cn("font-heading text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.03em] text-foreground", className)}
        {...props}
      />
    ),
    h2: ({ className, ...props }: ComponentPropsWithoutRef<"h2">) => (
      <h2
        className={cn(
          "mt-14 mb-1 font-heading text-[1.375rem] leading-8 font-semibold tracking-[-0.02em] text-foreground first:mt-0",
          className,
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }: ComponentPropsWithoutRef<"h3">) => (
      <h3
        className={cn(
          "mt-10 font-heading text-[1.0625rem] leading-7 font-semibold tracking-[-0.01em] text-foreground",
          className,
        )}
        {...props}
      />
    ),
    p: ({ className, ...props }: ComponentPropsWithoutRef<"p">) => (
      <p className={cn("mt-3 text-[15px] leading-7 text-muted-foreground", className)} {...props} />
    ),
    a: ({ className, children, ...props }: ComponentPropsWithoutRef<"a">) => (
      <a
        className={cn(
          "font-medium text-foreground underline decoration-foreground/25 underline-offset-4 transition-colors hover:decoration-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </a>
    ),
    ul: ({ className, ...props }: ComponentPropsWithoutRef<"ul">) => (
      <ul className={cn("mt-4 ml-5 flex list-disc flex-col gap-2 text-[15px] text-muted-foreground marker:text-foreground/30", className)} {...props} />
    ),
    ol: ({ className, ...props }: ComponentPropsWithoutRef<"ol">) => (
      <ol className={cn("mt-4 ml-5 flex list-decimal flex-col gap-2 text-[15px] text-muted-foreground marker:font-mono marker:text-xs marker:text-foreground/40", className)} {...props} />
    ),
    li: ({ className, ...props }: ComponentPropsWithoutRef<"li">) => (
      <li className={cn("pl-1 leading-7", className)} {...props} />
    ),
    blockquote: ({ className, ...props }: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote
        className={cn(
          "mt-6 rounded-xl border border-border bg-muted/40 px-5 py-4 text-[15px] leading-7 text-muted-foreground [&>p]:mt-0",
          className,
        )}
        {...props}
      />
    ),
    table: ({ className, ...props }: ComponentPropsWithoutRef<"table">) => (
      <DocsFrame>
        <div className="docs-scroll overflow-x-auto">
          <table
            className={cn(
              "w-full border-collapse text-left text-[13px]",
              className,
            )}
            {...props}
          />
        </div>
      </DocsFrame>
    ),
    th: ({ className, ...props }: ComponentPropsWithoutRef<"th">) => (
      <th
        className={cn(
          "h-10 px-4 text-xs font-medium whitespace-nowrap text-muted-foreground",
          className,
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }: ComponentPropsWithoutRef<"td">) => (
      <td
        className={cn(
          "border-t border-border px-4 py-3 align-top leading-6 text-muted-foreground [&_code]:whitespace-nowrap",
          className,
        )}
        {...props}
      />
    ),
    hr: ({ className, ...props }: ComponentPropsWithoutRef<"hr">) => (
      <hr className={cn("my-10 border-border", className)} {...props} />
    ),
    pre: async ({ className, children, ...props }: ComponentPropsWithoutRef<"pre">) => {
      const child = children as ReactElement<{ className?: string; children?: ReactNode }>;
      if (isValidElement(child)) {
        const language = child.props.className?.replace("language-", "") ?? "txt";
        const code = extractTextContent(child.props.children).trimEnd();

        if (code) {
          return (
            <DocsFrame>
              <div data-code-block-wrapper="" data-language={language}>
                <CopyButton
                  className="absolute top-2.5 right-2.5 z-10 bg-background/80 backdrop-blur"
                  code={code}
                  outcome={{
                    name: "code_copied",
                    properties: {
                      source: "docs_code",
                      language,
                    },
                  }}
                />
                <figure data-rehype-pretty-code-figure="">
                  <pre
                    className={cn(
                      "docs-scroll overflow-x-auto bg-transparent p-0 text-sm",
                      className,
                    )}
                    {...props}
                  >
                    {children}
                  </pre>
                </figure>
              </div>
            </DocsFrame>
          );
        }
      }

      return (
        <pre className={cn("docs-scroll overflow-x-auto bg-transparent p-0 text-sm", className)} {...props}>
          {children}
        </pre>
      );
    },
    code: ({
      className,
      children,
      ...props
    }: ComponentPropsWithoutRef<"code">) => {
      if (typeof children === "string") {
        return (
          <code
            className={cn(
              "rounded-md border border-border bg-muted/60 px-1.5 py-px font-mono text-[0.85em] text-foreground",
              className,
            )}
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <code className={cn("font-mono text-sm", className)} {...props}>
          {children}
        </code>
      );
    },
    ...customComponents,
    ...components,
  };
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
