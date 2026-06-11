import type { Metadata } from "next";

const DEFAULT_SITE_URL = "https://www.evilbuttons.com";

export const siteConfig = {
  name: "Evil Buttons",
  shortName: "EvilButtons",
  tagline: "Animated shadcn/ui components with Motion",
  description:
    "A shadcn/ui registry of animated buttons built With an Evil Touch. Live previews, copy-paste docs, and one-command CLI installs.",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/$/, ""),
  locale: "en_US",
  github: "https://github.com/radiumcoders/evil-buttons",
  author: {
    name: "Radium Coders",
    url: "https://radiumcoders.com",
  },
  registryNamespace: "@evilbuttons",
  keywords: [
    "evil buttons",
    "shadcn ui",
    "shadcn registry",
    "react buttons",
    "animated buttons",
    "motion react",
    "framer motion components",
    "tailwind css components",
    "ui components",
    "react component library",
    "copy paste components",
    "interactive buttons",
  ],
} as const;

export function getSiteUrl(): string {
  return siteConfig.url;
}

export function absoluteUrl(path = "/"): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${getSiteUrl()}${normalized}`;
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${siteConfig.name} — ${siteConfig.tagline}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.shortName,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.author.name, url: siteConfig.author.url }],
  creator: siteConfig.author.name,
  publisher: siteConfig.author.name,
  category: "technology",
  alternates: {
    canonical: "/docs",
  },
  openGraph: {
    type: "website",
    locale: siteConfig.locale,
    url: "/docs",
    siteName: siteConfig.name,
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.tagline}`,
    description: siteConfig.description,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
  },
  other: {
    "msapplication-TileColor": "#000000",
  },
};

type PageMetadataInput = {
  title: string;
  description?: string;
  path: string;
};

export function createDocsPageMetadata({
  title,
  description,
  path,
}: PageMetadataInput): Metadata {
  const pageDescription = description ?? siteConfig.description;
  const pageTitle = `${title} | ${siteConfig.name}`;

  return {
    title,
    description: pageDescription,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "article",
      locale: siteConfig.locale,
      url: path,
      siteName: siteConfig.name,
      title: pageTitle,
      description: pageDescription,
      images: [
        {
          url: "/og-image.png",
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: pageTitle,
      description: pageDescription,
      images: ["/og-image.png"],
    },
  };
}

export function formatSegmentLabel(segment: string): string {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getDocsBreadcrumbs(url: string, title: string) {
  const segments = url.replace(/^\/docs\/?/, "").split("/").filter(Boolean);
  const items: { name: string; path: string }[] = [
    { name: siteConfig.name, path: "/docs" },
  ];

  let path = "/docs";
  for (let i = 0; i < segments.length - 1; i++) {
    path += `/${segments[i]}`;
    items.push({ name: formatSegmentLabel(segments[i]), path });
  }

  items.push({ name: title, path: url });
  return items;
}

export function createWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    alternateName: siteConfig.shortName,
    url: getSiteUrl(),
    description: siteConfig.description,
    inLanguage: "en",
    publisher: {
      "@type": "Organization",
      name: siteConfig.author.name,
      url: siteConfig.author.url,
    },
  };
}

export function createOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.author.name,
    url: siteConfig.author.url,
    sameAs: [siteConfig.github],
  };
}

export function createSoftwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Web",
    description: siteConfig.description,
    url: absoluteUrl("/docs"),
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    author: {
      "@type": "Organization",
      name: siteConfig.author.name,
      url: siteConfig.author.url,
    },
    codeRepository: siteConfig.github,
    programmingLanguage: ["TypeScript", "React"],
  };
}

export function createBreadcrumbJsonLd(
  crumbs: { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function createTechArticleJsonLd({
  title,
  description,
  path,
}: PageMetadataInput) {
  return {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: title,
    description: description ?? siteConfig.description,
    url: absoluteUrl(path),
    inLanguage: "en",
    isPartOf: {
      "@type": "WebSite",
      name: siteConfig.name,
      url: getSiteUrl(),
    },
    author: {
      "@type": "Organization",
      name: siteConfig.author.name,
      url: siteConfig.author.url,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.author.name,
      url: siteConfig.author.url,
    },
    mainEntityOfPage: absoluteUrl(path),
  };
}
