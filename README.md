<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Made%20with-Z.AI%20GLM%205%20Turbo-10b981?style=for-the-badge&logo=openai&logoColor=white" />
  <source media="(prefers-color-scheme: light)" srcset="https://img.shields.io/badge/Made%20with-Z.AI%20GLM%205%20Turbo-059669?style=for-the-badge&logo=openai&logoColor=white" />
  <img src="https://img.shields.io/badge/Made%20with-Z.AI%20GLM%205%20Turbo-10b981?style=for-the-badge&logo=openai&logoColor=white" alt="Built with GLM 5 Turbo" />
</picture>

# **Zboxy**

### The Cloud Drive That Writes Itself.

**Entirely built from scratch by [Z.AI GLM 5 Turbo](https://z.ai/subscribe?ic=R0K78RJKNW)**—not a template, not a scaffold, not a human-written line. One prompt. One model. One complete, production-ready Google Drive clone.

[**Live Demo**](https://zboxy.space-z.ai/) &nbsp;·
[**Try GLM Coding Plan — 10% OFF**](https://z.ai/subscribe?ic=R0K78RJKNW) &nbsp;·
[**Report Bug**](https://github.com/rommarkdev/zboxy/issues)

<img src="https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js" />
<img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" />
<img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" />
<img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss" />
<img src="https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma" />
<img src="https://img.shields.io/badge/SQLite-Built_in-003B57?style=flat-square&logo=sqlite" />
<img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" />

</div>

---

## The Story

What happens when you give a frontier-class LLM a blank terminal and ask it to build a Google Drive competitor?

**Zboxy** is the answer.

This is not a demo. This is not a prototype. This is a **fully functional, production-deployed** cloud drive application with:

- Token-based authentication (no email, no password—just a name)
- A complete file manager with grid/list views, drag-and-drop, breadcrumbs, search, and keyboard shortcuts
- Three built-in office editors: **Documents** (Markdown WYSIWYG), **Spreadsheets** (virtualized cells + formula engine), and **Presentations** (drag-to-move editor with slide transitions)
- **Music Box** — upload, save, and play your music collection
- **AI Slide Generator** — create presentation templates using GLM AI
- **Public Share Links** — generate password-protected, expirable links for any file or folder
- Full file upload with **folder structure preservation** and **backup import/export**
- Code viewer with search, syntax highlighting, and language detection
- Media viewers for images (zoom/pan/rotate), video, and audio (animated visualizer)
- PDF viewer integration
- Star, trash/restore, rename, move, and batch operations

**Every single line of code—86 source files, 18 API routes, 4 custom editors, 5 file viewers—was written by GLM 5 Turbo in a single session.** No human touched the keyboard.

---

## Live Demo

**[https://zboxy.space-z.ai/](https://zboxy.space-z.ai/)**

No signup. No email. Just enter a name and you're in. Try creating a document, uploading files, generating AI slides, or sharing a link.

---

## Features

### Core Drive

| Feature | Description |
|---------|-------------|
| File Upload | Drag & drop, click, or folder upload with directory structure preserved |
| Grid & List Views | Toggle between visual grid and detailed list layout |
| Search | Real-time search across all files and folders |
| Breadcrumb Navigation | Navigate deep folder hierarchies with one click |
| Star & Favorites | Quick access to important files |
| Trash & Restore | Soft-delete with full restore capability |
| Batch Operations | Multi-select, star, delete, and move in bulk |
| Backup Export/Import | Full JSON backup of your entire drive |
| Keyboard Shortcuts | Ctrl+A select all, Delete to trash, and more |

### Office Editors

| Editor | Tech Stack | Features |
|--------|-----------|----------|
| **Documents** (.zdoc) | ProseMirror via `@mdxeditor/editor` | Full WYSIWYG toolbar, headings, lists, tables, code blocks, links, quotes, markdown-native storage, Ctrl+S save, auto-save, download as .md |
| **Spreadsheets** (.zsheet) | Custom virtualized engine | 200×26 virtualized grid, safe recursive-descent math parser (SUM/AVG/MAX/MIN/COUNT), cell ranges, selection stats, formatting (bold/italic/align/colors), formula bar |
| **Presentations** (.zslide) | Framer Motion + pointer events | Drag-to-move/resize with 8 handles, 8 gradient themes, undo/redo, layers panel, text/rect/circle/line elements, opacity/rotation, slide transitions in present mode |

### AI Features

| Feature | Description |
|---------|-------------|
| **AI Slide Generator** | Create presentation templates using GLM AI with custom topics |
| **Music Box** | Upload, organize, and play your music with a dedicated music player interface |

### Sharing

| Feature | Description |
|---------|-------------|
| **Public Share Links** | Generate unique URLs for any file or folder |
| **Password Protection** | Optional password for sensitive shares |
| **Expiration** | Set links to expire in 1h, 24h, 7d, or 30d |
| **Enable/Disable** | Toggle share links on/off without deleting |
| **Inline Preview** | Shared images, video, audio, PDF render directly in the browser |
| **Folder Sharing** | Share entire folders with contents listed |

### File Viewers

| Viewer | Capabilities |
|--------|-------------|
| **Image** | Scroll-zoom, drag-pan, rotate, fit-to-screen |
| **Video** | Native browser video player |
| **Audio** | Player with animated frequency bar visualizer |
| **Code** | Search with match count, word wrap toggle, language auto-detection via `react-syntax-highlighter` |
| **PDF** | Inline PDF rendering |

---

## Tech Stack

```
Frontend:
  └ Next.js 16 (App Router)
  └ React 19
  └ TypeScript 5
  └ Tailwind CSS 4
  └ shadcn/ui (Radix primitives)
  └ Zustand (state management)
  └ Framer Motion (slide animations)
  └ @mdxeditor/editor (document WYSIWYG)
  └ react-syntax-highlighter (code viewing)
  └ Sonner (toast notifications)

Backend:
  └ Next.js API Routes
  └ Prisma 6 (ORM)
  └ SQLite (zero-config database)
  └ Local filesystem storage

Infrastructure:
  └ Token-based auth (auto-generated, no email)
  └ Dynamic imports (ssr: false) for all editors/viewers
  └ Error boundaries for every component
```

---

## Architecture

```
zboxy/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Root (auth router)
│   │   ├── layout.tsx                # Root layout (Geist font)
│   │   ├── share/[token]/page.tsx   # Public share page
│   │   └── api/
│   │       ├── zboxy/
│   │       │   ├── auth/{register,login,me}/
│   │       │   ├── files/ (CRUD + download)
│   │       │   ├── content/ (editor read/write)
│   │       │   ├── share/ (link management)
│   │       │   ├── folders/, rename/, move/
│   │       │   ├── star/, trash/, backup/
│   │       │   └── ai-slides/
│   │       └── share/[token]/ (public access)
│   ├── components/zboxy/
│   │   ├── login-page.tsx           # Auth UI (dark, Apple-style)
│   │   ├── drive-layout.tsx          # Main file manager
│   │   ├── doc-editor.tsx            # MDX WYSIWYG editor
│   │   ├── sheet-editor.tsx          # Virtualized spreadsheet
│   │   ├── slide-editor.tsx          # Presentation editor
│   │   ├── file-viewers.tsx          # Image/Video/Audio/Code/PDF
│   │   ├── music-box.tsx             # Music player
│   │   ├── ai-slide-generator.tsx    # GLM AI slide creator
│   │   ├── share-dialog.tsx          # Share link management
│   │   └── error-boundary.tsx       # Error boundary
│   └── lib/
│       ├── zboxy-store.ts           # Zustand store
│       ├── zboxy.ts                 # File utilities
│       └── db.ts                    # Prisma client
└── prisma/schema.prisma              # Database schema
```

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm, yarn, or bun

### Install & Run

```bash
# Clone the repo
https://github.com/rommarkdev/zboxy.git
cd zboxy

# Install dependencies
npm install

# Initialize database
npx prisma db push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — enter any name, get your token, and you're in.

### Production Build

```bash
npm run build
npm start
```

---

## How It Was Built

<details>
<summary><strong>Click to read the full story of how GLM 5 Turbo built Zboxy</strong></summary>

### The Prompt

The entire project started with a single instruction to GLM 5 Turbo:

> *"Build a Google Drive clone called Zboxy. Token-based auth. Local filesystem storage. Built-in office editors for documents, spreadsheets, and presentations."*

### What Happened Next

GLM 5 Turbo didn't just generate boilerplate. It **architected the entire system**:

1. **Database Design** — It designed the Prisma schema with users, files, and share links, choosing SQLite for zero-config deployment.

2. **Authentication** — It invented a token-based system: enter a name, get a unique token, use it forever. No email, no password reset flows, no friction.

3. **File Management** — Grid/list views, drag-and-drop upload, folder navigation with breadcrumbs, search, star, trash, rename, move, batch operations — all wired up with 18 API routes.

4. **Document Editor** — It chose `@mdxeditor/editor` (ProseMirror-based), wired it with a full toolbar, Ctrl+S save, auto-save debounce, and markdown-native storage.

5. **Spreadsheet Editor** — It built a **custom virtualized engine** from scratch: 200×26 cells, a **safe recursive-descent math parser** (no `eval()`), SUM/AVG/MAX/MIN/COUNT functions, cell range selection, and a status bar. This alone would take a human days.

6. **Presentation Editor** — It built a full slide editor with pointer-event-based drag-to-move/resize (8 handles), 8 gradient themes, Framer Motion transitions, undo/redo history, and a layers panel.

7. **File Viewers** — Image viewer with scroll-zoom and pan. Code viewer with search and syntax highlighting. Audio viewer with animated frequency bars. Video and PDF viewers.

8. **Music Box & AI Slides** — A dedicated music player and an AI-powered slide template generator using GLM.

9. **Share System** — Public share links with password protection, expiration, enable/disable toggle, and a beautiful public share page with inline previews.

10. **UI/UX** — Apple-inspired dark login page, clean drive interface, responsive design, error boundaries on every component, and toast notifications throughout.

### The Result

**86 source files. 18 API routes. 4 custom editors. 5 file viewers.**

All in one session. All from a single AI model. Zero human-written code.

This is what frontier AI can do today.

</details>

---

## Built with Z.AI GLM 5 Turbo

<div align="center">

<picture>
  <img src="https://img.shields.io/badge/Z.AI-GLM%205%20Turbo-10b981?style=for-the-badge" alt="GLM 5 Turbo" />
</picture>

**This entire application was designed, architected, and coded from scratch by [Z.AI GLM 5 Turbo](https://z.ai/subscribe?ic=R0K78RJKNW).** Not a template. Not a scaffold. Not a human-written line.

One AI model. One prompt session. One complete, production-ready product.

### Want to build something like this?

[GLM Coding Plan](https://z.ai/subscribe?ic=R0K78RJKNW) gives you full support for Claude Code, Cline, and 20+ top coding tools — starting at just **$18/month**.

[**Join now — 10% OFF**](https://z.ai/subscribe?ic=R0K78RJKNW)

</div>

---

## Credits

**Developed by [Roman](https://www.rommark.dev)**

| Link | URL |
|------|-----|
| Telegram | [@VibeCodePrompterSystem](https://t.me/VibeCodePrompterSystem) |
| LinkedIn | [Roman M.](https://www.linkedin.com/in/r%D0%BEman-m-793b3310/) |
| Portfolio | [rommark.dev](https://www.rommark.dev) |
| LLM Tech Blog | [claw.rommark.dev](https://claw.rommark.dev) |

---

## License

MIT — Free to use, modify, and distribute.

---

<div align="center">

**[Live Demo](https://zboxy.space-z.ai/)** &nbsp;·
**[GitHub](https://github.com/rommarkdev/zboxy)** &nbsp;·
**[GLM Coding Plan — 10% OFF](https://z.ai/subscribe?ic=R0K78RJKNW)**

</div>
