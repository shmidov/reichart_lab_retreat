window.APP_CONFIG = {
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
