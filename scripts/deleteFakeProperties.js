import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function deleteFakes() {
  console.log("Deleting fake properties...");
  const snapshot = await getDocs(collection(db, 'properties'));
  let count = 0;
  for (const document of snapshot.docs) {
    const data = document.data();
    if (data.landlordId === 'external_network' || data.id?.startsWith('mock_')) {
      await deleteDoc(doc(db, 'properties', document.id));
      count++;
    }
  }
  console.log(`Deleted ${count} fake properties.`);
  process.exit(0);
}

deleteFakes();
