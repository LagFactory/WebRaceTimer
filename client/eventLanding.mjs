import './stopwatch.mjs'; // Import stopwatch component

/**
 * Display a modal dialog with a message.
 * @param {string} message - Text to show in the dialog.
 */
function showDialog(message) {
  // Locate or create the modal dialog
  let dialog = document.querySelector('dialog#modal-dialog');
  if (!dialog) {
    // Build the dialog structure
    dialog = document.createElement('dialog');
    dialog.id = 'modal-dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.innerHTML = `
      <p class="dialog-message"></p>
      <menu>
        <button id="dialog-ok" type="button">OK</button>
      </menu>
    `;
    document.body.appendChild(dialog);
    // Close dialog on OK button click
    dialog.querySelector('#dialog-ok')
      .addEventListener('click', () => dialog.close());
  }

  // Update message and show dialog
  dialog.querySelector('.dialog-message').textContent = message;
  dialog.showModal();
}

/**
 * Set up the event landing page: render template and wire interactions.
 * @param {{ id?: number; name?: string; startTime?: string }} event
 */
export function initEventLanding(event = {}) {
  const content = document.querySelector('#content');
  content.hidden = false;

  // Load landing page template
  const template = document.querySelector('#landingPage');
  content.replaceChildren(document.importNode(template.content, true));

  // Get UI elements for results and actions
  const seeResultsBtn = content.querySelector('#see-results');
  const resultsSection = content.querySelector('#results-container');
  const downloadBtn = content.querySelector('#download-results');
  const closeBtn = content.querySelector('#close-results');

  let pollInterval = null;
  let refreshInterval = null;

  /**
   * Check if the final report is ready and enable the button.
   */
  async function checkFinalReport() {
    try {
      const res = await fetch(`/events/${event.id}/final-report`);
      if (res.ok) {
        clearInterval(pollInterval);
        seeResultsBtn.disabled = false;
        seeResultsBtn.removeAttribute('aria-disabled');
        seeResultsBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        content.querySelector('#results-note')?.remove();
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }

  /**
   * Fetch CSV results and display them in a sortable table.
   */
  async function showResults() {
    try {
      const res = await fetch(`/events/${event.id}/final-report`);
      if (!res.ok) {
        console.error('Failed to fetch results');
        return;
      }

      // Read and split CSV lines
      const csv = (await res.text()).trim();
      const lines = csv.split('\n');
      const dataRows = /[A-Za-z]/.test(lines[0]) ? lines.slice(1) : lines;

      // Clear previous controls and table
      content.querySelector('#flip-order-btn')?.remove();
      content.querySelector('#results-table')?.remove();

      // Parse CSV into objects
      const rows = dataRows.map((line, i) => {
        const [bib, raceTime, finishTime] = line.split(',');
        return { position: i + 1, bib, raceTime, finishTime };
      });
      let descending = true;

      // Create sort toggle button
      const flipBtn = document.createElement('button');
      flipBtn.id = 'flip-order-btn';
      flipBtn.type = 'button';
      flipBtn.textContent = 'Show Ascending';
      flipBtn.classList.add('mb-2', 'px-3', 'py-1', 'rounded', 'focus:outline-none', 'focus:ring');
      downloadBtn.insertAdjacentElement('beforebegin', flipBtn);

      // Build results table header
      const table = document.createElement('table');
      table.id = 'results-table';
      table.innerHTML = `
        <thead>
          <tr>
            <th>Position</th>
            <th>Bib Number</th>
            <th>Race Time</th>
            <th>Finishing Time</th>
          </tr>
        </thead>
      `;
      const tbody = document.createElement('tbody');
      table.appendChild(tbody);
      downloadBtn.insertAdjacentElement('beforebegin', table);

      // Render rows based on sort order
      const renderRows = () => {
        tbody.innerHTML = '';
        const sorted = [...rows].sort((a, b) =>
          descending ? b.position - a.position : a.position - b.position
        );
        for (const { position, bib, raceTime, finishTime } of sorted) {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${position}</td>
            <td>${bib}</td>
            <td>${raceTime}</td>
            <td>${finishTime}</td>
          `;
          tbody.appendChild(tr);
        }
      };

      renderRows();
      // Toggle sort direction on click
      flipBtn.addEventListener('click', () => {
        descending = !descending;
        flipBtn.textContent = descending ? 'Show Ascending' : 'Show Descending';
        renderRows();
      });

      // Reveal results UI
      resultsSection.hidden = false;
      downloadBtn.hidden = false;
    } catch (error) {
      console.error('Display error:', error);
    }
  }

  /**
   * Download the current CSV results as a file.
   */
  async function downloadCSV() {
    try {
      const res = await fetch(`/events/${event.id}/final-report`);
      if (!res.ok) {
        console.error('Download failed');
        return;
      }
      const csv = (await res.text()).trim();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `event-${event.id}-final-report.csv`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
    }
  }

  if (seeResultsBtn) {
    // Disable See Results until report is ready
    seeResultsBtn.disabled = true;
    seeResultsBtn.setAttribute('aria-disabled', 'true');
    seeResultsBtn.classList.add('opacity-50', 'cursor-not-allowed');

    // Show status message
    const statusNote = document.createElement('p');
    statusNote.id = 'results-note';
    statusNote.setAttribute('role', 'status');
    statusNote.textContent = 'Race results will be available once finalized.';
    content.insertAdjacentElement('afterbegin', statusNote);

    // Begin checking for report readiness
    pollInterval = setInterval(checkFinalReport, 5000);
    checkFinalReport();

    // Wire up action buttons
    seeResultsBtn.addEventListener('click', () => {
      showResults();
      if (!refreshInterval) refreshInterval = setInterval(showResults, 30000);
    });
    downloadBtn.addEventListener('click', downloadCSV);
    closeBtn.addEventListener('click', () => {
      // Hide results and reset state
      resultsSection.hidden = true;
      downloadBtn.hidden = true;
      seeResultsBtn.disabled = false;
      seeResultsBtn.removeAttribute('aria-disabled');
      seeResultsBtn.classList.remove('opacity-50', 'cursor-not-allowed');
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      }
    });
  }

  // Configure stopwatch with event data
  const landingSW = content.querySelector('stop-watch');
  if (landingSW) {
    if (event.id != null) landingSW.setAttribute('event-id', event.id);
    if (event.startTime) landingSW.setAttribute('start-time', event.startTime);
  }

  // Handle role selection and load corresponding module
  const enterBtn = content.querySelector('#btn-enter');
  enterBtn.addEventListener('click', () => {
    const selected = document.querySelector("input[name='role']:checked");
    if (!selected) {
      showDialog('Please choose a role first.');
      return;
    }
    content.replaceChildren();
    const role = selected.value;
    switch (role) {
      case 'gate agent':
        import('./GateOrderAgent.mjs').then(mod => mod.initGateOrderAgent(event));
        break;
      case 'volunteer': {
        // Load volunteer page and script
        const volunteerTpl = document.querySelector('#volunteerPage');
        content.replaceChildren(document.importNode(volunteerTpl.content, true));
        const sw = content.querySelector('stop-watch');
        if (sw) {
          if (event.id != null) sw.setAttribute('event-id', event.id);
          if (event.startTime) sw.setAttribute('start-time', event.startTime);
        }
        import('./volunteer.mjs').then(mod => mod.initVolunteer(event));
        break;
      }
      case 'organiser': {
        // Load organiser page and script
        const orgTpl = document.querySelector('#organiserPage');
        content.replaceChildren(document.importNode(orgTpl.content, true));
        const sw = content.querySelector('stop-watch');
        if (sw) {
          if (event.id != null) sw.setAttribute('event-id', event.id);
          if (event.startTime) sw.setAttribute('start-time', event.startTime);
        }
        import('./organiser.mjs').then(mod => mod.initOrganiser(event));
        break;
      }
      default:
        showDialog(`Unknown role: ${role}`);
    }
  });
}
