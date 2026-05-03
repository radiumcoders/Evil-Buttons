# Evil Buttons

A [shadcn/ui](https://ui.shadcn.com) registry featuring a collection of animated components built with [Motion](https://motion.dev/). Each component is designed to add punchy, interactive feedback to your UI with minimal setup.

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
npx shadcn@latest add https://evilbuttons.radiumcoders.com/r/click-powerup.json
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

## License

Apache-2.0 license

---

Built by [Radium Coders](https://radiumcoders.com) with an 🪓
