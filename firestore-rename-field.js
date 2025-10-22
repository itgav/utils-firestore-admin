// migrate.js

// 1. Import the Firebase Admin SDK
const admin = require('firebase-admin');

// 2. Import your private service account key
const serviceAccount = require('./secrets/firestoreServiceAccountKey.json');

// --- ⚙️ CONFIGURATION ---
// Set your migration parameters here
const config = {
  collection: 'photos',    // The name of the collection to migrate
  oldFieldName: 'createdAt',     // The field name you want to rename
  newFieldName: 'uploadedAt',    // The new field name
  batchSize: 400             // Number of docs to update at once (max 500)
};
// ------------------------

// 3. Initialize the Firebase Admin App
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 4. Get a reference to your Firestore database
const db = admin.firestore();

// This is an async function, which lets us use 'await'
// to handle asynchronous operations cleanly.
async function migrateData() {
  console.log(`Starting migration for collection "${config.collection}"...`);
  console.log(`Renaming field "${config.oldFieldName}" to "${config.newFieldName}".`);

  // 5. Define the collection we want to migrate
  const collectionRef = db.collection(config.collection);
  
  // 6. Define the query
  // We only want documents WHERE the 'oldFieldName' exists
  const query = collectionRef.where(config.oldFieldName, '!=', null);

  try {
    let processedDocs = 0;
    
    // 7. Get the documents that match our query
    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log(`No documents found with the "${config.oldFieldName}" field. Nothing to migrate.`);
      return;
    }

    console.log(`Found ${snapshot.size} documents to migrate...`);

    // 8. Process the documents in batches
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const docRef = doc.ref;
      const data = doc.data();
      
      // Get the value from the old field
      const fieldValue = data[config.oldFieldName];

      // 9. The "rename" operation:
      // We use bracket notation [ ] to use our config variables as field keys
      batch.update(docRef, {
        [config.newFieldName]: fieldValue, // Set the new field with the old value
        [config.oldFieldName]: admin.firestore.FieldValue.delete() // Delete the old field
      });

      batchCount++;
      processedDocs++;

      // 10. Commit the batch when it's full and start a new one
      if (batchCount === config.batchSize) {
        console.log(`Committing batch of ${batchCount} documents...`);
        await batch.commit();
        // Start a new batch
        batch = db.batch();
        batchCount = 0;
      }
    }

    // 11. Commit any remaining documents in the last batch
    if (batchCount > 0) {
      console.log(`Committing final batch of ${batchCount} documents...`);
      await batch.commit();
    }

    console.log(`Migration complete! Successfully processed ${processedDocs} documents.`);

  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// 12. Run the migration function
migrateData();