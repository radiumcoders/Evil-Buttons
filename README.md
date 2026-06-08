# 😈 Evil Buttons

A [shadcn/ui](https://ui.shadcn.com) registry featuring a collection of animated components built with [Motion](https://motion.dev/). Each component is designed to add punchy, interactive feedback to your UI with minimal setup.

<img width="1523" height="1034" alt="image" src="https://github.com/user-attachments/assets/b48fe7c7-c4fb-48f6-bf8c-2fee6132b880" />


### Github
![GitHub Stars](https://www.shieldcn.dev/github/stars/radiumcoders/Evil-Buttons.svg?variant=secondary&size=sm)
![GitHub Forks](https://www.shieldcn.dev/github/forks/radiumcoders/Evil-Buttons.svg?variant=secondary&size=sm)
![Watchers](https://www.shieldcn.dev/github/watchers/radiumcoders/Evil-Buttons.svg?variant=secondary&size=sm)
![Contributors](https://www.shieldcn.dev/github/contributors/radiumcoders/Evil-Buttons.svg?theme=emerald&size=sm)
![Last commit](https://www.shieldcn.dev/github/last-commit/radiumcoders/Evil-Buttons.svg?variant=secondary&size=sm)

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

Visit [evilbuttons.com](https://evilbuttons.com) for:

- Live component previews
- Installation commands
- Usage examples and code snippets

## Development

### Prerequisites
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
