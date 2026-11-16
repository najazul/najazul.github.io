# norman.dev — terminal portfolio

A portfolio you explore like a Claude Code session. Menus are slash commands, pages are markdown files, and the **context window** fills up as you read. Reading every page = 100%.

No build step. Plain HTML, CSS, and JavaScript.

## Run locally

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. (Opening `index.html` by double-click won't work, because the page loads the `.md` files with `fetch`.)

## Edit the content

All text lives in `content/`. Change the `.md` files; the page updates by itself.

| File | Command |
|---|---|
| `content/about.md` | `/about` |
| `content/experience.md` | `/experience` |
| `content/projects.md` | `/projects` |
| `content/skills.md` | `/skills` |
| `content/education.md` | `/education` |
| `content/contact.md` | `/contact` |
| `content/blog/README.md` | `/blog` |
| `content/blog/*.md` | `/blog <name>` |

- To link to a command inside markdown, write `[label](cmd:/blog drain)`.
- To add a new page or post: add the `.md` file, then add one line to the `DOCS` list at the top of `assets/app.js`.
- `/github` pulls your public repos live from the GitHub API (falls back to a small saved list if the API is down or rate limited).

## Deploy (CI/CD)

Just push to `main` of the private repo `najazul/portfolio`:

```bash
git push
```

GitHub Actions (`.github/workflows/ci.yml`) then:

1. **Checks** — JavaScript syntax, every page/command link exists, and no private info (phone, address, email).
2. **Deploys** — only if the checks pass, it copies the site files to the public `najazul.github.io` repo using the `PAGES_DEPLOY_KEY` secret. GitHub Pages publishes it about 20 seconds later.

Pull requests run the checks only, never the deploy.

Moving to your own domain later: add a `CNAME` file with the domain to the site files, or switch hosts — any static host works (no build step).

## The buddy

`assets/buddy.js` is the little mascot. It shows in the welcome box, floats on the right on wide screens, and talks in the bottom bar on every screen. Each page has up to 4 random poses and lines (edit `PAGES` in that file). It also reacts to clicks, highlighting text, typing, and staying on one page too long (45s, then it falls asleep at 2 min).

## Commands

`/help` `/about` `/experience` `/projects` `/blog` `/skills` `/education` `/contact` `/github` `/context` `/compact` `/clear` `/theme`, plus shell-style `ls`, `cat <file>`, `whoami`, `pwd`.
