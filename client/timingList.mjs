import { stopwatchManager } from './stopwatch.mjs';

// Get the timing list template from the page
const tpl = document.querySelector('#timing-list-template');

/**
 * Custom element to record and display passed times.
 * Shows device time and stopwatch time for each entry.
 */
export class TimingList extends HTMLElement {
  constructor() {
    super();
    // Set up shadow DOM and clone template
    const root = this.attachShadow({ mode: 'open' });
    root.appendChild(tpl.content.cloneNode(true));

    // Cache UI elements
    this._passedBtn = root.querySelector('.passed-btn');
    this._recordsList = root.querySelector('.records');
    this._currentElapsed = 0;

    // Bind methods
    this._onTick = this._onTick.bind(this);
    this._onPassedClick = this._onPassedClick.bind(this);
  }

  connectedCallback() {
    // Listen for stopwatch updates and button clicks
    stopwatchManager.subscribe(this._onTick);
    this._passedBtn.addEventListener('click', this._onPassedClick);
  }

  disconnectedCallback() {
    // Remove listeners when element is removed
    stopwatchManager.unsubscribe(this._onTick);
    this._passedBtn.removeEventListener('click', this._onPassedClick);
  }

  /**
   * Update elapsed time from stopwatch
   * @param {number} elapsed - milliseconds since start
   */
  _onTick(elapsed) {
    this._currentElapsed = elapsed;
  }

  /**
   * Handle "Passed" clicks: record and show times
   */
  _onPassedClick() {
    // Create entry element
    const li = document.createElement('li');
    li.setAttribute('role', 'group');

    // Get current device time
    const deviceTime = new Intl.DateTimeFormat(undefined, {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).format(new Date());

    // Format stopwatch time
    const stopwatchTime = new Date(this._currentElapsed)
      .toISOString().substr(11, 12);

    // Display times
    const span = document.createElement('span');
    span.textContent = `Device: ${deviceTime} | Stopwatch: ${stopwatchTime}`;

    // Delete button for the entry
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = 'Delete';
    delBtn.classList.add('delete-btn');
    delBtn.addEventListener('click', () => li.remove());

    // Add entry to the list
    li.append(span, delBtn);
    this._recordsList.prepend(li);

    // Notify external listeners if needed
    this.dispatchEvent(new CustomEvent('record-added', {
      detail: { deviceTime, stopwatchTime }
    }));
  }
}

// Register the timing-list element
customElements.define('timing-list', TimingList);
