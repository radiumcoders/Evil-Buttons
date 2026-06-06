# 😈 Evil Buttons

A [shadcn/ui](https://ui.shadcn.com) registry featuring a collection of animated components built with [Motion](https://motion.dev/). Each component is designed to add punchy, interactive feedback to your UI with minimal setup.

### Github
![GitHub Stars](https://www.shieldcn.dev/github/stars/radiumcoders/Evil-Buttons.svg?variant=secondary&size=sm)
![GitHub Forks](https://www.shieldcn.dev/github/forks/radiumcoders/Evil-Buttons.svg?variant=secondary&size=sm)
![Watchers](https://www.shieldcn.dev/github/watchers/radiumcoders/Evil-Buttons.svg?variant=secondary&size=sm)
![Contributors](https://www.shieldcn.dev/github/contributors/radiumcoders/Evil-Buttons.svg?theme=emerald&size=sm)
![Last commit](https://www.shieldcn.dev/github/last-commit/radiumcoders/Evil-Buttons.svg?variant=secondary&size=sm)

### Tooling
![Package mgr · pnpm](https://www.shieldcn.dev/badge/Package_mgr-pnpm-F69220.svg?logo=pnpm&variant=branded&size=sm)
![Language · TypeScript](https://www.shieldcn.dev/badge/Language-TypeScript-3178C6.svg?logo=typescript&variant=branded&size=sm)
![Lint · ESLint](https://www.shieldcn.dev/badge/Lint-ESLint-4B32C3.svg?logo=eslint&variant=branded&size=sm)
![Framework · Next.js](https://www.shieldcn.dev/badge/Framework-Next.js-000000.svg?logo=nextdotjs&variant=branded&size=sm)

### Stack
![React](https://www.shieldcn.dev/badge/Stack-React-61DAFB.svg?logo=react&variant=branded&size=sm)
![Tailwind CSS](https://www.shieldcn.dev/badge/Stack-Tailwind_CSS-06B6D4.svg?logo=tailwindcss&variant=branded&size=sm)

### Agents
![Agent-friendly AGENTS.md](https://www.shieldcn.dev/badge/Agent--friendly-AGENTS.md-D97757.svg?variant=secondary&size=sm)

## Features

- **Animated Components** - Motion-powered buttons and logos with hover, tap, and state animations
- **Buttons & Logos** - Interactive components for any UI need
- **shadcn Registry** - Install components directly via the shadcn CLI
- **Type-Safe** - Full TypeScript support
- **Tailwind CSS** - Styled with Tailwind for easy customization
- **Dark Mode Ready** - Components support light/dark themes out of the box

## Quick Start

Install any component from the registry using the shadcn CLI:

```bash
npx shadcn@latest add @evilbuttons/click-powerup
```

## Documentation

Visit [evilbuttons.radiumcoders.com/docs](https://evilbuttons.radiumcoders.com/docs) for:

- Live component previews
- Installation commands
- Usage examples and code snippets

## Development

### Prerequisites

- Node.js 18+
- pnpm (recommended)

### Setup

```bash
# Clone the repository
git clone https://github.com/radiumcoders/evil-buttons.git
cd evil-buttons

# Install dependencies
pnpm install

# Run development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the docs site.

### Building the Registry

```bash
pnpm registry:build
```

This generates the registry JSON files in `public/r/`.

## Tech Stack

- [Next.js 16](https://nextjs.org) - React framework
- [Motion](https://motion.dev) - Animation library
- [shadcn/ui](https://ui.shadcn.com) - Component registry system
- [Tailwind CSS 4](https://tailwindcss.com) - Styling
- [Fumadocs](https://fumadocs.dev) - Documentation framework

## Project Structure

```
evil-buttons/
├── app/                    # Next.js app router
│   ├── docs/              # Documentation pages
│   ├── globals.css        # Global styles
│   └── layout.tsx         # Root layout
├── components/
│   ├── evil-buttons/      # Registry components
│   │   └── click-powerup.tsx
│   └── ...                # Docs UI components
├── content/
│   └── docs/              # MDX documentation
├── public/r/              # Registry JSON files
├── scripts/
│   └── build-registry.mjs # Registry builder
└── components.json        # shadcn configuration
```

## Contributing

Contributions are welcome! To add a new component:

1. Create your component in `components/evil-buttons/` (buttons or logo subdirectories)
2. Add documentation in `content/docs/`
3. Update `scripts/build-registry.mjs` to include your component
4. Run `pnpm registry:build` to generate registry files

## Star History
[![RepoStars](https://repostars.dev/api/embed?repo=radiumcoders%2FEvil-Buttons&theme=dark)](https://repostars.dev/?repos=radiumcoders%2FEvil-Buttons&theme=dark)

## License

Apache-2.0 license

---

Built by [Radium Coders](https://radiumcoders.com) with an 🪓
