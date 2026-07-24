import { Event } from './eventObject.mjs';
import { initEventLanding } from './eventLanding.mjs';

/**
 * Load and display the list of events for user selection.
 */
export async function initEventSelection() {
  const content = document.querySelector('#content');
  content.innerHTML = '';
  content.hidden = false; // Show content container

  // Prepare selection template
  const selectionTemplate = document.querySelector('#event-selection-template');
  const selectionClone = selectionTemplate.content.cloneNode(true);
  const listContainer = selectionClone.querySelector('.event-list');
  const errorMsg = selectionClone.querySelector('.error-msg');
  content.appendChild(selectionClone);

  try {
    // Fetch all events from API
    const resp = await fetch('/events');
    if (!resp.ok) {
      throw new Error(`Failed to fetch events (status ${resp.status})`);
    }
    const eventsData = await resp.json();

    // Template for individual event items
    const itemTemplate = document.querySelector('#event-item-template');

    for (const data of eventsData) {
      let evt;
      try {
        evt = await new Event({ id: data.id });
      } catch (err) {
        console.error(`Error loading Event ${data.id}:`, err);
        continue; // Skip items that fail to load
      }

      // Clone item and fill in details
      const itemClone = itemTemplate.content.cloneNode(true);
      const li = itemClone.querySelector('li.event-item');
      li.querySelector('.event-name').textContent = evt.name;

      // Show and hide details section
      const detailsBtn = li.querySelector('button.details-btn');
      const detailsSection = li.querySelector('section.event-details');
      const closeBtn = li.querySelector('button.close-btn');

      detailsBtn.addEventListener('click', () => {
        detailsSection.hidden = false;
        detailsSection.setAttribute('aria-hidden', 'false');
        detailsBtn.setAttribute('aria-expanded', 'true');
      });
      closeBtn.addEventListener('click', () => {
        detailsSection.hidden = true;
        detailsSection.setAttribute('aria-hidden', 'true');
        detailsBtn.setAttribute('aria-expanded', 'false');
      });

      // Display event metadata
      li.querySelector('.event-description').textContent = evt.description || 'No description';
      li.querySelector('.event-location').textContent = evt.location || 'No location';
      const parsed = Date.parse(evt.startTime);
      li.querySelector('.event-start-time').textContent = isNaN(parsed)
        ? 'Invalid date'
        : new Date(parsed).toLocaleString();

      // Handle selection to landing page
      li.querySelector('button.select-btn').addEventListener('click', () => {
        initEventLanding(evt);
      });

      listContainer.appendChild(li);
    }
  } catch (e) {
    console.error('initEventSelection error:', e);
    errorMsg.hidden = false; // Show error message
  }
}
