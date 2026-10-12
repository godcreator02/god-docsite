# Windows relative glob base reproduction

Run on native Windows with Node.js 24.14.1 and pnpm 12.4.2.

```
pnpm install --ignore-workspace
pnpm dev
```

Open the URL printed by Vite. Then in another terminal, in this directory:

```powershell
Set-Content -LiteralPath content/added.txt -Value added
```

The list should include the new file automatically, but on Vite 8.3.4 it remains stale until the server is restarted. No Fumadocs/React/React Router plugins are loaded.

Controls: use `base: '/content'`, or remove `base` and use the pattern `../content/**/*.txt`. Test each in a separate clean server run.

