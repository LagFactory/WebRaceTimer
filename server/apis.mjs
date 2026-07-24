// apis.mjs
// Defines API routes for users, events, and event records
export default function apis(fastify) {
  // Retrieve a user by ID
  fastify.get('/users/:id', async (request, reply) => {
    const { id } = request.params;
    const user = await fastify.db.get(
      `SELECT id,
              name,
              nickname,
              email,
              phoneNumber
         FROM users
        WHERE id = ?`,
      [id],
    );
    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }
    return reply.send(user);
  });

  // Create a new user (email must be unique)
  fastify.post('/users', async (request, reply) => {
    const { name, nickname = null, email, phoneNumber = null } = request.body;
    try {
      const result = await fastify.db.run(
        `INSERT INTO users (name, nickname, email, phoneNumber)
         VALUES (?,      ?,        ?,     ?)`,
        [name, nickname, email, phoneNumber],
      );
      const newUser = await fastify.db.get(
        `SELECT id,
                name,
                nickname,
                email,
                phoneNumber
           FROM users
          WHERE id = ?`,
        [result.lastID],
      );
      return reply.code(201).send(newUser);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('users.email')) {
        return reply.code(400).send({ error: 'Email already exists' });
      }
      throw err;
    }
  });

  // List all events
  fastify.get('/events', async (request, reply) => {
    const events = await fastify.db.all(
      `SELECT id,
              name,
              creator,
              description,
              location,
              startTime,
              endTime
         FROM events`,
    );
    return reply.send(events);
  });

  // Retrieve an event by ID
  fastify.get('/events/:id', async (request, reply) => {
    const { id } = request.params;
    const event = await fastify.db.get(
      `SELECT id,
              name,
              creator,
              description,
              location,
              startTime,
              endTime
         FROM events
        WHERE id = ?`,
      [id],
    );
    if (!event) {
      return reply.code(404).send({ error: 'Event not found' });
    }
    return reply.send(event);
  });

  // Create a new event
  fastify.post('/events', async (request, reply) => {
    const { name, creator, description = null, location = null, startTime = null, endTime = null } = request.body;
    try {
      const result = await fastify.db.run(
        `INSERT INTO events (name, creator, description, location, startTime, endTime)
         VALUES (?,    ?,       ?,           ?,        ?,        ?)`,
        [name, creator, description, location, startTime, endTime],
      );
      const newEvent = await fastify.db.get(
        `SELECT id,
                name,
                creator,
                description,
                location,
                startTime,
                endTime
           FROM events
          WHERE id = ?`,
        [result.lastID],
      );
      return reply.code(201).send(newEvent);
    } catch (err) {
      if (err.code === 'SQLITE_CONSTRAINT' && err.message.includes('FOREIGN KEY constraint failed')) {
        return reply.code(400).send({ error: 'Invalid creator user ID' });
      }
      throw err;
    }
  });

  // Patch: set startTime on an event if it's not already set
  fastify.patch('/events/:id/start', async (request, reply) => {
    const { id } = request.params;
    const event = await fastify.db.get(
      `SELECT startTime
         FROM events
        WHERE id = ?`,
      [id],
    );
    if (!event) {
      return reply.code(404).send({ error: 'Event not found' });
    }
    if (event.startTime) {
      return reply.code(400).send({ error: 'Start time already set' });
    }
    const now = new Date().toISOString();
    await fastify.db.run(
      `UPDATE events
          SET startTime = ?
        WHERE id = ?`,
      [now, id],
    );
    const updated = await fastify.db.get(
      `SELECT id,
              name,
              creator,
              description,
              location,
              startTime
              endTime
         FROM events
        WHERE id = ?`,
      [id],
    );
    return reply.send(updated);
  });

  // Upload or overwrite a CSV payload to eventRecords; optional volunteerId in body (default = 1)
  fastify.post('/events/:id/records', async (request, reply) => {
    const { id: eventId } = request.params;
    const { csv, volunteerId: rawVolunteerId } = request.body;

    if (!csv) {
    // Client must send CSV data
      return reply.code(400).send({ error: 'CSV data required' });
    }

    // Parse and validate volunteerId, defaulting to 1
    const volunteerId = rawVolunteerId == null
      ? 1
      : Number(rawVolunteerId);

    if (!Number.isInteger(volunteerId) || volunteerId < 1) {
    // volunteerId must be a positive integer
      return reply.code(400).send({ error: 'Invalid volunteerId; must be a positive integer' });
    }

    try {
    // 1. Try updating an existing record for this volunteer/event
      const updateResult = await fastify.db.run(
      `UPDATE eventRecords
          SET recordsCSV = ?
        WHERE volunteerID = ? AND eventID = ?`,
      [csv, volunteerId, eventId],
      );

      if (updateResult.changes > 0) {
      // Overwrite succeeded – fetch and return the updated row
        const updated = await fastify.db.get(
        `SELECT id, volunteerID, eventID, recordsCSV
           FROM eventRecords
          WHERE volunteerID = ? AND eventID = ?`,
        [volunteerId, eventId],
        );
        return reply.code(200).send(updated);
      }

      // 2. No existing row – insert a brand-new record
      const insertResult = await fastify.db.run(
      `INSERT INTO eventRecords (volunteerID, eventID, recordsCSV)
       VALUES (?, ?, ?)`,
      [volunteerId, eventId, csv],
      );
      const created = await fastify.db.get(
      `SELECT id, volunteerID, eventID, recordsCSV
         FROM eventRecords
        WHERE id = ?`,
      [insertResult.lastID],
      );
      return reply.code(201).send(created);
    } catch (err) {
    // Handle invalid event or volunteer foreign-key errors
      if (err.code === 'SQLITE_CONSTRAINT') {
        return reply.code(400).send({ error: 'Invalid event or volunteer ID' });
      }
      // Unhandled errors bubble up to Fastify’s global handler
      throw err;
    }
  });

  fastify.get('/events/:id/records/:volunteerId', async (request, reply) => {
    const { id, volunteerId } = request.params;
    const rec = await fastify.db.get(
      `SELECT recordsCSV
         FROM eventRecords
        WHERE eventID = ?
          AND volunteerID = ?`,
      [id, volunteerId],
    );
    if (!rec) {
      return reply.code(404).send({ error: 'Records not found for specified event and volunteer' });
    }
    return reply.send({ csv: rec.recordsCSV });
  });

  /**
 * Get every volunteer’s CSV records for a single event.
 * @route GET /events/:id/records
 * @param {string} request.params.id    The event’s database ID
 * @returns {200} { records: Array<{ volunteerId: number, csv: string }> }
 * @returns {404} { error: string }     If no records found
 */

  fastify.get('/events/:id/records', async (request, reply) => {
    const { id } = request.params;

    // Fetch all matching rows from eventRecords
    const rows = await fastify.db.all(
    `SELECT volunteerID, recordsCSV
       FROM eventRecords
      WHERE eventID = ?`,
    [id],
    );

    if (!rows || rows.length === 0) {
    // No rows → 404
      return reply
        .code(404)
        .send({ error: 'No records found for specified event' });
    }

    // Map DB columns to a cleaner JSON shape
    const records = rows.map(r => ({
      volunteerId: r.volunteerID,
      csv: r.recordsCSV,
    }));

    return reply.send({ records });
  });


  // Update or insert finishingOrder for an event
  fastify.put('/events/:id/final-results', async (request, reply) => {
    const { id } = request.params;
    const { finishingOrder } = request.body;

    if (typeof finishingOrder !== 'string') {
      return reply.code(400).send({ error: 'finishingOrder must be a CSV string' });
    }

    try {
    // Insert new or update existing row
      await fastify.db.run(
      `INSERT INTO finalResults (eventID, finishingOrder, finalTimes, finalReport)
       VALUES (?, ?, '', '')
       ON CONFLICT(eventID) DO UPDATE
         SET finishingOrder = excluded.finishingOrder;`,
      [id, finishingOrder],
      );
      return reply.code(200).send({ eventId: id, finishingOrder });
    } catch (err) {
    // Handle missing event FK or other DB issues
      return reply.code(500).send({ error: 'Database error', details: err.message });
    }
  });

  // Update or insert finishingTimes for an event
  fastify.put('/events/:id/final-times', async (request, reply) => {
    const { id } = request.params;
    const { finishingTimes } = request.body;
    if (typeof finishingTimes !== 'string') {
      return reply.code(400).send({ error: 'finishingTimes must be a CSV string' });
    }
    try {
      await fastify.db.run(
        `INSERT INTO finalResults (eventID, finishingOrder, finalTimes, finalReport)
         VALUES (?, '', ?, '')
         ON CONFLICT(eventID) DO UPDATE
           SET finalTimes = excluded.finalTimes;`,
        [id, finishingTimes],
      );
      return reply.code(200).send({ eventId: id, finishingTimes });
    } catch (err) {
      return reply.code(500).send({ error: 'Database error', details: err.message });
    }
  });

  // Update or insert finalreport for an event
  fastify.put('/events/:id/final-report', async (request, reply) => {
    const { id } = request.params;
    const { finalReport } = request.body;

    // Validate request body
    if (typeof finalReport !== 'string') {
      return reply
        .code(400)
        .send({ error: 'finalReport must be a CSV string' });
    }

    try {
    // Insert new row or update existing one on conflict
      await fastify.db.run(
      `
      INSERT INTO finalResults (
        eventID,
        finishingOrder,
        finalTimes,
        finalReport
      )
      VALUES (?, '', '', ?)
      ON CONFLICT(eventID) DO UPDATE
        SET finalReport = excluded.finalReport
      ;
      `,
      [id, finalReport],
      );

      // Respond with the saved report
      return reply
        .code(200)
        .send({ eventId: id, finalReport });
    } catch (err) {
    // Handle FK constraint failures or other SQL errors
      request.log.error(err);
      return reply
        .code(500)
        .send({ error: 'Database error saving final report', details: err.message });
    }
  });

  fastify.get('/events/:id/final-report', async (request, reply) => {
    const { id } = request.params;

    // Fetch the stored CSV string
    const row = await fastify.db.get(
      `SELECT finalReport
         FROM finalResults
        WHERE eventID = ?`,
      [id],
    );

    // Not yet created or still empty → keep client polling
    if (!row || !row.finalReport) {
      return reply
        .code(404)
        .send({ error: 'Final report not available yet' });
    }

    // Return raw CSV with correct Content-Type
    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .send(row.finalReport);
  });

  fastify.get('/events/:id/final-results', async (request, reply) => {
    const { id } = request.params;
    const result = await fastify.db.get(
      `SELECT finishingOrder, finalTimes
         FROM finalResults
        WHERE eventID = ?`,
      [id],
    );

    if (!result) {
      return reply.code(404).send({ error: 'Final results not found for specified event' });
    }

    return reply.send({
      eventId: id,
      finishingOrder: result.finishingOrder,
      finalTimes: result.finalTimes,
    });
  });

  // Returns only the CSV finishing order for a given event
  fastify.get('/events/:id/finishing-order', async (request, reply) => {
    const { id } = request.params;

    try {
    // Query the existing table/column names
      const row = await fastify.db.get(
      `SELECT finishingOrder
         FROM finalResults
        WHERE eventID = ?`,
      [id],
      );

      if (!row) {
        return reply
          .code(404)
          .send({ error: 'Finishing order not found for specified event' });
      }

      return reply.send({
        eventId: id,
        finishingOrder: row.finishingOrder,
      });
    } catch (err) {
    // Log full error for debugging
      request.log.error(err);
      return reply
        .code(500)
        .send({ error: 'Server error fetching finishing order' });
    }
  });
}
