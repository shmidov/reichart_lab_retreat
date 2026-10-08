// Live messaging between the pages, over public MQTT relays (needs mqtt.min.js).
// Every message is published through all configured brokers and de-duplicated on arrival,
// so the game keeps working as long as at least one broker is reachable.

class Relay {
  /** onStatus(connectedCount, totalCount) is called whenever a broker connects or drops. */
  constructor(onStatus) {
    const config = window.APP_CONFIG || {};
    this.prefix = 'reichart-retreat/' + config.GAME_ID + '/';
    this.handlers = new Map(); // topic suffix -> handler
    this.seen = new Map(); // message id -> receive time
    this.onStatus = onStatus || (() => {});
    this.clients = (config.BROKERS || []).map(url => {
      const client = mqtt.connect(url, {
        clientId: 'rlr-' + randomId(),
        clean: true,
        keepalive: 30,
        connectTimeout: 10000,
        reconnectPeriod: 2000,
        resubscribe: false, // we subscribe ourselves on every (re)connect
      });
      client.on('connect', () => {
        this.handlers.forEach((_, suffix) => client.subscribe(this.prefix + suffix, { qos: 1 }));
        this.emitStatus();
      });
      client.on('close', () => this.emitStatus());
      client.on('error', () => this.emitStatus());
      client.on('message', (topic, payload) => this.receive(topic, payload));
      return client;
    });
  }

  get connectedCount() {
    return this.clients.filter(c => c.connected).length;
  }

  emitStatus() {
    this.onStatus(this.connectedCount, this.clients.length);
  }

  /** One handler per topic suffix, e.g. subscribe('state', msg => ...). */
  subscribe(suffix, handler) {
    this.handlers.set(suffix, handler);
    this.clients.forEach(c => { if (c.connected) c.subscribe(this.prefix + suffix, { qos: 1 }); });
  }

  publish(suffix, message, retain) {
    const payload = JSON.stringify(Object.assign({ mid: randomId() }, message));
    this.clients.forEach(c => c.publish(this.prefix + suffix, payload, { qos: 1, retain: !!retain }));
  }

  receive(topic, payload) {
    let msg;
    try {
      msg = JSON.parse(payload.toString());
    } catch (err) {
      return; // e.g. an empty payload that clears a retained message
    }
    if (!msg || !msg.mid || this.seen.has(msg.mid)) return;
    this.seen.set(msg.mid, Date.now());
    if (this.seen.size > 3000) {
      const cutoff = Date.now() - 120000;
      this.seen.forEach((t, id) => { if (t < cutoff) this.seen.delete(id); });
    }
    const handler = this.handlers.get(topic.slice(this.prefix.length));
    if (handler) handler(msg);
  }

  /** Resolves once at least one broker is connected (or after timeoutMs, resolving false). */
  whenConnected(timeoutMs) {
    return new Promise(resolve => {
      if (this.connectedCount) return resolve(true);
      const timer = setTimeout(() => resolve(false), timeoutMs);
      this.clients.forEach(c => c.once('connect', () => { clearTimeout(timer); resolve(true); }));
    });
  }
}

function randomId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '');
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

/** Game states are ordered by (epoch, rev): epoch changes when a new projector takes over. */
function isNewerState(next, current) {
  if (!next) return false;
  if (!current) return true;
  if (next.epoch !== current.epoch) return next.epoch > current.epoch;
  return next.rev > current.rev;
}
