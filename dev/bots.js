#!/usr/bin/env node
// Simulated players for rehearsals. They join, answer each opened question after a random delay,
// and sometimes change their mind.
//
//   cd dev && npm install                     (once)
//   node dev/bots.js http://localhost:8080 20
//
// The site URL is only used to read its config.js (game id and relays). Pointing this at the real
// site adds the bots to the real game, so only do that for a rehearsal (then click "New game").

const mqtt = require('mqtt');
const vm = require('vm');

const site = process.argv[2] || 'http://localhost:8080';
const count = Number(process.argv[3] || 10);

const rand = () => Math.random().toString(36).slice(2, 12);
const pick = list => list[Math.floor(Math.random() * list.length)];

async function main() {
  const configUrl = new URL('config.js', site.endsWith('/') ? site : site + '/');
  const sandbox = { window: {} };
  vm.runInNewContext(await (await fetch(configUrl)).text(), sandbox);
  const config = sandbox.window.APP_CONFIG;
  const prefix = 'reichart-retreat/' + config.GAME_ID + '/';
  console.log(`${count} bots joining game "${config.GAME_ID}" via ${config.BROKERS[0]}`);

  const bots = Array.from({ length: count }, (_, i) => ({ id: 'bot' + rand(), name: 'Bot ' + (i + 1) }));
  const client = mqtt.connect(config.BROKERS[0], { clientId: 'rlr-bots-' + rand() });
  const publish = (suffix, msg) =>
    client.publish(prefix + suffix, JSON.stringify(Object.assign({ mid: rand() }, msg)), { qos: 1 });
  const join = bot => publish('in', { type: 'join', id: bot.id, name: bot.name });

  let round = null;
  let acks = 0;
  let nacks = 0;

  client.on('connect', () => {
    client.subscribe(prefix + 'state', { qos: 1 });
    client.subscribe(prefix + 'p/+', { qos: 1 });
    bots.forEach(join);
    console.log('connected; bots joined');
  });
  setInterval(() => bots.forEach(join), 20000);

  client.on('message', (topic, payload) => {
    let msg;
    try { msg = JSON.parse(payload.toString()); } catch (err) { return; }
    if (topic.endsWith('/state')) {
      if (msg.phase === 'open' && msg.round !== round) {
        round = msg.round;
        const q = msg.question;
        console.log(`question ${msg.index + 1} opened: "${q.text}"`);
        bots.forEach(bot => {
          const answer = () => publish('in', { type: 'answer', id: bot.id, name: bot.name, round, answer: pick(q.options) });
          setTimeout(answer, 500 + Math.random() * 6000);
          if (Math.random() < 0.2) setTimeout(answer, 7000 + Math.random() * 3000); // changes their mind
        });
      } else if (msg.phase === 'results' && msg.results) {
        console.log(`results: ${msg.results.total} answers  (acks so far: ${acks}, rejected: ${nacks})`);
      }
    } else if (msg.type === 'ack') {
      acks++;
    } else if (msg.type === 'nack') {
      nacks++;
    }
  });
}

main().catch(err => { console.error(err); process.exit(1); });
