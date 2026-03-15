const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));

const db = new sqlite3.Database('./data.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

function norm(x) {
  return String(x || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/–—−/g, '-');
}

function findStudent(token, callback) {
  const t = norm(token);
  db.get(
    'SELECT * FROM students WHERE LOWER(TRIM(token)) = LOWER(?)',
    [t],
    callback
  );
}


app.post('/api/login', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.json({ ok: false, error: 'Pogresno unesan kod.' });
  }

  findStudent(token, (err, student) => {
    if (err) {
      return res.json({ ok: false, error: 'Greska u bazi.' });
    }
    if (!student) {
      return res.json({ ok: false, error: 'Pogresna kod.' });
    }
    res.json({
      ok: true,
      student: {
        ime: student.ime,
        odeljenje: student.odeljenje,
        smer: student.smer
      }
    });
  });
});

app.post('/api/topics', (req, res) => {
  const { token } = req.body;
  
  findStudent(token, (err, student) => {
    if (err || !student) {
      return res.json({ ok: false, error: 'Niste ulogovani.' });
    }

    db.all(
      "SELECT * FROM topics WHERE smer = ? OR smer = 'A'",
      [student.smer],
      (err, topics) => {
        if (err) {
          return res.json({ ok: false, error: 'Greska pri ucitavanju tema.' });
        }

        db.all('SELECT * FROM reservations', (err, reservations) => {
          if (err) {
            return res.json({ ok: false, error: 'Greska pri ucitavanju rezervacija.' });
          }

          const taken = {};
          reservations.forEach(r => {
            taken[r.topic_id] = {
              ime: r.ime,
              odeljenje: r.odeljenje
            };
          });

          const out = topics.map(t => ({
            topic_id: t.topic_id,
            naslov: t.naslov,
            predmet: t.predmet,
            smer: t.smer,
            status: taken[t.topic_id] ? 'ЗАУЗЕТО' : 'СЛОБОДНО',
            uzeo: taken[t.topic_id] ? taken[t.topic_id].ime + ' (' + taken[t.topic_id].odeljenje + ')' : null
          }));

          res.json({
            ok: true,
            student: { ime: student.ime, smer: student.smer },
            topics: out
          });
        });
      }
    );
  });
});

app.post('/api/my-choice', (req, res) => {
  const { token } = req.body;

  findStudent(token, (err, student) => {
    if (err || !student) {
      return res.json({ ok: false, error: 'Niste ulogovani.' });
    }

    db.get(
      'SELECT topic_id FROM reservations WHERE LOWER(TRIM(token)) = LOWER(?)',
      [norm(token)],
      (err, row) => {
        if (err) {
          return res.json({ ok: true, topic_id: null });
        }
        res.json({ ok: true, topic_id: row ? row.topic_id : null });
      }
    );
  });
});

app.post('/api/reserve', (req, res) => {
  const { token, topic_id } = req.body;

  findStudent(token, (err, student) => {
    if (err || !student) {
      return res.json({ ok: false, error: 'Pogresno unesan kod.' });
    }
    db.get(
      'SELECT * FROM reservations WHERE topic_id = ?',
      [topic_id],
      (err, row) => {
        if (row) {
          return res.json({ ok: false, error: 'Tema je vec zauzeta.' });
        }

        db.get(
          'SELECT * FROM reservations WHERE LOWER(TRIM(token)) = LOWER(?)',
          [norm(token)],
          (err, row) => {
            if (row) {
              return res.json({ ok: false, error: 'Vec ste izabrali temu.' });
            }

            db.get(
              'SELECT naslov, predmet FROM topics WHERE topic_id = ?',
              [topic_id],
              (err, topic) => {
                if (!topic) {
                  return res.json({ ok: false, error: 'Tema ne postoji.' });
                }

                db.run(
                  'INSERT INTO reservations (topic_id, token, predmet, naslov, ime, odeljenje, vreme) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [topic_id, token, topic.predmet, topic.naslov, student.ime, student.odeljenje, new Date().toISOString()],
                  (err) => {
                    if (err) {
                      return res.json({ ok: false, error: 'Greska pri rezervaciji.' });
                    }
                    res.json({ ok: true, message: 'Tema je uspesno rezervisana.' });
                  }
                );
              }
            );
          }
        );
      }
    );
  });
});

app.post('/api/unreserve', (req, res) => {
  const { token, topic_id } = req.body;

  findStudent(token, (err, student) => {
    if (err || !student) {
      return res.json({ ok: false, error: 'Niste ulogovani.' });
    }

    db.run(
      'DELETE FROM reservations WHERE topic_id = ? AND LOWER(TRIM(token)) = LOWER(?)',
      [topic_id, norm(token)],
      function(err) {
        if (err) {
          return res.json({ ok: false, error: 'Greska pri brisanju.' });
        }
        if (this.changes === 0) {
          return res.json({ ok: false, error: 'Ne mozes ponistiti tudu rezervaciju.' });
        }
        res.json({ ok: true, message: 'Rezervacija je ponistena.' });
      }
    );
  });
});

app.post('/api/request', (req, res) => {
  const { token, tema } = req.body;

  findStudent(token, (err, student) => {
    if (err || !student) {
      return res.json({ ok: false, error: 'Niste ulogovani.' });
    }

    const text = String(tema || '').trim();
    if (!text) {
      return res.json({ ok: false, error: 'Unesite predlog teme.' });
    }

    db.run(
      'INSERT INTO requests (ime, token, vreme, tema) VALUES (?, ?, ?, ?)',
      [student.ime, token, new Date().toISOString(), text],
      (err) => {
        if (err) {
          return res.json({ ok: false, error: 'Greska pri slanju predloga.' });
        }
        res.json({ ok: true, message: 'Predlog teme je uspesno poslat.' });
      }
    );
  });
});

app.listen(PORT, () => {
  console.log(`Server pokrenuten na http://localhost:${PORT}`);
});
