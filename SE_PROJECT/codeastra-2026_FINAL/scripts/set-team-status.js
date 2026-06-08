/*
  scripts/set-team-status.js
  Usage:
    # Set missing statuses to 'pending' (default)
    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/set-team-status.js

    # Set missing statuses to 'approved'
    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json STATUS=approved node scripts/set-team-status.js

  WARNING: destructive for the `status` field only. Use on dev/test projects.
*/
const admin = require('firebase-admin');

const STATUS_TO_SET = process.env.STATUS || 'pending';
const BATCH_SIZE = 500;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function updateMissingStatuses() {
  console.log('Scanning teams collection for missing status fields...');
  const teamsRef = db.collection('teams');
  const snapshot = await teamsRef.get();
  const toUpdate = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (!('status' in data) || data.status === undefined || data.status === null || data.status === '') {
      toUpdate.push({ id: doc.id });
    }
  });

  console.log(`Found ${toUpdate.length} team(s) missing status.`);
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    chunk.forEach(item => {
      const ref = teamsRef.doc(item.id);
      batch.update(ref, { status: STATUS_TO_SET });
    });
    await batch.commit();
    console.log(`Updated ${chunk.length} teams to status='${STATUS_TO_SET}'.`);
  }

  console.log('Done.');
}

updateMissingStatuses().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
