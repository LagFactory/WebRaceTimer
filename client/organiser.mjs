import './stopwatch.mjs';
import { initEventLanding } from './eventLanding.mjs';

// Tracks volunteer ID for CSV downloads (overridden by “Choose”)
let GLOBAL_VOLUNTEER_ID = 1;
let lastCsv = '';
let timesUploadInterval = null;
let currentCsv = '';

// Send final times CSV to server for the event
async function uploadFinalTimes(eventId, csv) {
  try {
    const res = await fetch(`/events/${eventId}/final-times`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ finishingTimes: csv }),
    });
    const data = await res.json();
    if (!res.ok) console.error('Upload error:', data.error);
    else showDialog('Final times updated automatically.');
  } catch (err) {
    console.error('Network error uploading final times:', err);
  }
}

// Fetch volunteer CSV; upload if it changed since last fetch
async function downloadTimesCsv(eventId) {
  try {
    const res = await fetch(`/events/${eventId}/records/${GLOBAL_VOLUNTEER_ID}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Fetch error');

    const csvData = data.csv;
    if (csvData && csvData !== lastCsv) {
      await uploadFinalTimes(eventId, csvData);
      lastCsv = csvData;
    }
    return csvData;
  } catch (err) {
    console.error('Error downloading times CSV:', err);
    return '';
  }
}

// Show a non-blocking dialog with a message
function showDialog(message) {
  let dlg = document.querySelector('dialog#modal-dialog');
  if (!dlg) {
    dlg = document.createElement('dialog');
    dlg.id = 'modal-dialog';
    dlg.innerHTML = `
      <p class="dialog-message"></p>
      <menu><button id="dialog-ok" type="button">OK</button></menu>
    `;
    document.body.appendChild(dlg);
    dlg.querySelector('#dialog-ok').addEventListener('click', () => dlg.close());
  }
  dlg.querySelector('.dialog-message').textContent = message;
  dlg.showModal();
}

// Start periodic CSV fetch and upload every 5 seconds
function startAutoUpload(eventId) {
  clearInterval(timesUploadInterval);
  timesUploadInterval = setInterval(async () => {
    try {
      const res = await fetch(`/events/${eventId}/records/${GLOBAL_VOLUNTEER_ID}`);
      const data = await res.json();
      if (!res.ok) return;

      const newCsv = data.csv;
      if (newCsv && newCsv !== lastCsv) {
        await uploadFinalTimes(eventId, newCsv);
        lastCsv = newCsv;
        currentCsv = newCsv;
      }
    } catch (e) {
      console.error('Auto-upload error:', e);
    }
  }, 5000);
}

/**
 * Set up organiser dashboard: record fetching, details view, and uploads
 * @param {{ id?: number, startTime?: string }} event
 */
export function initOrganiser(event = {}) {
  const content = document.querySelector('#content');
  content.innerHTML = '';
  content.removeAttribute('hidden');
  const tpl = document.querySelector('#organiserPage');
  content.appendChild(document.importNode(tpl.content, true));

  // On load, fetch and upload initial CSV
  if (event.id) downloadTimesCsv(event.id);

  // Configure stopwatch
  const dashSW = content.querySelector('stop-watch');
  if (event.id != null) dashSW.setAttribute('event-id', event.id);
  if (event.startTime) dashSW.setAttribute('start-time', event.startTime);

  // UI element refs
  const backBtn = content.querySelector('.back-btn');
  const recordsBtn = content.querySelector('.records-btn');
  const createReportBtn = content.querySelector('.create-report-btn');
  const recordsSection = content.querySelector('.records-section');
  const recordsList = content.querySelector('.records-list');
  const detailSection = content.querySelector('.record-detail-section');
  const csvPreview = detailSection.querySelector('.csv-preview');
  const closeDetailBtn = detailSection.querySelector('.close-detail-btn');
  const chooseBtn = detailSection.querySelector('.choose-btn');

  let recordsInterval = null;
  let reportInterval = null;
  let currentVolunteerId = GLOBAL_VOLUNTEER_ID;

  // Fetch and display list of volunteer records
  async function fetchRecords() {
    if (!event.id) return console.error('Missing event ID');
    try {
      const res = await fetch(`/events/${event.id}/records`);
      const data = await res.json();
      recordsList.innerHTML = '';

      const items = (res.ok && data.records?.length)
        ? data.records
        : [];

      if (!items.length) {
        const msg = data.error || 'No records found.';
        recordsList.innerHTML = `<li>${msg}</li>`;
      } else {
        items.forEach(({ volunteerId, csv }) => {
          const lines = csv.split(/\r?\n/).filter(l => l.trim()).length;
          const li = document.createElement('li');
          li.innerHTML = `Volunteer ${volunteerId} — ${lines} lines`;

          const detailsBtn = document.createElement('button');
          detailsBtn.type = 'button';
          detailsBtn.textContent = 'Details';
          detailsBtn.addEventListener('click', async () => {
            currentVolunteerId = volunteerId;
            const csvData = await downloadTimesCsv(event.id);
            if (!csvData) return showDialog('Failed to load CSV.');
            currentCsv = csvData;
            csvPreview.textContent = csvData;
            recordsSection.hidden = true;
            detailSection.hidden = false;
          });

          li.appendChild(detailsBtn);
          recordsList.appendChild(li);
        });
      }

      recordsSection.hidden = false;
      detailSection.hidden = true;
    } catch (err) {
      console.error('Error fetching records:', err);
      recordsList.innerHTML = '<li>Failed to load records.</li>';
    }
  }

  // Show and refresh record list every second
  recordsBtn.addEventListener('click', () => {
    fetchRecords();
    clearInterval(recordsInterval);
    recordsInterval = setInterval(fetchRecords, 1000);
    recordsSection.scrollIntoView({ behavior: 'smooth' });
  });

  // Return from detail view to list
  closeDetailBtn.addEventListener('click', () => {
    detailSection.hidden = true;
    recordsSection.hidden = false;
  });

  // Set chosen volunteer and start auto-upload
  chooseBtn.addEventListener('click', () => {
    GLOBAL_VOLUNTEER_ID = currentVolunteerId;
    detailSection.hidden = true;
    recordsSection.hidden = false;
    showDialog(`Volunteer ${GLOBAL_VOLUNTEER_ID} selected.`);
    startAutoUpload(event.id);
  });

  // Create and upload merged final report CSV
  async function processFinalReport({ showDialogOnSuccess = false } = {}) {
    if (!event.id) return console.error('Missing event ID');
    try {
      const res = await fetch(`/events/${event.id}/final-results`);
      const data = await res.json();
      if (!res.ok) return console.error('Fetch error:', data.error);

      const bibs = (Array.isArray(data.finishingOrder)
        ? data.finishingOrder
        : data.finishingOrder.split(',').map(s => s.trim()))
        .filter(Boolean);

      const entries = data.finalTimes.trim().split(/\r?\n/).slice(1)
        .map(line => {
          const m = line.match(/Device:\s*(.+?)\s*\|\s*Stopwatch:\s*(.+)/);
          return m && { deviceTime: m[1].trim(), stopwatchTime: m[2].trim() };
        }).filter(Boolean);

      const toMs = t => {
        const m = t.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
        return m
          ? +m[1]*3600000 + +m[2]*60000 + +m[3]*1000 + +m[4]
          : 0;
      };
      entries.sort((a, b) => toMs(a.stopwatchTime) - toMs(b.stopwatchTime));

      const header = 'bibNumber,raceTime,finishingTime';
      const rows = bibs.map((bib, i) => {
        const e = entries[i];
        return e ? `${bib},${e.stopwatchTime},${e.deviceTime}` : null;
      }).filter(Boolean);
      const mergedCsv = [header, ...rows].join('\n');

      const putRes = await fetch(`/events/${event.id}/final-report`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finalReport: mergedCsv }),
      });
      const putData = await putRes.json();
      if (!putRes.ok) console.error('Save error:', putData.error);
      else if (showDialogOnSuccess) showDialog('Final report saved.');
    } catch (e) {
      console.error('Error processing final report:', e);
    }
  }

  // Manual report generation
  createReportBtn.addEventListener('click', () => {
    processFinalReport({ showDialogOnSuccess: true });
  });

  // Auto-generate final report every 10 seconds
  reportInterval = setInterval(() => processFinalReport(), 10000);

  // Clean up and return to landing page
  backBtn.addEventListener('click', () => {
    clearInterval(recordsInterval);
    clearInterval(reportInterval);
    clearInterval(timesUploadInterval);
    initEventLanding(event);
  });
}
