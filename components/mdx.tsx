import {
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import type { MDXComponents } from "mdx/types";
import { getCustomMDXComponents } from "@/components/mdx-custom-components";
import CopyButton from "@/components/copy-button";
import { getIconForLanguageExtension } from "@/assets/language/icons";

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
        className={cn("text-4xl font-semibold tracking-tight text-foreground", className)}
        {...props}
      />
    ),
    h2: ({ className, ...props }: ComponentPropsWithoutRef<"h2">) => (
      <h2
        className={cn(
          "mt-10 border-t border-border pt-10 text-2xl font-semibold tracking-tight text-foreground",
          className,
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }: ComponentPropsWithoutRef<"h3">) => (
      <h3 className={cn("mt-8 text-xl font-semibold text-foreground", className)} {...props} />
    ),
    p: ({ className, ...props }: ComponentPropsWithoutRef<"p">) => (
      <p className={cn("mt-4 text-base leading-8 text-muted-foreground", className)} {...props} />
    ),
    a: ({ className, children, ...props }: ComponentPropsWithoutRef<"a">) => (
      <a
        className={cn(
          "font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary",
          className,
        )}
        {...props}
      >
        {children}
      </a>
    ),
    ul: ({ className, ...props }: ComponentPropsWithoutRef<"ul">) => (
      <ul className={cn("mt-4 ml-6 flex list-disc flex-col gap-2 text-muted-foreground", className)} {...props} />
    ),
    ol: ({ className, ...props }: ComponentPropsWithoutRef<"ol">) => (
      <ol className={cn("mt-4 ml-6 flex list-decimal flex-col gap-2 text-muted-foreground", className)} {...props} />
    ),
    li: ({ className, ...props }: ComponentPropsWithoutRef<"li">) => (
      <li className={cn("pl-1 leading-7", className)} {...props} />
    ),
    blockquote: ({ className, ...props }: ComponentPropsWithoutRef<"blockquote">) => (
      <blockquote
        className={cn(
          "mt-6 border-l-2 border-border pl-6 text-muted-foreground italic",
          className,
        )}
        {...props}
      />
    ),
    table: ({ className, ...props }: ComponentPropsWithoutRef<"table">) => (
      <div className="mt-4 overflow-hidden border border-border bg-background">
        <div className="docs-scroll overflow-x-auto bg-background">
          <table
            className={cn("w-full border-collapse text-left text-sm", className)}
            {...props}
          />
        </div>
      </div>
    ),
    th: ({ className, ...props }: ComponentPropsWithoutRef<"th">) => (
      <th
        className={cn(
          "px-4 py-3 font-medium text-foreground",
          className,
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }: ComponentPropsWithoutRef<"td">) => (
      <td
        className={cn("border-t border-border px-4 py-3 text-muted-foreground", className)}
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
            <div
              data-code-block-wrapper=""
              className="mt-4 overflow-hidden border border-border bg-background"
            >
              <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <figcaption
                  className="flex items-center gap-1.5 text-xs text-muted-foreground [&_svg]:size-3.5"
                  data-language={language}
                  data-rehype-pretty-code-title=""
                >
                  {getIconForLanguageExtension(language)}
                  <span className="font-mono">{language}</span>
                </figcaption>
                <CopyButton code={code} />
              </div>
              <figure data-rehype-pretty-code-figure="">
                <div className="bg-background shadow-none">
                  <pre className={cn("docs-scroll overflow-x-auto bg-transparent p-0 text-sm", className)} {...props}>
                    {children}
                  </pre>
                </div>
              </figure>
            </div>
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
              "bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground",
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
