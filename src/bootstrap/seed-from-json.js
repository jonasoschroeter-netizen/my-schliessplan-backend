'use strict';

const fs = require('fs');
const path = require('path');

const COLLECTIONS_PURGE_ORDER = [
  'api::schliessplan-system-option.schliessplan-system-option',
  'api::zylinder.zylinder',
  'api::objekttyp.objekttyp',
  'api::tueren.tueren',
  'api::anlagentyp.anlagentyp',
  'api::qualitaet.qualitaet',
  'api::technologie.technologie',
  'api::funktionen.funktionen',
  'api::question.question',
];

async function purgeAllContent(strapi) {
  for (const uid of COLLECTIONS_PURGE_ORDER) {
    const pub = await strapi.documents(uid).findMany({ status: 'published' });
    const pubList = Array.isArray(pub) ? pub : [];
    for (const row of pubList) {
      const documentId = row.documentId;
      if (!documentId) continue;
      try {
        await strapi.documents(uid).delete({ documentId });
      } catch (e) {
        strapi.log.warn(`[seed] Konnte ${uid} ${documentId} nicht löschen:`, e.message);
      }
    }
  }
}

const SCHLIESSPLAN_SYSTEM_OPTIONS_UID = 'api::schliessplan-system-option.schliessplan-system-option';

const DEFAULT_SCHLIESSPLAN_SYSTEM_OPTIONS = [
  {
    key: 'mechanisch',
    name: 'Mechanisch',
    color: '#2563eb',
    techType: 'mechanisch',
    sortOrder: 10,
    isActive: true,
    description: 'Mechanische Schliessung mit klassischem Zylinder.',
  },
  {
    key: 'elektronisch',
    name: 'Elektronisch',
    color: '#16a34a',
    techType: 'elektronisch',
    sortOrder: 20,
    isActive: true,
    description: 'Elektronische Schliessung fuer digitale Zutrittssteuerung.',
  },
];

async function ensureSchliessplanSystemOptions(strapi) {
  try {
    const existing = await strapi.documents(SCHLIESSPLAN_SYSTEM_OPTIONS_UID).findMany({
      status: 'published',
    });
    const existingKeys = new Set((Array.isArray(existing) ? existing : []).map((row) => row.key));

    for (const option of DEFAULT_SCHLIESSPLAN_SYSTEM_OPTIONS) {
      if (existingKeys.has(option.key)) continue;

      await strapi.documents(SCHLIESSPLAN_SYSTEM_OPTIONS_UID).create({
        data: option,
        status: 'published',
      });
    }
  } catch (e) {
    strapi.log.warn(`[seed] Schliessplan-Systemoptionen konnten nicht angelegt werden: ${e.message}`);
  }
}

/**
 * Liest seed/inhalt.json (oder seed/inhalt-vorlage.json) und legt veröffentlichte Einträge an,
 * solange noch keine Question-Dokumente existieren – außer STRAPI_FORCE_RESEED=true (dann leeren + neu).
 */
async function seedFromJson(strapi) {
  if (process.env.STRAPI_DISABLE_AUTO_SEED === 'true') {
    return;
  }

  const force = process.env.STRAPI_FORCE_RESEED === 'true';
  if (!force) {
    const existing = await strapi.documents('api::question.question').findMany({ status: 'published' });
    const list = Array.isArray(existing) ? existing : [];
    if (list.length > 0) {
      await ensureSchliessplanSystemOptions(strapi);
      return;
    }
  } else {
    strapi.log.info('[seed] STRAPI_FORCE_RESEED: bestehende Finder-Inhalte werden entfernt …');
    await purgeAllContent(strapi);
  }

  const seedDir = path.join(__dirname, '..', '..', 'seed');
  const primary = path.join(seedDir, 'inhalt.json');
  const fallback = path.join(seedDir, 'inhalt-vorlage.json');
  const file = fs.existsSync(primary) ? primary : fallback;

  if (!fs.existsSync(file)) {
    strapi.log.warn('[seed] Keine Datei seed/inhalt.json oder seed/inhalt-vorlage.json gefunden.');
    return;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    strapi.log.error('[seed] JSON konnte nicht gelesen werden:', e.message);
    return;
  }

  const questions = Array.isArray(data.questions) ? [...data.questions] : [];
  questions.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const questionIds = {};

  for (const q of questions) {
    const doc = await strapi.documents('api::question.question').create({
      data: {
        questionText: q.questionText,
        description: q.description != null ? String(q.description) : ' ',
        questionKey: q.questionKey,
        type: q.type,
        order: q.order,
      },
      status: 'published',
    });
    questionIds[q.questionKey] = doc.documentId;
  }

  const createKeyed = async (uid, rows, keyField, questionKeyField) => {
    const map = {};
    for (const row of rows) {
      const qk = row[questionKeyField];
      const qid = questionIds[qk];
      if (!qid) {
        strapi.log.warn(`[seed] ${uid}: unbekannte questionKey "${qk}" für key "${row[keyField]}"`);
        continue;
      }
      const doc = await strapi.documents(uid).create({
        data: {
          key: row.key,
          name: row.name,
          description: row.description != null ? String(row.description) : null,
          sortOrder: row.sortOrder != null ? row.sortOrder : null,
          question: qid,
        },
        status: 'published',
      });
      map[row[keyField]] = doc.documentId;
    }
    return map;
  };

  const tuerenIds = await createKeyed(
    'api::tueren.tueren',
    data.tuerens || [],
    'key',
    'questionKey'
  );
  const anlagentypIds = await createKeyed(
    'api::anlagentyp.anlagentyp',
    data.anlagentyps || [],
    'key',
    'questionKey'
  );
  const qualitaetIds = await createKeyed(
    'api::qualitaet.qualitaet',
    data.qualitaets || [],
    'key',
    'questionKey'
  );
  const technologieIds = await createKeyed(
    'api::technologie.technologie',
    data.technologies || [],
    'key',
    'questionKey'
  );
  const funktionIds = await createKeyed(
    'api::funktionen.funktionen',
    data.funktionens || [],
    'key',
    'questionKey'
  );

  const objekttypIds = {};
  for (const row of data.objekttyps || []) {
    const qid = questionIds[row.questionKey];
    if (!qid) {
      strapi.log.warn(`[seed] objekttyp: unbekannte questionKey "${row.questionKey}"`);
      continue;
    }
    const tuerenList = (row.tuerenKeys || [])
      .map((k) => tuerenIds[k])
      .filter(Boolean);

    const doc = await strapi.documents('api::objekttyp.objekttyp').create({
      data: {
        key: row.key,
        name: row.name,
        description: row.description != null ? String(row.description) : null,
        sortOrder: row.sortOrder != null ? row.sortOrder : null,
        question: qid,
        tuerens: tuerenList.length ? tuerenList : undefined,
      },
      status: 'published',
    });
    objekttypIds[row.key] = doc.documentId;
  }

  const resolveMany = (keys, map) =>
    (keys || []).map((k) => map[k]).filter(Boolean);

  for (const row of data.zylinders || []) {
    const qid =
      row.questionKey && questionIds[row.questionKey]
        ? questionIds[row.questionKey]
        : null;

    const dataIn = {
      key: row.key,
      name: row.name,
      description: row.description != null ? String(row.description) : null,
      price: row.price != null ? row.price : null,
      objekttyps: resolveMany(row.objekttypKeys, objekttypIds),
      anlagentyps: resolveMany(row.anlagentypKeys, anlagentypIds),
      technologies: resolveMany(row.technologieKeys, technologieIds),
      qualitaets: resolveMany(row.qualitaetKeys, qualitaetIds),
      funktionens: resolveMany(row.funktionKeys, funktionIds),
    };

    if (qid) {
      dataIn.question = qid;
    }

    await strapi.documents('api::zylinder.zylinder').create({
      data: dataIn,
      status: 'published',
    });
  }

  await ensureSchliessplanSystemOptions(strapi);

  strapi.log.info(`[seed] Inhalt aus ${path.basename(file)} eingespielt (veröffentlicht).`);
}

module.exports = { seedFromJson };
