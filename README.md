# Reichart Lab Retreat

A small retreat website. The host switches the room between activities (a welcome screen, a lecture, an
opinion game, and two writing activities where people submit links to their Google Docs); phones and the
projector follow along.

- **Projector screen** (`docs/screen.html`): runs the live site in memory and shows the current activity:
  the QR code, the game's questions and bar charts, the writing prompts.
- **Participant page** (`docs/index.html`): opened by QR code; answer game questions, submit links.
- **Host page** (`docs/host.html`, code in `docs/config.js`): choose the activity and run the game.

Live updates go through free public MQTT relays. A Google Sheet (via Apps Script) provides the game's
questions and stores every answer, a per-question summary, and the submitted links.

See [SETUP.md](SETUP.md) for deployment, the question format, and local rehearsal.

```
docs/                 the website (GitHub Pages)
  config.js               activities, texts and settings
  assets/relay.js         messaging over the public relays
  assets/game-server.js   the live state, run by the projector screen
apps-script/Code.gs   Google Sheet backend (questions, results, links)
dev/                  local mock server, simulated players, logo conversion
```
