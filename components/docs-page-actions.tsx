"use client";

import {
  CaretDownIcon,
  CheckIcon,
  CopyIcon,
  GithubLogoIcon,
  MarkdownLogoIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import { DropdownMenu } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DocsPageActionsProps = {
  /** Clean Markdown source for the page, used for the copy action. */
  markdown: string;
  /** Link to the source `.mdx` file on GitHub. */
  githubUrl: string;
  /** Relative URL that serves the raw Markdown (for "View as Markdown"). */
  markdownUrl: string;
  /** Absolute Markdown URL handed to external AI tools. */
  markdownAbsoluteUrl: string;
  /** "Open in v0" deep link. Omitted for pages without a registry item. */
  v0Url?: string;
};

type MenuLink = {
  label: string;
  href: string;
  icon: ReactNode;
};

function OpenAiIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
      <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.1419.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
    </svg>
  );
}

function ClaudeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.541Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
    </svg>
  );
}

function CursorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
      <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
    </svg>
  );
}

function V0Icon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-4">
      <path d="M14.066 6.028v2.22h5.729q.075-.001.148.005l-5.853 5.752a2 2 0 0 1-.024-.309V8.247h-2.353v5.45c0 2.322 1.935 4.222 4.258 4.222h5.675v-2.22h-5.675q-.03 0-.059-.003l5.729-5.629q.006.082.006.166v5.465H24v-5.465a4.204 4.204 0 0 0-4.205-4.205zM0 8.245l8.28 9.266c.839.94 2.396.346 2.396-.914V8.245H8.19v5.44l-4.86-5.44Z" />
    </svg>
  );
}

const ICON_PROPS = { size: 16 } as const;

function buildAiPrompt(url: string): string {
  return `Read ${url} so I can ask questions about it.`;
}

export function DocsPageActions({
  markdown,
  githubUrl,
  markdownUrl,
  markdownAbsoluteUrl,
  v0Url,
}: DocsPageActionsProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);

      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }

      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 1500);
    } catch {
      // Clipboard unavailable (e.g. insecure context) will fail silently.
    }
  }

  const prompt = encodeURIComponent(buildAiPrompt(markdownAbsoluteUrl));

  const links: MenuLink[] = [
    {
      label: "Open in GitHub",
      href: githubUrl,
      icon: <GithubLogoIcon {...ICON_PROPS} />,
    },
    {
      label: "View as Markdown",
      href: markdownUrl,
      icon: <MarkdownLogoIcon {...ICON_PROPS} />,
    },
    {
      label: "Open in Scira AI",
      href: `https://scira.ai/?q=${prompt}`,
      icon: <SparkleIcon {...ICON_PROPS} />,
    },
    {
      label: "Open in ChatGPT",
      href: `https://chatgpt.com/?hints=search&q=${prompt}`,
      icon: <OpenAiIcon />,
    },
    {
      label: "Open in Claude",
      href: `https://claude.ai/new?q=${prompt}`,
      icon: <ClaudeIcon />,
    },
    {
      label: "Open in Cursor",
      href: `cursor://anysphere.cursor-deeplink/prompt?text=${prompt}`,
      icon: <CursorIcon />,
    },
    ...(v0Url
      ? [
          {
            label: "Open in v0",
            href: v0Url,
            icon: <V0Icon />,
          },
        ]
      : []),
  ];

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCopy}
        aria-label="Copy page as Markdown"
      >
        {copied ? (
          <CheckIcon {...ICON_PROPS} weight="bold" />
        ) : (
          <CopyIcon {...ICON_PROPS} />
        )}
        {copied ? "Copied" : "Copy Markdown"}
      </Button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button type="button" variant="outline" size="sm" aria-label="Open this page in…">
            Open
            <CaretDownIcon
              {...ICON_PROPS}
              className="transition-transform group-data-[state=open]/button:rotate-180"
            />
          </Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className={cn(
              "z-50 min-w-56 overflow-hidden border border-border bg-popover p-1.5 text-popover-foreground shadow-lg",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
            )}
          >
            {links.map((link) => (
              <DropdownMenu.Item key={link.label} asChild>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-sm text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:bg-muted focus-visible:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground"
                >
                  <span className="flex size-4 shrink-0 items-center justify-center text-foreground">
                    {link.icon}
                  </span>
                  <span className="flex-1">{link.label}</span>
                  <ExternalLinkGlyph />
                </a>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function ExternalLinkGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="size-3.5 text-muted-foreground/60"
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}
