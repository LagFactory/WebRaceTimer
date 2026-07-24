export class Event {
  // Create or load an event via API, returns a promise for this instance
  constructor(opts = {}) {
    return (async () => {
      // If an ID is present, fetch the existing event
      if (opts.id != null) {
        const response = await fetch(`/events/${opts.id}`);
        if (!response.ok) {
          throw new Error(`Event ${opts.id} not found (status ${response.status})`);
        }
        const data = await response.json();
        Object.assign(this, data);
      } else {
        // No ID: build payload to create a new event
        const payload = {
          name: opts.name,
          creator: opts.creator,
          description: opts.description ?? null,
          location: opts.location ?? null,
          startTime: opts.startTime,
          endTime: opts.endTime ?? null,
        };
        // Send creation request
        const response = await fetch('/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error || `Failed to create event (status ${response.status})`);
        }
        Object.assign(this, body);
      }
      return this;
    })();
  }
}
