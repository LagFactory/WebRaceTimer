import './stopwatch.mjs';
import './timingList.mjs';
import { initEventLanding } from './eventLanding.mjs';

/**
 * Show a native modal dialog with a message.
 * @param {string} message - Text to display.
 */
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
    document.body.append(dlg);
    dlg.querySelector('#dialog-ok').addEventListener('click', () => dlg.close());
  }
  dlg.querySelector('.dialog-message').textContent = message;
  dlg.showModal();
}

/**
 * Set up the volunteer dashboard: template, pre-loaded records, and event handlers.
 * @param {{ id?: number, name?: string, startTime?: string }} event
 */
export async function initVolunteer(event = {}) {
  // Clear and show main content area
  const content = document.querySelector('#content');
  content.innerHTML = '';
  content.removeAttribute('hidden');

  // Render the volunteer page template
  const tpl = document.querySelector('#volunteerPage');
  content.append(document.importNode(tpl.content, true));

  // Pre-load existing timing records for volunteer #1
  const volunteerId = 1;
  const timingListEl = content.querySelector('timing-list');
  if (timingListEl?.shadowRoot) {
    try {
      const response = await fetch(`/events/${event.id}/records/${volunteerId}`);
      if (response.ok) {
        const { csv } = await response.json();
        const lines = csv.split(/\r?\n/).slice(1).filter(Boolean);
        const recordsRoot = timingListEl.shadowRoot.querySelector('ul.records');
        lines.forEach(record => {
          const li = document.createElement('li');
          li.setAttribute('role', 'group');
          li.innerHTML = `<span>${record}</span> <button type="button" class="delete-btn">Delete</button>`;
          li.querySelector('.delete-btn').addEventListener('click', () => li.remove());
          recordsRoot.prepend(li);
        });
      } else if (response.status !== 404) {
        console.warn('Could not fetch existing records:', response.status);
      }
    } catch (err) {
      console.error('Error fetching existing records:', err);
    }
  } else {
    console.warn('No timing-list component found');
  }

  // Back button returns to event landing
  content.querySelector('.back-btn')
    .addEventListener('click', () => initEventLanding(event));

  // Submit button gathers times and posts CSV
  content.querySelector('#btn-submit')
    .addEventListener('click', async () => {
      const timingList = content.querySelector('timing-list');
      if (!timingList?.shadowRoot) {
        showDialog('Timing list not ready.');
        return;
      }

      // Collect each <li> text minus button text
      const items = Array.from(
        timingList.shadowRoot.querySelectorAll('ul.records > li')
      );
      if (items.length === 0) {
        showDialog('No timings to submit.');
        return;
      }

      const rows = items.map(li => {
        // Try to find a <time> element first
        const timeEl = li.querySelector('time') || li.querySelector('span');
        return timeEl ? timeEl.textContent.trim() : '';
      });
      const csv = ['Time', ...rows].join('\r\n');

      // Send the CSV to the server
      try {
        const resp = await fetch(`/events/${event.id}/records`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv }),
        });
        if (!resp.ok) {
          const err = await resp.json();
          throw new Error(err.error || 'Upload failed');
        }
        showDialog('Timings submitted successfully.');
      } catch (err) {
        console.error('Error submitting timings:', err);
        showDialog(`Submission failed: ${err.message}`);
      }
    });
}
