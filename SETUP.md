# Setup

One-time setup: about 10 minutes. You need a Google account and access to this GitHub repo.

## 1. Google Sheet + backend

1. Create a new Google Sheet (e.g. "Lab retreat game").
2. In the Sheet: **Extensions → Apps Script**.
3. Replace the contents of `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs) from this repo, and save.
4. **Project Settings** (gear icon) → **Script properties** → **Add script property**:
   `HOST_PASSWORD` = the password the host will use.
5. Back in the editor, select the function **`setup`** in the toolbar and click **Run**.
   Google asks for permission. Because the script is your own, choose *Advanced → Go to … (unsafe)* and allow.
   This creates the tabs `Questions` (with three sample questions), `Responses` and `Summary`.
6. **Deploy → New deployment** → type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (ends with `/exec`).

## 2. Website (GitHub Pages)

1. Put the web app URL in [`docs/config.js`](docs/config.js) as `API_URL`, then commit and push.
2. On GitHub: **Settings → Pages → Build and deployment**:
   Source **Deploy from a branch**, branch **main**, folder **/docs**. Save.
3. After a minute the site is live at `https://shmidov.github.io/reichart_lab_retreat/`:

| Screen | URL | Who |
|---|---|---|
| Players | `…/reichart_lab_retreat/` | Everyone, via the QR code |
| Host | `…/reichart_lab_retreat/host.html` | Host (password) |
| Review screen | `…/reichart_lab_retreat/screen.html` | Projector. It shows the QR code in the lobby. |

## Questions

Edit the `Questions` tab. Each row is a question:

| column | meaning |
|---|---|
| `id` | Short unique id (e.g. `1`, `2`, `q-coffee`). Used to group rows in `Responses` and `Summary`. |
| `question` | The question text. |
| `explanation` | Optional text shown under the question. |
| `type` | `scale`, `yesno` or `choice` |
| `options` | `scale`: a range like `1-10` (or `0-5`). `yesno`: leave empty (shows כן / לא). `choice`: options separated by `\|`, e.g. `בוקר \| צהריים \| ערב` |

Questions appear in row order. After editing the Sheet during the game, click **רענון מהגיליון** (reload from sheet) on the host page.
Keep the `options` column formatted as plain text (`setup` does this), so Sheets doesn't turn `1-10` into a date.

## How a game runs

1. The review screen shows the QR code. Players join with their name only.
2. The host opens a question. Players answer, and can change their answer as often as they like.
3. The host closes the question. Only now are the answers saved: one row per person in `Responses`, and the counts in `Summary`. The review screen shows the bar chart.
4. Repeat. Re-opening a question that was already played replaces its saved results.

## Updating the backend later

After changing `Code.gs`: **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The URL stays the same.

To start fresh (state, players and live answers; the Sheets are kept), run the `resetGame` function from the editor.

## Local rehearsal (no Google needed)

```bash
node dev/mock-server.js
```

Then open http://localhost:8080 (players), `/host.html` (password `host`) and `/screen.html`.
This runs the real `Code.gs` against an in-memory fake Sheet. To see what would be saved, open `/mock/sheets`.
