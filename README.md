# Reichart Lab Retreat Game

An opinion game in Hebrew for the lab retreat. There are no right answers: the host opens a question,
everyone answers on their phone, and the group's answers appear as a bar chart.

- **Projector screen** (`docs/screen.html`): runs the game in memory, and shows the QR code, each question
  and its bar chart.
- **Player page** (`docs/index.html`): join by QR code with your name, then answer the current question.
- **Host page** (`docs/host.html`, password in `docs/config.js`): see the current and next question and
  control the pace.

Live updates go through free public MQTT relays. The Google Sheet (via Apps Script) provides the questions,
and stores every named answer plus a per-question summary, saved in the background after each question.

See [SETUP.md](SETUP.md) for deployment, the question format, and local rehearsal.

```
docs/                 the website (GitHub Pages)
  assets/relay.js         messaging over the public relays
  assets/game-server.js   the game, run by the projector screen
apps-script/Code.gs   Google Sheet backend (questions + saving)
dev/                  local mock server and simulated players
```
