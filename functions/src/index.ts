import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";

admin.initializeApp();

// 1. High-Value Notification: Messages (In-App + Email)
export const onMessageSent = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log("No data associated with the event");
      return;
    }

    const messageData = snapshot.data();
    const conversationId = event.params.conversationId;

    // Fetch the conversation to determine the recipient
    const conversationRef = admin.firestore().collection("conversations").doc(conversationId);
    const conversationDoc = await conversationRef.get();

    if (!conversationDoc.exists) {
      console.log(`Conversation ${conversationId} does not exist.`);
      return;
    }

    const conversationData = conversationDoc.data();
    if (!conversationData) return;

    const senderId = messageData.senderId;
    let recipientId = "";
    let senderName = "";

    // Determine recipient and sender name based on conversation participants
    if (senderId === conversationData.tenantId) {
      recipientId = conversationData.landlordId;
      senderName = conversationData.tenantName || "Tenant";
    } else if (senderId === conversationData.landlordId) {
      recipientId = conversationData.tenantId;
      senderName = conversationData.landlordName || "Landlord";
    } else {
      console.log(`Sender ${senderId} is neither tenant nor landlord in conversation ${conversationId}`);
      return;
    }

    // Create a short snippet of the message
    const snippet = messageData.text.length > 50 
      ? messageData.text.substring(0, 47) + "..." 
      : messageData.text;

    // A. Create In-App Notification
    const notificationRef = admin.firestore().collection("notifications").doc();
    const notificationData = {
      recipientId,
      senderName,
      type: "message",
      messageSnippet: snippet,
      isRead: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    };
    await notificationRef.set(notificationData);
    console.log(`In-app notification created for user ${recipientId} from ${senderName}`);

    // B. Create Email Notification (Requires "Trigger Email" Firebase Extension)
    const recipientDoc = await admin.firestore().collection("users").doc(recipientId).get();
    if (recipientDoc.exists) {
      const recipientData = recipientDoc.data();
      if (recipientData && recipientData.email) {
        await admin.firestore().collection("mail").add({
          to: recipientData.email,
          message: {
            subject: `New message from ${senderName} on EntraHomes`,
            text: `You have a new message from ${senderName}:\n\n"${snippet}"\n\nLog in to EntraHomes to reply.`,
            html: `<p>You have a new message from <strong>${senderName}</strong>:</p><blockquote style="border-left: 4px solid #ccc; padding-left: 16px; color: #555;">${snippet}</blockquote><p>Log in to EntraHomes to reply.</p>`
          }
        });
        console.log(`Email queued for ${recipientData.email}`);
      }
    }
  }
);

// 2. Relevant Notification: New Property Listings (In-App Only)
export const onPropertyListed = onDocumentCreated(
  "properties/{propertyId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const propertyData = snapshot.data();
    const landlordId = propertyData.landlordId;
    
    // Fetch landlord name
    let landlordName = "A landlord";
    if (landlordId && landlordId !== 'external_network') {
      const landlordDoc = await admin.firestore().collection("users").doc(landlordId).get();
      if (landlordDoc.exists) {
        landlordName = landlordDoc.data()?.name || "A landlord";
      }
    }

    const propertyTitle = propertyData.title || "a new property";
    const location = propertyData.location || "your area";
    const snippet = `Just listed: ${propertyTitle} in ${location}. Check it out!`;

    // Fetch tenants to notify (limiting to 100 for performance/cost safety in MVP)
    const tenantsSnapshot = await admin.firestore().collection("users")
      .where("role", "==", "tenant")
      .limit(100)
      .get();

    const batch = admin.firestore().batch();
    let count = 0;

    tenantsSnapshot.forEach((tenantDoc) => {
      const tenantId = tenantDoc.id;
      const notificationRef = admin.firestore().collection("notifications").doc();
      
      batch.set(notificationRef, {
        recipientId: tenantId,
        senderName: landlordName,
        type: "listing",
        messageSnippet: snippet,
        isRead: false,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      count++;
    });

    if (count > 0) {
      await batch.commit();
      console.log(`Created in-app notifications for ${count} tenants about new property ${event.params.propertyId}`);
    }
  }
);
