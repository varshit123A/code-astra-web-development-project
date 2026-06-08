/*
  scripts/approve-all-teams.js
  Usage:
    GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json node scripts/approve-all-teams.js

  This will set status='approved' for all documents in the `teams` collection.
  WARNING: use only for development/testing.
*/
const admin = require('firebase-admin');

const BATCH_SIZE = 500;

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON path.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

async function approveAll() {
  console.log('Approving all teams...');
  const teamsRef = db.collection('teams');
  const snapshot = await teamsRef.get();
  const ids = snapshot.docs.map(d => d.id);
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = ids.slice(i, i + BATCH_SIZE);
    chunk.forEach(id => batch.update(teamsRef.doc(id), { status: 'approved' }));
    await batch.commit();
    console.log(`Approved ${chunk.length} teams`);
  }
  console.log('All teams approved.');
}

approveAll().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
