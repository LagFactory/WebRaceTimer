import './stopwatch.mjs';
import { initEventLanding } from './eventLanding.mjs';

// Display a non-blocking modal dialog with the provided message
function showDialog(message) {
  let dlg = document.querySelector('dialog#modal-dialog');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'modal-dialog';
    dlg.innerHTML = `
      <p class="dialog-message"></p>
      <menu>
        <button id="dialog-ok" type="button">OK</button>
      </menu>
    `;
    document.body.appendChild(dlg);
    dlg.querySelector('#dialog-ok').addEventListener('click', () => dlg.close());
  }
  dlg.querySelector('.dialog-message').textContent = message;
  dlg.showModal();
}

// Read template for stopwatch UI
const tpl = document.querySelector('#stopwatch-template').content;

/**
 * Manages a shared stopwatch timeline and notifies subscribers.
 */
class StopwatchManager {
  constructor() {
    this._startTime = 0;
    this._elapsed = 0;
    this._tickId = null;
    this._listeners = new Set();
  }

  // Begin or resume timing
  start() {
    if (this._tickId) return;
    this._startTime = performance.now() - this._elapsed;
    const tick = () => {
      this._elapsed = performance.now() - this._startTime;
      this._notify();
      this._tickId = requestAnimationFrame(tick);
    };
    tick();
  }

  // Pause timing
  stop() {
    if (!this._tickId) return;
    cancelAnimationFrame(this._tickId);
    this._tickId = null;
    this._notify();
  }

  // Check running state
  isRunning() {
    return this._tickId !== null;
  }

  // Add a subscriber callback
  subscribe(fn) {
    this._listeners.add(fn);
    fn(this._elapsed, this.isRunning());
  }

  // Remove a subscriber callback
  unsubscribe(fn) {
    this._listeners.delete(fn);
  }

  // Notify subscribers of current time and state
  _notify() {
    for (const fn of this._listeners) {
      try {
        fn(this._elapsed, this.isRunning());
      } catch (e) {
        console.error(e);
      }
    }
  }
}

// Singleton stopwatch manager
export const stopwatchManager = new StopwatchManager();

/**
 * Custom <stop-watch> element with optional controls.
 * Auto-starts if a `start-time` attribute is present.
 */
class StopWatch extends HTMLElement {
  constructor() {
    super();
    // Set up shadow DOM and UI
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(tpl.cloneNode(true));

    // Cache UI elements
    this.display = root.querySelector('.display');
    this.controls = root.querySelector('.controls');
    this.startBtn = root.querySelector('.start');
    this.stopBtn = root.querySelector('.stop');

    // Hide controls if not requested
    if (!this.hasAttribute('controls')) {
      this.controls.style.display = 'none';
    }

    // Update display and buttons on each tick
    this._onTick = (elapsed, running) => {
      this.display.textContent = new Date(elapsed).toISOString().substr(11, 12);
      if (this.hasAttribute('controls')) {
        this.startBtn.disabled = running;
        this.stopBtn.disabled = !running;
      }
    };
  }

  // Observe when `start-time` attribute changes
  static get observedAttributes() {
    return ['start-time'];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'start-time' && this.isConnected) {
      this._applyStartTime(newVal);
    }
  }

  connectedCallback() {
    // Wire up control buttons and subscribe to manager
    this.startBtn.addEventListener('click', () => this._handleStart());
    this.stopBtn.addEventListener('click', () => stopwatchManager.stop());
    stopwatchManager.subscribe(this._onTick);

    // Start immediately if a start-time was already set
    if (this.hasAttribute('start-time')) {
      this._applyStartTime(this.getAttribute('start-time'));
    }
  }

  // Handle the logic when start button is clicked
  async _handleStart() {
    if (stopwatchManager.isRunning()) return;
    const eventId = this.getAttribute('event-id');
    const startIso = this.getAttribute('start-time');
    // Record start-time on server if needed
    if (eventId && !startIso) {
      try {
        const res = await fetch(`/events/${eventId}/start`, { method: 'PATCH' });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        this.setAttribute('start-time', data.startTime);
      } catch (err) {
        console.error(err);
        showDialog('Could not record start time. Please try again.');
        return;
      }
    }
    // Start the stopwatch manager
    stopwatchManager.start();
  }

  // Apply an ISO timestamp to resume timing
  _applyStartTime(isoString) {
    const startMs = Date.parse(isoString);
    const now = Date.now();
    if (!isNaN(startMs) && startMs <= now) {
      stopwatchManager._elapsed = now - startMs;
      stopwatchManager.start();
    }
  }

  disconnectedCallback() {
    // Remove the subscriber when element is removed
    stopwatchManager.unsubscribe(this._onTick);
  }
}

// Register the custom element
customElements.define('stop-watch', StopWatch);
