# Reichart Lab Retreat Game

An opinion game in Hebrew for the lab retreat. There are no right answers: the host shows a question, everyone
answers on their phone, and the group's answers appear as a bar chart.

- **Player page** (`docs/index.html`): join by QR code with your name, then answer the current question.
- **Host page** (`docs/host.html`, password protected): see the current and next question and control the pace.
- **Review screen** (`docs/screen.html`, for the projector): the QR code, then each question and its bar chart.

The site is static (GitHub Pages). The backend is a Google Apps Script bound to a Google Sheet, which defines the
questions and stores every named answer plus per-question summaries.

See [SETUP.md](SETUP.md) for deployment, the question format, and local rehearsal.

```
apps-script/Code.gs   backend (paste into the Sheet's Apps Script project)
docs/                 the website (served by GitHub Pages)
dev/mock-server.js    local server that runs Code.gs against a fake Sheet
```
