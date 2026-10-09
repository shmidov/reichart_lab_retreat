window.APP_CONFIG = {
  // The site's name (browser tab title).
  GAME_TITLE: 'Reichart Group Retreat',

  // What everyone sees until the host starts an activity (placeholder; to be designed).
  WELCOME: {
    title: 'Welcome to the retreat',
    subtitle: 'Placeholder welcome text',
  },

  // The parts of the day the host can switch between, in order.
  //   type 'lecture': the title, on the projector and on phones
  //   type 'game':    the opinion game (questions from the Google Sheet)
  //   type 'submit':  phones submit a link (e.g. a Google Doc); saved to the Sheet tab named in `sheet`,
  //                   one row per person (resubmitting replaces that person's row).
  //                   mode 'personal' = everyone submits their own; 'group' = anyone may submit their group's.
  //                   chooseTopics: N = first pick N topics (the game's question titles), saved to `topicsSheet`.
  //   accent: the activity's palette color ('sage', 'terracotta', 'sand' or 'slate').
  ACTIVITIES: [
    {
      id: 'review',
      type: 'lecture',
      name: 'Lecture',
      title: 'The review process and its transformation',
      accent: 'sage',
    },
    {
      id: 'game',
      type: 'game',
      name: 'Discussion game',
      title: 'Research identity, impact and publication in the AI era',
      accent: 'slate',
    },
    {
      id: 'blogpost',
      type: 'submit',
      mode: 'group',
      name: 'Group writing',
      title: 'Position blogpost',
      chooseTopics: 3,
      topicInstructions: 'Placeholder: choose the three topics you would most like to write about. We will form the groups from your choices.',
      topicsSheet: 'Blogpost topics',
      instructions: "Placeholder instructions: write your group's post in a Google Doc, set sharing to \"Anyone with the link\", and paste the link here. Anyone in the group can submit it.",
      sheet: 'Position blogpost',
      accent: 'terracotta',
    },
    {
      id: 'future',
      type: 'submit',
      mode: 'personal',
      name: 'Personal writing',
      title: 'Future works',
      instructions: 'Placeholder instructions: write your piece in a Google Doc, set sharing to "Anyone with the link", and paste the link here.',
      sheet: 'Future works',
      accent: 'sand',
    },
  ],

  // Apps Script web-app URL (ends with /exec). See SETUP.md.
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
