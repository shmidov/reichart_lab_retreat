# Setup

## How it works

The site is a small retreat website. The host switches the room between **activities** from the host page;
until the host picks one, phones and the projector show the welcome screen. The activities, in
[`docs/config.js`](docs/config.js) (`ACTIVITIES`):

| # | Title | Type | What happens |
|---|---|---|---|
| 1 | The review process and its transformation | `lecture` | The title, on the projector and on phones. |
| 2 | Research identity, impact and publication in the AI era | `game` | The opinion game (below). |
| 3 | Future works | `submit`, personal | Everyone pastes the link to their own Google Doc. |
| 4 | Position blogpost | `submit`, group | Anyone pastes their group's link (the same link from several people is fine). |

- **The projector screen (`screen.html`) runs the live site.** It keeps everything in memory (and in the
  laptop's browser storage, so a reload loses nothing).
- **Phones and the host page talk to it through public relays** (free MQTT brokers: HiveMQ and EMQX).
  Every message goes through both relays, so the site keeps working if one is down. Updates take about 0.1–0.3 s.
- **The game uses the Google Sheet only between questions.** The screen loads the questions when it starts,
  or when the host clicks **Reload from Sheet**. After each question, the bar chart is shown immediately from
  memory, and the answers are saved to the Sheet in the background (the host page shows "Sheet: all saved ✓").
- **Links (activities 3 and 4) go straight from the phones to the Sheet**, each activity into its own tab
  (`Future works`, `Position blogpost`), with the person's name and link. Submitting again replaces that
  person's row, so people can fix a link. The projector and host page show who has submitted.

The game asks for a name before its first question; the link forms ask for it too (prefilled if known).
Switching away from the game in the middle of a question closes that question and saves it.

Other settings in [`docs/config.js`](docs/config.js):
- `WELCOME`: the welcome screen's texts (placeholders).
- `GAME_TITLE`: the site's name, used as the browser tab title.
- `HOST_PASSWORD`: the host code. It only separates the host from the players.
- `GAME_ID`: separates this site's messages from anyone else's on the public relays.
- `API_URL`: the Apps Script URL.

## 1. Google Sheet + backend (one time)

1. Create a Google Sheet, then open **Extensions → Apps Script** from inside it.
2. Replace the contents of `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs), and save.
3. In the toolbar, select the function **`setup`** and click **Run**. Allow the permissions:
   *Advanced → Go to … (unsafe)*. This step is safe because the script is your own.
   This creates the tabs `Questions` (with sample questions), `Responses` and `Summary` at the bottom of the Sheet.
   The link tabs (`Future works`, `Position blogpost`) are created automatically with the first submission.
   The Execution log prints the Sheet's link.
4. **Deploy → New deployment** → type **Web app**:
   - Execute as **Me**, and Who has access **Anyone**.
   - Copy the URL (it ends with `/exec`) into `API_URL` in [`docs/config.js`](docs/config.js).

**After changing `Code.gs`:** paste it in again, then **Deploy → Manage deployments**, click the pencil icon,
set **Version** to **New version**, and click **Deploy**. The URL stays the same.

## 2. Website (GitHub Pages)

Repo **Settings → Pages**: **Deploy from a branch**, branch **main**, folder **/docs**.

| Screen | URL |
|---|---|
| Players (QR code) | https://shmidov.github.io/reichart_lab_retreat/ |
| Host | https://shmidov.github.io/reichart_lab_retreat/host.html |
| Projector | https://shmidov.github.io/reichart_lab_retreat/screen.html |

## Questions

Edit the `Questions` tab. Each row is one question:

| column | meaning |
|---|---|
| `id` | Short unique id (`1`, `2`, `coffee`…). Re-playing a question replaces its saved rows. |
| `question` | The question text. |
| `explanation` | Optional text shown under the question. |
| `type` | `scale`, `yesno` or `choice` |
| `options` | `scale`: a range like `1-10`. `yesno`: leave empty (shows Yes / No). `choice`: options separated by `\|`, e.g. `Morning \| Noon \| Evening` |

After editing, click **Reload from Sheet** on the host page. Questions may be in any language.

## On the day

1. On the projector laptop, open **screen.html** first and keep it in front. It runs the site.
2. Open **host.html** (on a phone or a laptop) and sign in. The top of the page should say **Screen connected ✓**.
3. Everyone scans the QR code on the welcome screen.
4. Under **Now showing**, pick the activity. In the game, for each question: **Open question**, then
   **Close question and show results**.
5. To clear the participant list (e.g. after a rehearsal), click **New game**. Rows already saved in the Sheet
   are kept; delete them by hand if they came from a rehearsal.

If the projector laptop has to change, open screen.html on the new one. It shows "Secondary screen" with a
button to take over. Answers to a game question that is still open at that moment are lost.

## Results in the Sheet

- `Responses`: one row per person per question (time, question, name, answer).
- `Summary`: one row per question: the number of answers, the average (for scales), and the counts and
  percentages for each answer.
- `Future works`, `Position blogpost`: one row per person (time, name, link).

## Local rehearsal

```bash
node dev/mock-server.js
```

Then open http://localhost:8080/screen.html, `/host.html` (password `host`) and `/` (players).
The Sheet is faked in memory: open `/mock/sheets` to see what would be saved. The live messages still go
through the real relays, under a random game id.

To add simulated players (bots), install once and then run:

```bash
cd dev && npm install
```

```bash
node dev/bots.js http://localhost:8080 20
```

## Updating the logo

Replace `retreat_logo.pdf`, then regenerate the site's logo (a cropped, slate-colored vector):

```bash
pip install pymupdf
```

```bash
python dev/logo_to_svg.py
```
