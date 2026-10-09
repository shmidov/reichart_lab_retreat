window.APP_CONFIG = {
  // The site's name, shown in the header of every screen.
  GAME_TITLE: 'שם לריטריט',

  // What everyone sees until the host starts an activity (placeholder; to be designed).
  WELCOME: {
    title: 'ברוכים הבאים לריטריט',
    subtitle: 'טקסט פתיחה זמני',
  },

  // The parts of the day the host can switch between, in order.
  //   type 'game':    the opinion game (questions from the Google Sheet)
  //   type 'writing': the projector shows the title and explanation; phones show the title only
  ACTIVITIES: [
    { id: 'game', type: 'game', name: 'משחק הדעות', title: 'שם למשחק' },
    {
      id: 'writing',
      type: 'writing',
      name: 'משימת כתיבה',
      title: 'כותרת משימת הכתיבה',
      explanation: 'הסבר מפורט על משימת הכתיבה. טקסט זמני שיוחלף בהמשך.\nאפשר לכתוב כאן כמה שורות.',
    },
  ],

  // Apps Script web-app URL (ends with /exec). Used only by the projector screen,
  // to load the questions and to save each question's answers. See SETUP.md.
  API_URL: 'https://script.google.com/macros/s/AKfycbwbvGGEVrz3mSHzmiGxzTtpbA-H6bgYyh02rPnci9slc4SHDqDPvdwrkwC4dC9ma-o3/exec',

  // Separates this game's live messages from anyone else's on the public relays.
  // Change it to start a completely fresh game.
  GAME_ID: 'reichart-retreat-2026-4qjs1ta7',

  // Only separates the host from the players; it is not real security.
  HOST_PASSWORD: 'reichart',

  // Public MQTT relays. Every message goes through all of them, so one being down doesn't matter.
  BROKERS: [
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://broker.emqx.io:8084/mqtt',
  ],
};
