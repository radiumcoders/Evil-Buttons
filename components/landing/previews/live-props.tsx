"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  type ReactElement,
} from "react";

type LivePropsSink = (props: Record<string, unknown>) => void;

const LivePropsContext = createContext<LivePropsSink | null>(null);

export const LivePropsProvider = LivePropsContext.Provider;

/**
 * Wraps the button a dial preview renders and reports the props it was given,
 * so the docs panel can turn the current config into a copyable prompt.
 * Outside a provider it just renders the button.
 */
export function LiveProps({ children }: { children: ReactElement }) {
  const report = useContext(LivePropsContext);
  const props = children.props as Record<string, unknown>;

  useLayoutEffect(() => {
    report?.(props);
  });

  return children;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return /["{}\n]/.test(value) ? `{${JSON.stringify(value)}}` : `"${value}"`;
  }
  return `{${JSON.stringify(value)}}`;
}

/** Serializes captured props as a JSX element, dropping handlers and undefined. */
export function toJsx(name: string, props: Record<string, unknown>) {
  const { children, ...rest } = props;
  const attrs = Object.entries(rest)
    .filter(
      ([, value]) => value !== undefined && typeof value !== "function",
    )
    .map(([key, value]) =>
      value === true ? `  ${key}` : `  ${key}=${formatValue(value)}`,
    );

  const open = attrs.length > 0 ? `<${name}\n${attrs.join("\n")}\n` : `<${name}`;
  const text =
    typeof children === "string" || typeof children === "number"
      ? String(children)
      : null;

  if (text === null) return `${open}${attrs.length > 0 ? "/>" : " />"}`;
  return `${open}>\n  ${text}\n</${name}>`;
}
