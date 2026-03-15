const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const db = new sqlite3.Database('./data.db', (err) => {
  if (err) {
    console.error(err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Kreiraj tabele
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ime TEXT,
      odeljenje TEXT,
      token TEXT UNIQUE,
      smer TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id TEXT UNIQUE,
      naslov TEXT,
      smer TEXT,
      predmet TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id TEXT,
      token TEXT,
      predmet TEXT,
      naslov TEXT,
      ime TEXT,
      odeljenje TEXT,
      vreme TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ime TEXT,
      token TEXT,
      vreme TEXT,
      tema TEXT
    )
  `);

  // Ucitaj studente
  console.log('Ucitavanje studenta...');
  fs.createReadStream('MaturskeTeme - students.csv')
    .pipe(csv())
    .on('data', (row) => {
      db.run(
        'INSERT OR IGNORE INTO students (ime, odeljenje, token, smer) VALUES (?, ?, ?, ?)',
        [row.ime, row.odeljenje, row.token, row.smer],
        (err) => {
          if (err) console.error(err);
        }
      );
    })
    .on('end', () => {
      console.log('Studenti ucitani.');

      // Ucitaj teme
      console.log('Ucitavanje tema...');
      fs.createReadStream('MaturskeTeme - topics.csv')
        .pipe(csv())
        .on('data', (row) => {
          db.run(
            'INSERT OR IGNORE INTO topics (topic_id, naslov, smer, predmet) VALUES (?, ?, ?, ?)',
            [row.topic_id, row.naslov, row.smer, row.predmet],
            (err) => {
              if (err) console.error(err);
            }
          );
        })
        .on('end', () => {
          console.log('Teme ucitane.');

          // Ucitaj rezervacije
          console.log('Ucitavanje rezervacija...');
          fs.createReadStream('MaturskeTeme - reservations.csv')
            .pipe(csv())
            .on('data', (row) => {
              if (row.topic_id) {
                db.run(
                  'INSERT OR IGNORE INTO reservations (topic_id, token, predmet, naslov, ime, odeljenje, vreme) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [row.topic_id, row.token, row.predmet, row.naslov, row.ime, row.odeljenje, row.vreme],
                  (err) => {
                    if (err) console.error(err);
                  }
                );
              }
            })
            .on('end', () => {
              console.log('Rezervacije ucitane.');

              // Ucitaj zahtjeve (requests)
              console.log('Ucitavanje zahtjeva...');
              fs.createReadStream('MaturskeTeme - requests.csv')
                .pipe(csv())
                .on('data', (row) => {
                  if (row.ime) {
                    db.run(
                      'INSERT OR IGNORE INTO requests (ime, token, vreme, tema) VALUES (?, ?, ?, ?)',
                      [row.ime, row.token, row.vreme, row.tema],
                      (err) => {
                        if (err) console.error(err);
                      }
                    );
                  }
                })
                .on('end', () => {
                  console.log('\n✅ Baza podataka je uspjesno inicijalizirana!');
                  db.close();
                });
            });
        });
    });
});
