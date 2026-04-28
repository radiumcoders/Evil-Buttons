import {
  isValidElement,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from "react";
import type { MDXComponents } from "mdx/types";
import { getCustomMDXComponents } from "@/components/mdx-custom-components";
import CopyButton from "@/components/copy-button";
import { CodeBlock } from "@/components/code-block";
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
    a: ({ className, ...props }: ComponentPropsWithoutRef<"a">) => (
      <a
        className={cn(
          "font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary",
          className,
        )}
        {...props}
      />
    ),
    ul: ({ className, ...props }: ComponentPropsWithoutRef<"ul">) => (
      <ul className={cn("mt-4 ml-6 list-disc space-y-2 text-muted-foreground", className)} {...props} />
    ),
    ol: ({ className, ...props }: ComponentPropsWithoutRef<"ol">) => (
      <ol className={cn("mt-4 ml-6 list-decimal space-y-2 text-muted-foreground", className)} {...props} />
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
      <div className="mt-6 overflow-x-auto rounded-xl border border-border">
        <table className={cn("w-full border-collapse text-left text-sm", className)} {...props} />
      </div>
    ),
    th: ({ className, ...props }: ComponentPropsWithoutRef<"th">) => (
      <th
        className={cn(
          "border-b border-border bg-muted/60 px-4 py-3 font-medium text-foreground",
          className,
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }: ComponentPropsWithoutRef<"td">) => (
      <td className={cn("border-t border-border px-4 py-3 text-muted-foreground", className)} {...props} />
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
              className="dark:bg-primary-foreground rounded-[10px] bg-[#F5F5F5] p-1"
            >
              <div className="flex h-7 items-center justify-between px-1">
                <figcaption
                  className="text-muted-foreground dark:text-muted-foreground/80 -mt-1 flex items-center gap-1.5 text-xs [&_svg]:size-3.5"
                  data-language={language}
                  data-rehype-pretty-code-title=""
                >
                  {getIconForLanguageExtension(language)}
                  <span className="font-mono">{language}</span>
                </figcaption>
                <CopyButton code={code} />
              </div>
              <figure data-rehype-pretty-code-figure="">
                <div className={cn("rounded-md border bg-background shadow-none", className)}>
                  <pre className="overflow-x-auto bg-transparent p-0 text-sm" {...props}>
                    {children}
                  </pre>
                </div>
              </figure>
            </div>
          );
        }
      }

      return (
        <pre className={cn("overflow-x-auto bg-transparent p-0 text-sm", className)} {...props}>
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
              "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-foreground",
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
