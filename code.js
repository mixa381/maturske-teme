const SHEET_ID = "1ZObPQqBQmjDtE5go6SwWmyshRduPvv7qlTNLEQjcKnQ";

function doGet() {
  return HtmlService.createHtmlOutputFromFile("index").setTitle("Maturske teme").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _ss() {
  return SpreadsheetApp.openById(SHEET_ID);
}

function _norm(x) { //norm bukvalno znaci normalizacija imena
  return String(x || "")
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/[–—−]/g, "-")
    .replace(/\s+/g, " ");
}

function _sheet(name) {
  const sh = _ss().getSheetByName(name);
  if (!sh) throw new Error('Ne postoji tab: "' + name + '"');
  return sh;
}

function _findStudent(token) {
  const sh = _sheet("students");
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return null;

  // header
  const h = data[0].map(x => String(x).trim().toLowerCase());
  const cToken = h.indexOf("token");
  const cIme = h.indexOf("ime");
  const cOdelj = h.indexOf("odeljenje");
  const cSmer = h.indexOf("smer");

  if (cToken === -1) throw new Error('U "students" tabu fali kolona "token".');

  const t = _norm(token);

  for (let i = 1; i < data.length; i++) {
    if (_norm(data[i][cToken]) === t) {
      return {
        token: data[i][cToken],
        ime: data[i][cIme],
        odeljenje: data[i][cOdelj],
        smer: data[i][cSmer],
      };
    }
  }
  return null;
}

function login(token) {
  const st = _findStudent(token);
  if (!st) return { ok: false, error: "Погрешан код." };
  return { ok: true, student: { ime: st.ime, odeljenje: st.odeljenje, smer: st.smer } };
}

// lista tema
function listTopics(token) {
  const st = _findStudent(token);
  if (!st) return { ok: false, error: "Нисте улоговани." };

  const topicsSh = _sheet("topics");
  const resSh = _sheet("reservations");

  const topics = topicsSh.getDataRange().getValues();
  if (topics.length < 2) return { ok: true, student: { ime: st.ime, smer: st.smer }, topics: [] };

  const th = topics[0].map(x => String(x).trim().toLowerCase());
  const cId = th.indexOf("topic_id");
  const cNaslov = th.indexOf("naslov");
  const cSmer = th.indexOf("smer");
  const cPredmet = th.indexOf("predmet");

  if (cId === -1 || cNaslov === -1 || cSmer === -1) {
    return { ok: false, error: 'U "topics" tabu fale kolone: topic_id / naslov / smer.' };
  }

  const res = resSh.getDataRange().getValues();
  const taken = {}; // topic_id -> ime

  if (res.length >= 2) {
    const rh = res[0].map(x => String(x).trim().toLowerCase());
    const rTopic = rh.indexOf("topic_id");
    const rIme = rh.indexOf("ime");
    const rOdelj = rh.indexOf("odeljenje");

    if (rTopic !== -1 && rIme !== -1) {
      for (let i = 1; i < res.length; i++) {
        taken[String(res[i][rTopic]).trim()] = {
        ime: String(res[i][rIme]).trim(),
        odeljenje: rOdelj !== -1 ? String(res[i][rOdelj]).trim() : ""
        };

      }
    }
  }

  const out = [];
  for (let i = 1; i < topics.length; i++) {
    const smerTeme = String(topics[i][cSmer]).trim();
    const smerUcenika = String(st.smer).trim().toUpperCase();
    
    if (smerTeme !== smerUcenika && smerTeme !== "A") continue;

    const id = String(topics[i][cId]).trim();
    const uzeo = taken[id] || null;

    out.push({
      topic_id: id,
      naslov: String(topics[i][cNaslov]).trim(),
      predmet: cPredmet !== -1 ? String(topics[i][cPredmet]).trim() : "",
      status: uzeo ? "ЗАУЗЕТО" : "СЛОБОДНО",
      uzeo: uzeo ? uzeo.ime + " (" + uzeo.odeljenje + ")" : null
    });
  }

  return { ok: true, student: { ime: st.ime, smer: st.smer }, topics: out };
}

// ---- rezervacija ----
function reserve(token, topic_id) {
  const st = _findStudent(token);
  if (!st) return { ok: false, error: "Погрешан токен." };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const resSh = _sheet("reservations");
    const data = resSh.getDataRange().getValues();

    if (data.length < 1) return { ok: false, error: "Rezervacije nisu podešene (nema header reda)." };

    const h = data[0].map(x => String(x).trim().toLowerCase());
    const cTopic = h.indexOf("topic_id");
    const cToken = h.indexOf("token");

    if (cTopic === -1 || cToken === -1) {
      return { ok: false, error: 'U "reservations" tabu fale kolone: topic_id / token.' };
    }

    const t = _norm(token);
    const tid = String(topic_id).trim();

    // tema zauzeta?
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][cTopic]).trim() === tid) {
        return { ok: false, error: "Тема је већ заузета." };
      }
    }

    // učenik već ima temu?
    for (let i = 1; i < data.length; i++) {
      if (_norm(data[i][cToken]) === t) {
        return { ok: false, error: "Већ сте изабрали тему." };
      }
    }

    const topicsSh = _sheet("topics");
    const topics = topicsSh.getDataRange().getValues();
    const th = topics[0].map(x => String(x).trim().toLowerCase());

    const cId = th.indexOf("topic_id");
    const cNaslov = th.indexOf("naslov");
    const cPredmet = th.indexOf('predmet');

    let naslov = "";
    let predmet = "";

    for (let i = 1; i < topics.length; i++) {
      if (String(topics[i][cId]).trim() === tid) {
        naslov = String(topics[i][cNaslov]).trim();
        predmet =String(topics[i][cPredmet]).trim();
        break;
      }
    }

    resSh.appendRow([tid, token, predmet, naslov, st.ime,st.odeljenje, new Date()]);
    return { ok: true, message: "Тема је успешно резервисана." };
  } finally {
    lock.releaseLock();
  }
}

function myChoice(token) {
  const st = _findStudent(token);
  if (!st) return { ok: false, error: "Нисте улоговани." };

  const resSh = _sheet("reservations");
  const data = resSh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, topic_id: null };

  const h = data[0].map(x => String(x).trim().toLowerCase());
  const cToken = h.indexOf("token");
  const cTopic = h.indexOf("topic_id");

  if (cToken === -1 || cTopic === -1) return { ok: true, topic_id: null };

  const t = _norm(token);
  for (let i = 1; i < data.length; i++) {
    if (_norm(data[i][cToken]) === t) {
      return { ok: true, topic_id: String(data[i][cTopic]).trim() };
    }
  }
  return { ok: true, topic_id: null };
}

function unreserve(token, topic_id) {
  const st = _findStudent(token);
  if (!st) return { ok: false, error: "Нисте улоговани." };

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const resSh = _sheet("reservations");
    const data = resSh.getDataRange().getValues();
    if (data.length < 2) return { ok: false, error: "Nema rezervacija." };

    const h = data[0].map(x => String(x).trim().toLowerCase());
    const cTopic = h.indexOf("topic_id");
    const cToken = h.indexOf("token");

    if (cTopic === -1 || cToken === -1) {
      return { ok: false, error: 'U "reservations" tabu fale kolone: topic_id / token.' };
    }

    const t = _norm(token);
    const tid = String(topic_id).trim();

    // brišemo samo ako je to stvarno njegova rezervacija
    for (let i = 1; i < data.length; i++) {
      const rowTopic = String(data[i][cTopic]).trim();
      const rowToken = _norm(data[i][cToken]);

      if (rowTopic === tid && rowToken === t) {
        resSh.deleteRow(i + 1);
        return { ok: true, message: "Резервација је поништена." };
      }
    }

    return { ok: false, error: "Не можеш поништити туђу резервацију." };
  } finally {
    lock.releaseLock();
  }
}

function submitRequest(token, tema) {
  const st = _findStudent(token);
  if (!st) return { ok: false, error: "Niste ulogovani." };

  const text = String(tema || "").trim();
  if (!text) return { ok: false, error: "Унесите предлог теме." };

  const reqSh = _sheet("requests");
  reqSh.appendRow([
    st.ime,
    token,
    new Date(),
    text
  ]);

  return { ok: true, message: "Предлог теме је успешно послат." };
}


function generateAllTokens() {

  const sh = _sheet("students");
  const data = sh.getDataRange().getValues();

  const h = data[0].map(x => String(x).trim().toLowerCase());
  const cToken = h.indexOf("token");
  const cOdelj = h.indexOf("odeljenje");

  if (cToken === -1 || cOdelj === -1) {
    throw new Error('Potrebne kolone: token i odeljenje');
  }

  const existing = new Set();

  for (let i = 1; i < data.length; i++) {
    if (data[i][cToken]) existing.add(String(data[i][cToken]).trim());
  }

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const year = "2526";

  for (let i = 1; i < data.length; i++) {

    if (data[i][cToken]) continue;

    let token;

    do {
      let rand = "";
      for (let j = 0; j < 5; j++) {
        rand += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      token = data[i][cOdelj] + "-" + year + "-" + rand;

    } while (existing.has(token));

    existing.add(token);

    sh.getRange(i + 1, cToken + 1).setValue(token);
  }
}