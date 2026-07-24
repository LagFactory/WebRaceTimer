import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import fastifyPlugin from 'fastify-plugin';

async function dbConnector(fastify, options) {
  const db = await open({
    filename: options.filename,
    driver: sqlite3.Database,
  });

  // create users & events tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      nickname     TEXT,
      email        TEXT    NOT NULL UNIQUE,
      phoneNumber TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      creator    INTEGER NOT NULL,             -- references users.id
      description TEXT,
      location    TEXT,
      startTime  TEXT,  -- ISO 8601
      endTime    TEXT,  -- ISO 8601
      FOREIGN KEY (creator) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS eventRecords (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      volunteerID   INTEGER NOT NULL,           -- references users.id
      eventID       INTEGER NOT NULL,           -- references events.id
      recordsCSV    TEXT    NOT NULL,           -- stored CSV string of timings
      FOREIGN KEY (volunteerID) REFERENCES users(id),
      FOREIGN KEY (eventID)     REFERENCES events(id)
    );

     CREATE TABLE IF NOT EXISTS finalResults (
      eventID          INTEGER PRIMARY KEY,    -- one record per event
      finishingOrder   TEXT    NOT NULL,       -- CSV of finishing order
      finalTimes       TEXT    NOT NULL,       -- CSV of final times
      finalReport      TEXT    NOT NULL,       -- CSV of final report
      FOREIGN KEY (eventID) REFERENCES events(id)
    );
    
  `);

  fastify.decorate('db', db);
}

export default fastifyPlugin(dbConnector);
