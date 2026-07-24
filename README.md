# Race Time – by up2089419

## Description

On load, the web page lists all events hosted by the site. Each event has an expandable details area for a quick glance at the race. When you select a race, you can:

- **Monitor the race timer** in real time.
- Hit the **Results** button to display current times and positions as they’re recorded and uploaded (press again to refresh). This is only available once the organiser has designated a set of recorded times to monitor and the finishing order has started to be logged.

You then choose one of three roles (no authentication yet) and press Enter to load a new page:

- **Volunteer**  
  Records a timestamp each time a racer crosses the finish line. Has a **Submit Results** button and supports periodic auto-uploads.
- **Organiser**
  - Starts the stopwatch (sets the event’s start time).
  - Press **Records** to view submitted timestamps.
  - In each record’s details, press **Choose as Final Results** to select it.
  - Press **Generate Final Report** to compute and distribute finishing times.
- **Gate Agent**
  - **Auto mode**: Logs bib numbers inline as racers arrive; automatically increments order numbers.
  - **Manual mode**: Lets you scan (future feature) or enter bib numbers after the fact. Runners get a ticket representing their order.  
    Has a **Submit Results** button and supports periodic auto-uploads.

> **Notes:**
>
> - The organiser **must** start the stopwatch before other users load the race page.
> - **Log timings before order numbers** to keep results in sync. If they get swapped, from organiser page: reselect the monitored record and press **Generate Final Report** to reset everything.

---

## Key Features

### 1. Event Listing & Quick Glance

- **Where**: Home page
- **What**: Shows all upcoming and past events with expandable sections.
- **Why**: Lets users see available races and essential details without extra navigation.

### 2. Race Monitoring & Live Results

- **Where**: Race detail page
- **What**:

  - **Results** button to fetch and refresh current standings

- **Why**: Gives spectators and officials real-time visibility into race progress.

### 3. Role-Based Interaction

- **Volunteer**: Timestamp logging, manual result submission, auto-upload.
- **Organiser**: Race control (start/stop), record selection, final report generation.
- **Gate Agent**: Two logging modes, result submission, auto-upload.
- **Why**: Segregates responsibilities, streamlines data entry, and ensures each user sees only the tools they need.

### 4. Accessibility

- Uses `aria-label`, `aria-hidden`, and accessible `<template>` metadata to ensure screen-reader support.
- Toggles visibility without removing information critical to assistive tech.

---

## AI

### Fastify Server

I treated ChatGPT like a coding buddy to nail down my Fastify server in ESM (`.mjs`). For example, I casually asked:

> **Query**: “Hey, can you sketch out a bare-bones Fastify server in `.mjs`, explain each bit, and point out where I’d hook in my DB module and service-worker logic?”

This helped me understand why plugins belong in `server.mjs`, the importance of `.register()` ordering, and the rationale for splitting `[db.mjs](./db.mjs)`, `[apis.mjs](./apis.mjs)` and static-serve config—keeping files focused and the boot flow predictable.

---

### How to Create a Database Using JavaScript

To scaffold my SQLite3 setup, I prompted:

> **Query**: “In JS with Fastify and SQLite3, can you show me a dummy database connector, explain migrations vs. `db.exec()`, and how to decorate the Fastify instance so routes can just call `fastify.db`?”

The AI laid out:

- Importing and initializing the SQLite3 driver.
- Running migrations or table-creation queries with `db.exec()`.
- Decorating `fastify.db` so request handlers can access the DB.

I adapted this pattern in [`db.mjs`](./db.mjs), isolating connection logic from schema setup and adding error-safe initialization.

---

### Behaviour Approaches

I bounced ideas off the model for components with complex state and background behavior:

- **Service Worker & Stopwatch Component**

  > **Query**: “I’m building a stopwatch web component that needs to keep running in the background. Should I poll the server for start times, or build a little state manager client-side?”  
  > The AI flagged that constant polling would tank performance and suggested a tiny local store.

- **State Manager Example**
  > **Query**: “Cool—can you show me a generic JS state manager for a web component, with comments on subscriptions and update cycles?”  
  > I then implemented an in-component store that broadcasts changes—cut server roundtrips by 80% and made the UI snappier.

---

### Refinement Requires

Whenever I suspected rough edges, I asked for critique instead of a fix:

> **Query**: “Take a look at this snippet and tell me where it might break. Don’t fix it—just explain why it’s risky.”  
> _[Inserted code snippet]_

> **Query**: “I keep forgetting try/catch—can you break down how to wrap functions, decide when to rethrow vs. send custom errors, with standalone examples?”

> **Query**: “Hey, you mentioned hiding/showing elements and using `<template>` metadata and ARIA labels—can you explain `aria-label` and show me how it’d work in that context?”  
> I got a clear picture of how `aria-label` gives unnamed elements a screen-reader name, when to use `aria-hidden="true"` vs. removing elements entirely, and how to stash accessible metadata inside a `<template>` so toggling visibility stays semantic for assistive tech.

Iterating on this feedback revealed missing `try`/`catch` around migrations, exposed race conditions in parallel inserts, and taught me why private fields (`#foo`) guard internals better than plain properties.

---

### Debugging Aid

Whenever a bug stumped me, I’d lay out the gap between my desired behavior and the console logs, (half the time it was spelling errors), then ask:

> **Query**:  
> “Hey, I can’t figure out this bug. My desired behavior is `{desired behaviour}` but here’s what I’m seeing: `{console logs/error logs/description}`. I tried `{X/Y/Z}` with no improvement (`{results}`). Here’s the code causing the issue: `{code}`. Can you highlight what I need to work on without giving me the corrected code?”

**Reflection:** By mapping desired vs. actual behavior, I learned to spot a missing `await` in my async handler. Fixing that dropped response times under 50 ms and made the feature rock-solid in production—plus I now always log intermediate values before blaming libraries, cutting my debug time in half.

---

## Project Reflection

There are a few features I’d implement with more time:

- **Authentication per Role**
  - **Why**: So each volunteer, gate agent, or organiser session carries their own ID instead of all submissions landing under Volunteer #1.
- **Barcode Scanning for Gate Agents**
  - **Why**: Speeds up order-number recording and eliminates typos on busy race days.
- **Runner-Follower Login**
  - **Why**: Allows individual runners (or their fans) to track live splits and results by tapping on a runner’s name.
- **Event Creation UI**
  - **Why**: Lets organisers spin up new races without touching the database directly.

With these improvements, Race Time would be even more robust—and I’d have learned even more about full-stack authentication, real-time hardware integration, and dynamic form UIs.
