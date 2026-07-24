import { initEventLanding } from './eventLanding.mjs';

// Show a non-blocking modal dialog with a message
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

// Initialize Gate Order Agent UI and behaviors
export function initGateOrderAgent(eventParam) {
  // Determine event ID
  const eventId = typeof eventParam === 'object' ? eventParam.id : eventParam;
  if (!eventId) {
    console.error('Missing eventId for GateOrderAgent:', eventParam);
    return;
  }

  const content = document.querySelector('#content');
  content.hidden = false;
  content.innerHTML = '';

  // Load page template
  const tpl = document.querySelector('#gate-order-agent-page-template');
  content.appendChild(document.importNode(tpl.content, true));

  // Handle back navigation
  const backBtn = content.querySelector('.back-btn');
  backBtn?.addEventListener('click', () => {
    const ev = typeof eventParam === 'object' ? eventParam : { id: eventId };
    initEventLanding(ev);
  });

  // Form state and elements
  const entries = [];
  const form = content.querySelector('#gate-order-form');
  const bibInput = form.querySelector('#bib-number');
  const orderInput = form.querySelector('#order-number');
  const autoCheckbox = form.querySelector('#auto-order');
  const listEl = content.querySelector('#order-list');

  // Update the displayed list of entries
  const renderList = () => {
    listEl.innerHTML = '';
    entries
      .sort((a, b) => b.order - a.order)
      .forEach(item => {
        const li = document.createElement('li');
        li.textContent = `Order ${item.order}: Bib ${item.bib}`;
        listEl.appendChild(li);
      });
  };

  // Build CSV string from entries in chronological order
  const buildCsvFromListReverse = () =>
    entries
      .slice()
      .sort((a, b) => b.order - a.order)
      .reverse()
      .map(item => item.bib)
      .join(',');

  // Get next automatic order number
  const getNextOrder = () =>
    entries.length === 0 ? 1 : Math.max(...entries.map(e => e.order)) + 1;

  // Load existing finishing order from server
  let lastUploadedCsv = null;
  (async () => {
    try {
      const resp = await fetch(`/events/${eventId}/finishing-order`);
      if (!resp.ok) {
        if (resp.status !== 404) console.warn('Unexpected status:', resp.status);
        return;
      }
      const data = await resp.json();
      if (!data.finishingOrder) return;

      data.finishingOrder
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .forEach((bib, idx) => entries.push({ bib, order: idx + 1 }));

      lastUploadedCsv = data.finishingOrder;
      renderList();
    } catch (err) {
      console.error('Error loading finishing order:', err);
    }
  })();

  // Auto-order checkbox behavior
  if (autoCheckbox.checked) {
    orderInput.value = getNextOrder();
    orderInput.disabled = true;
  }
  autoCheckbox.addEventListener('change', () => {
    if (autoCheckbox.checked) {
      orderInput.value = getNextOrder();
      orderInput.disabled = true;
    } else {
      orderInput.disabled = false;
      orderInput.value = '';
      bibInput.focus();
    }
  });

  // Handle new entry submissions
  form.addEventListener('submit', evt => {
    evt.preventDefault();
    const bib = bibInput.value.trim();
    const order = autoCheckbox.checked
      ? getNextOrder()
      : parseInt(orderInput.value.trim(), 10);

    // Validate inputs
    if (!bib || Number.isNaN(order)) {
      showDialog('Enter valid bib number and order number.');
      return;
    }
    if (entries.some(e => e.bib === bib)) {
      showDialog(`Bib ${bib} already added.`);
      return;
    }
    if (entries.some(e => e.order === order)) {
      showDialog(`Order ${order} already used.`);
      return;
    }

    // Add entry and refresh list
    entries.push({ bib, order });
    renderList();

    // Reset inputs
    bibInput.value = '';
    if (autoCheckbox.checked) {
      orderInput.value = getNextOrder();
    } else {
      orderInput.value = '';
    }
    bibInput.focus();
  });

  // Periodic upload of results
  const uploadIntervalMs = 30 * 100; // 5-minute interval
  setInterval(async () => {
    if (entries.length === 0) return;
    const currentCsv = buildCsvFromListReverse();
    if (currentCsv === lastUploadedCsv) return;

    console.log(`Uploading finishingOrder ${currentCsv}`);
    try {
      const resp = await fetch(`/events/${eventId}/final-results`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finishingOrder: currentCsv }),
      });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      lastUploadedCsv = currentCsv;
      console.info('Auto-upload successful.');
    } catch (err) {
      console.error('Auto-upload failed:', err);
    }
  }, uploadIntervalMs);

  // Manual submit button logic
  const submitBtn = content.querySelector('#submit-results') || (() => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'submit-results';
    btn.textContent = 'Submit Results';
    form.appendChild(btn);
    return btn;
  })();

  submitBtn.addEventListener('click', async () => {
    if (entries.length === 0) {
      showDialog('No results to submit.');
      return;
    }
    const finishingCsv = buildCsvFromListReverse();
    console.log(`Manual upload CSV: ${finishingCsv}`);
    try {
      const resp = await fetch(`/events/${eventId}/final-results`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finishingOrder: finishingCsv }),
      });
      if (!resp.ok) throw new Error(`Status ${resp.status}`);
      lastUploadedCsv = finishingCsv;
      showDialog('Results submitted successfully.');
    } catch (err) {
      console.error('Submit failed:', err);
      showDialog('Submission failed. Please try again later.');
    }
  });
}
