// index.mjs
// Boot event-selection logic and seed initial data
import { initEventSelection } from './eventSelectionScreen.mjs';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
 
    navigator.serviceWorker
      .register('/sw.mjs', { scope: '/' })
      .then(reg => console.log('SW registered with scope:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

// eslint-disable-next-line no-unused-vars
async function seedData() {
  // 10 sample users
  const userPayloads = Array.from({ length: 10 }).map((_, i) => ({
    name: `User ${i + 1}`,
    nickname: `user${i + 1}`,
    email: `user${i + 1}@example.com`,
    phoneNumber: `+4407000000${String(i).padStart(2, '0')}`,
  }));

  const createdUsers = [];
  for (const payload of userPayloads) {
    try {
      const res = await fetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to create ${payload.email}`);
      const user = await res.json();
      createdUsers.push(user);
      console.log('Created user:', user);
    } catch (err) {
      console.warn(err);
    }
  }

  // 4 sample events, each with a different creator
  const eventPayloads = [
    {
      name: '5K Fun Run',
      creator: createdUsers[0]?.id,
      description: 'Short city run',
      location: 'City Park',
      startTime: '2025-05-13T14:30:00Z',
      endTime: null,
    },
    {
      name: '10K Challenge',
      creator: createdUsers[1]?.id,
      description: 'Hilly countryside',
      location: 'Green Valley',
      startTime: null,
      endTime: null,
    },
    {
      name: 'Half Marathon',
      creator: createdUsers[2]?.id,
      description: 'Semi-urban course',
      location: 'River Side',
      startTime: null,
      endTime: null,
    },
    {
      name: 'Ultra Marathon',
      creator: createdUsers[3]?.id,
      description: '24-hour endurance',
      location: 'Desert Track',
      startTime: null,
      endTime: null,
    },
  ];

  for (const payload of eventPayloads) {
    if (!payload.creator) continue;
    try {
      const res = await fetch('/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Failed to create event ${payload.name}`);
      const event = await res.json();
      console.log('Created event:', event);
    } catch (err) {
      console.warn(err);
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // await seedData(); // uncomment this line before running npm start if no database file exists
  initEventSelection();
});
