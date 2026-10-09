# Setup

## How it works

- **The projector screen (`screen.html`) runs the game.** It keeps the game in memory (and in the laptop's
  browser storage, so a reload loses nothing).
- **Phones and the host page talk to it through public relays** (free MQTT brokers: HiveMQ and EMQX).
  Every message goes through both relays, so the game keeps working if one is down. Updates take about 0.1–0.3 s.
- **The Google Sheet is only used between questions.** The screen loads the questions from it when it starts,
  or when the host clicks **רענון מהגיליון**. After each question, the bar chart is shown immediately from
  memory, and the answers are saved to the Sheet in the background. If a save fails, the screen keeps
  retrying, and the host page shows the status ("גיליון: הכול נשמר ✓").

The site has **activities** that the host switches between from the host page. Until the host picks one,
phones and the projector show the welcome screen. The current activities are:
- **The opinion game:** everything described here.
- **A writing task:** the projector shows its title and explanation, and phones show only the title.
  It is display only, with no storage.

Players are asked for their name only when the game is on. Switching away from the game in the middle of a
question closes that question and saves it.

Settings are in [`docs/config.js`](docs/config.js):
- `WELCOME`: the welcome screen's texts.
- `ACTIVITIES`: the activities, their names, and the writing task's title and explanation (all placeholders).
- `GAME_TITLE`: the site's name, shown in every header (a placeholder for now).
- `HOST_PASSWORD`: the host password. It only separates the host from the players.
- `GAME_ID`: separates this game's messages from anyone else's on the public relays.
- `API_URL`: the Apps Script URL.

## 1. Google Sheet + backend (one time)

1. Create a Google Sheet, then open **Extensions → Apps Script** from inside it.
2. Replace the contents of `Code.gs` with [`apps-script/Code.gs`](apps-script/Code.gs), and save.
3. In the toolbar, select the function **`setup`** and click **Run**. Allow the permissions:
   *Advanced → Go to … (unsafe)*. This step is safe because the script is your own.
   This creates the tabs `Questions` (with sample questions), `Responses` and `Summary` at the bottom of the Sheet.
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
| `options` | `scale`: a range like `1-10`. `yesno`: leave empty (shows כן / לא). `choice`: options separated by `\|`, e.g. `בוקר \| צהריים \| ערב` |

After editing, click **רענון מהגיליון** on the host page.

## On the day

1. On the projector laptop, open **screen.html** first and keep it in front. It is the game.
2. Open **host.html** (on a phone or a laptop) and log in. The top of the page should say **מסך התצוגה מחובר ✓**.
3. Players scan the QR code on the projector.
4. For each question: **פתיחת שאלה** (open question), then **סגירת השאלה והצגת התוצאות** (close and show results).
5. To clear the players list before the real game (e.g. after a rehearsal), click **משחק חדש** (new game).
   Rows already saved in the Sheet are kept; delete them by hand if they came from a rehearsal.

If the projector laptop has to change, open screen.html on the new one. It shows "מסך משני" (secondary
screen) with a button to take over. Answers to a question that is still open at that moment are lost.

## Results in the Sheet

- `Responses`: one row per person per question (time, question, name, answer).
- `Summary`: one row per question: the number of answers, the average (for scales), and the counts and
  percentages for each answer.

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
