"use client";

import { FileIcon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

type DocsNavPage = {
  title: string;
  url: string;
};

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (EDITABLE_TAGS.has(element.tagName)) return true;
  return element.isContentEditable;
}

export function DocsCommandMenu({ pages }: { pages: DocsNavPage[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.isComposing) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() !== "k") return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      setOpen((value) => !value);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Search docs"
      description="Jump to a button documentation page"
    >
      <Command>
        <CommandInput placeholder="Search buttons…" />
        <CommandList>
          <CommandEmpty>No pages found.</CommandEmpty>
          <CommandGroup heading="Buttons">
            {pages.map((page) => (
              <CommandItem
                key={page.url}
                value={`${page.title} ${page.url}`}
                onSelect={() => {
                  setOpen(false);
                  router.push(page.url);
                }}
              >
                <FileIcon />
                <span>{page.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
