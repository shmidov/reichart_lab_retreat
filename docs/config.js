window.APP_CONFIG = {
  // The site's name (browser tab title).
  GAME_TITLE: 'Reichart Group Retreat',

  // What everyone sees until the host starts an activity (placeholder; to be designed).
  WELCOME: {
    title: 'Welcome to the retreat!',
  },

  // The parts of the day the host can switch between, in order.
  //   type 'lecture': the title, on the projector and on phones
  //   type 'game':    the opinion game (questions from the Google Sheet)
  //   type 'submit':  phones submit a link (e.g. a Google Doc); saved to the Sheet tab named in `sheet`,
  //                   one row per person (resubmitting replaces that person's row).
  //                   mode 'personal' = everyone submits their own; 'group' = anyone may submit their group's.
  //                   chooseTopics: N = first pick N topics (the game's question titles), saved to `topicsSheet`.
  //   parts: optional steps the host switches between (see the blogpost below); titles become "Title: label".
  //   accent: the activity's palette color ('sage', 'terracotta', 'sand' or 'slate').
  // The host can also show the built-in Agenda page, which lists these activities.
  ACTIVITIES: [
    {
      id: 'review',
      type: 'lecture',
      name: 'Discussion by Roi',
      title: 'The review process and its transformation',
      accent: 'sage',
    },
    {
      id: 'game',
      type: 'game',
      name: 'Game and discussion',
      title: 'Research identity, impact and publication in the AI era',
      accent: 'slate',
    },
    {
      id: 'blogpost',
      type: 'submit',
      mode: 'group',
      name: 'Group writing',
      title: 'Position paper / Blogpost draft',
      chooseTopics: 3,
      topicInstructions: 'Choose the three topics you would most like to write about. We will form the groups from your choices.',
      topicsSheet: 'Position topics',
      // The host switches between these parts. kind: 'topics' (pick topics), 'submit' (paste the link),
      // 'text' (just show text: screenText on the projector, phoneText on phones, or `text` on both).
      parts: [
        { id: 'topics', kind: 'topics', label: 'Topic choice' },
        { id: 'writing', kind: 'submit', label: 'Group writing' },
        {
          id: 'presentations',
          kind: 'text',
          label: 'Presentations',
          screenText: 'Each group has 5 minutes to present and 5 minutes for questions.',
          phoneText: 'You have 5 minutes to present with your group and 5 minutes for questions.',
        },
      ],
      instructions: "Write your group's post in a Google Doc, set sharing to \"Anyone with the link\", and paste the link here. Anyone in the group can submit it.",
      sheet: 'Position blogpost',
      accent: 'terracotta',
    },
    {
      id: 'future',
      type: 'submit',
      mode: 'personal',
      name: 'Personal writing',
      title: 'Future works',
      instructions: 'Write your piece in a Google Doc, set sharing to "Anyone with the link", and paste the link here.',
      sheet: 'Future works',
      parts: [
        { id: 'writing', kind: 'submit', label: 'Personal writing' },
        {
          id: 'presentations',
          kind: 'text',
          label: 'Presentations',
          text: 'You should present your research direction in 5 minutes, and explain how it is derived from your work or why you find it interesting.',
        },
      ],
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
