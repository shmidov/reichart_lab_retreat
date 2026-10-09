// The retreat's live state. Runs inside the projector screen (screen.html) and keeps everything in memory
// (mirrored to localStorage, so a page reload doesn't lose anything): which activity is on (welcome,
// a lecture, the opinion game, a link submission…), who is here, the game's questions, answers and results,
// and who has chosen topics or submitted a link. (Those go straight from the phones to the Google Sheet.)
//
// Topics (all under reichart-retreat/<GAME_ID>/):
//   in        players and host -> server: join (also a presence ping), answer, topics, submitted, cmd
//   state     server -> everyone (retained): activity, game phase, current question, results, counts
//   host      server -> host (retained): question list, player names, who answered, Sheet upload status
//   server    server heartbeat (retained), so pages know the projector is alive
//   p/<id>    server -> one player: answer acknowledgements

const HEARTBEAT_MS = 3000;
const SERVER_ALIVE_MS = 10000;
const COMMAND_MAX_AGE_MS = 60000;
// Names not heard from for this long are from an earlier session (another day, a rehearsal) and are
// forgotten when the projector starts. During the day nobody is dropped, however long their phone sleeps.
const STALE_SESSION_MS = 12 * 60 * 60 * 1000;

class GameServer {
  constructor(relay, serverId, epoch, onChange) {
    this.relay = relay;
    this.serverId = serverId;
    this.onChange = onChange;
    this.storageKey = 'server:' + window.APP_CONFIG.GAME_ID;
    this.uploading = false;
    this.publishTimer = null;

    let saved = null;
    try { saved = JSON.parse(storage.get(this.storageKey) || 'null'); } catch (err) { /* corrupt: start fresh */ }
    this.g = Object.assign({
      rev: 0,
      activity: 'welcome', // 'welcome' or an id from APP_CONFIG.ACTIVITIES
      phase: 'lobby',
      index: -1,
      round: 0,
      question: null,
      results: null,
      questions: [],
      questionsError: null,
      players: {}, // id -> name, everyone who joined in this session
      seen: {}, // id -> last time we heard from them
      answers: {}, // id -> {name, answer}, current round only
      submissions: {}, // activity id -> {player id: name}, for 'submit' activities
      topicChoices: {}, // activity id -> {player id: {name, topics}}, for activities with chooseTopics
      uploads: [], // closed questions waiting to be saved to the Sheet
      uploadError: null,
      savedCount: 0,
    }, saved || {});
    this.savedEpoch = saved ? saved.epoch : 0;
    this.g.epoch = epoch;
  }

  /** Takes over from another projector: continue from the last published state (live answers are lost). */
  adopt(state, host) {
    if (!state) return;
    ['activity', 'phase', 'index', 'round', 'question', 'results'].forEach(k => { this.g[k] = state[k]; });
    this.g.rev = state.rev || 0;
    if (host && host.questions) this.g.questions = host.questions;
    this.g.answers = {};
  }

  start() {
    this.relay.subscribe('in', msg => this.handle(msg));
    this.forgetEarlierSessions();
    this.beat();
    this.heartbeatTimer = setInterval(() => this.beat(), HEARTBEAT_MS);
    this.publishNow();
    this.loadQuestions();
    this.processUploads();
  }

  stop() {
    clearInterval(this.heartbeatTimer);
    clearTimeout(this.publishTimer);
    clearTimeout(this.retryTimer);
    this.stopped = true;
  }

  beat() {
    this.lastBeat = Date.now();
    this.relay.publish('server', { serverId: this.serverId, epoch: this.g.epoch, t: Date.now() }, true);
  }

  // ---------- incoming messages ----------

  handle(msg) {
    if (this.stopped) return;
    // The host pings, so the heartbeat keeps flowing even if the browser throttles this tab's timers.
    if (msg.type === 'ping') return Date.now() - (this.lastBeat || 0) > 1000 && this.beat();
    if (msg.type === 'join') return this.join(msg);
    if (msg.type === 'answer') return this.answer(msg);
    if (msg.type === 'submitted') return this.submitted(msg);
    if (msg.type === 'topics') return this.topics(msg);
    if (msg.type === 'cmd') return this.command(msg);
  }

  join(msg) {
    const id = String(msg.id || '');
    const name = cleanName(msg.name);
    if (!id || !name) return;
    const current = this.g.answers[id];
    this.relay.publish('p/' + id, { type: 'welcome', round: this.g.round, answer: current ? current.answer : null });
    if (current) current.name = name;
    if (this.touch(id, name)) this.schedulePublish();
  }

  /** Marks a person as present. Returns true if the participant list changed. */
  touch(id, name) {
    this.g.seen = this.g.seen || {};
    this.g.seen[id] = Date.now();
    if (this.g.players[id] === name) return false;
    this.g.players[id] = name;
    return true;
  }

  /** Forgets names left over from an earlier session (e.g. yesterday's rehearsal). */
  forgetEarlierSessions() {
    const seen = this.g.seen || {};
    const cutoff = Date.now() - STALE_SESSION_MS;
    let changed = false;
    Object.keys(this.g.players).forEach(id => {
      if ((seen[id] || 0) < cutoff) {
        delete this.g.players[id];
        delete seen[id];
        changed = true;
      }
    });
    if (changed) this.schedulePublish();
  }

  answer(msg) {
    const id = String(msg.id || '');
    const name = cleanName(msg.name);
    if (!id || !name) return;
    const q = this.g.question;
    const reply = extra => this.relay.publish('p/' + id, Object.assign({ round: msg.round, answer: msg.answer }, extra));
    if (this.g.phase !== 'open' || !q || msg.round !== this.g.round) return reply({ type: 'nack', error: 'This question is already closed.' });
    if (q.options.indexOf(msg.answer) === -1) return reply({ type: 'nack', error: 'Not a valid answer.' });
    this.touch(id, name);
    this.g.answers[id] = { name, answer: msg.answer };
    reply({ type: 'ack' });
    this.schedulePublish();
  }

  /** A phone saved a link to the Sheet; remember who, so the screens can show progress. */
  submitted(msg) {
    const activity = activityById(String(msg.activity));
    const id = String(msg.id || '');
    const name = cleanName(msg.name);
    if (!activity || activity.type !== 'submit' || !id || !name) return;
    const list = this.g.submissions[activity.id] = this.g.submissions[activity.id] || {};
    list[id] = name;
    this.touch(id, name);
    this.schedulePublish();
  }

  /** A phone saved its topic choices to the Sheet; keep them so the host can see who chose what. */
  topics(msg) {
    const activity = activityById(String(msg.activity));
    const id = String(msg.id || '');
    const name = cleanName(msg.name);
    const topics = Array.isArray(msg.topics) ? msg.topics.map(String).slice(0, 10) : [];
    if (!activity || !activity.chooseTopics || !id || !name || !topics.length) return;
    this.g.topicChoices = this.g.topicChoices || {};
    const list = this.g.topicChoices[activity.id] = this.g.topicChoices[activity.id] || {};
    list[id] = { name, topics };
    this.touch(id, name);
    this.schedulePublish();
  }

  command(msg) {
    if (msg.password !== window.APP_CONFIG.HOST_PASSWORD) return;
    if (Math.abs(Date.now() - (msg.t || 0)) > COMMAND_MAX_AGE_MS) return; // delayed/replayed
    switch (msg.cmd) {
      case 'activity': return this.setActivity(String(msg.activity));
      case 'open': return this.open(Number(msg.index));
      case 'close': return this.close();
      case 'lobby': return this.idle('lobby');
      case 'end': return this.idle('end');
      case 'reloadQuestions': return this.loadQuestions();
      case 'retryUploads': return this.processUploads();
      case 'resetGame': return this.reset();
    }
  }

  // ---------- activities ----------

  /** Switches what everyone sees. Leaving the game closes (and saves) an open question first. */
  setActivity(id) {
    if (id !== 'welcome' && !activityById(id)) return;
    if (this.g.phase === 'open') this.close(true);
    this.g.activity = id;
    this.publishNow();
  }

  // ---------- game flow ----------

  open(index) {
    const q = this.g.questions[index];
    if (!q) return;
    if (this.g.phase === 'open') this.close(true);
    Object.assign(this.g, { phase: 'open', index, round: this.g.round + 1, question: q, results: null, answers: {} });
    this.publishNow();
  }

  /** Shows the results right away (from memory) and queues the Sheet upload in the background. */
  close(silent) {
    if (this.g.phase !== 'open' || !this.g.question) return;
    const q = this.g.question;
    const answers = Object.values(this.g.answers);
    const counts = q.options.map(label => ({ label, count: answers.filter(a => a.answer === label).length }));
    Object.assign(this.g, { phase: 'results', results: { counts, total: answers.length }, answers: {} });
    this.g.uploads.push({
      question: { id: q.id, text: q.text, type: q.type, options: q.options },
      answers: answers.sort((a, b) => a.name.localeCompare(b.name, 'he')),
      closedAt: new Date().toISOString(),
    });
    if (!silent) this.publishNow();
    this.processUploads();
  }

  idle(phase) {
    if (this.g.phase === 'open') this.close(true);
    Object.assign(this.g, { phase, question: null, results: null });
    this.publishNow();
  }

  reset() {
    Object.assign(this.g, { phase: 'lobby', index: -1, question: null, results: null, players: {}, seen: {}, answers: {} });
    this.publishNow();
  }

  // ---------- Google Sheet ----------

  async loadQuestions() {
    try {
      this.g.questions = await api('questions');
      this.g.questionsError = null;
    } catch (err) {
      this.g.questionsError = err.message;
    }
    this.publishNow();
  }

  async processUploads() {
    if (this.uploading || this.stopped) return;
    this.uploading = true;
    clearTimeout(this.retryTimer);
    while (this.g.uploads.length && !this.stopped) {
      try {
        await api('save', this.g.uploads[0]);
        this.g.uploads.shift();
        this.g.savedCount++;
        this.g.uploadError = null;
      } catch (err) {
        this.g.uploadError = err.message;
        this.retryTimer = setTimeout(() => this.processUploads(), 5000);
        break;
      } finally {
        this.schedulePublish();
      }
    }
    this.uploading = false;
  }

  // ---------- outgoing state ----------

  /** Coalesces bursts (e.g. many answers at once) into one update. */
  schedulePublish() {
    if (this.publishTimer) return;
    this.publishTimer = setTimeout(() => this.publishNow(), 150);
  }

  publishNow() {
    if (this.stopped) return;
    clearTimeout(this.publishTimer);
    this.publishTimer = null;
    const g = this.g;
    g.rev++;
    storage.set(this.storageKey, JSON.stringify(g));

    const showQuestion = g.phase === 'open' || g.phase === 'results';
    const current = activityById(g.activity);
    const choices = Object.values(((g.topicChoices || {})[g.activity]) || {});
    const state = {
      epoch: g.epoch,
      rev: g.rev,
      activity: g.activity || 'welcome',
      phase: g.phase,
      index: g.index,
      total: g.questions.length,
      round: g.round,
      question: showQuestion ? g.question : null,
      results: g.phase === 'results' ? g.results : null,
      playerCount: Object.keys(g.players).length,
      answeredCount: Object.keys(g.answers).length,
      submittedCount: Object.keys((g.submissions || {})[g.activity] || {}).length,
      // Topic choice: the game's question titles are the topics.
      topicOptions: current && current.chooseTopics ? g.questions.map(q => q.text) : null,
      topicsCount: choices.length,
    };
    const byName = (a, b) => a.localeCompare(b, 'he');
    const host = {
      epoch: g.epoch,
      rev: g.rev,
      questions: g.questions,
      questionsError: g.questionsError,
      players: Object.values(g.players).sort(byName),
      answered: Object.values(g.answers).map(a => a.name).sort(byName),
      submitted: Object.values((g.submissions || {})[g.activity] || {}).sort(byName),
      topicChoices: choices.sort((a, b) => byName(a.name, b.name)),
      pendingUploads: g.uploads.length,
      uploadError: g.uploadError,
      savedCount: g.savedCount,
    };
    this.relay.publish('state', state, true);
    this.relay.publish('host', host, true);
    this.onChange(state, host);
  }
}

function cleanName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').slice(0, 40);
}
