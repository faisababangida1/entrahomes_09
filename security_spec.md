# Firestore Security Specification

## Data Invariants
1. **User Profile**: Only the owner can create/update their profile. Role cannot be changed once set (immutable).
2. **Property**: Only a `landlord` can create a property. Only the owning `landlord` or an `admin` can update/delete it.
3. **Saved Property**: Only a `tenant` can manage their own saved properties.
4. **Leases**: A tenant creates a `pending` lease. Only the linked `landlord` can approve it to `active`.
5. **Reviews**: Only users with an active/completed lease can review the other party.
6. **Conversations**: Only the tenant and landlord involved can participate.
7. **Notifications**: Only the recipient can read/delete their notifications.

## The "Dirty Dozen" Payloads (Attacks)
1. **Identity Theft**: User A tries to create a user profile with User B's UID.
2. **Role Escalation**: Tenant tries to update their profile to `role: 'admin'`.
3. **Property Takeover**: Landlord B tries to update Landlord A's property.
4. **Phantom Property**: Landlord creates a property without a title or description.
5. **Denial of Wallet (Property)**: Creating a property with a 500KB description.
6. **Lease Hijack**: Tenant B tries to approve a lease meant for Landlord A.
7. **Terminal State Break**: Landlord tries to move a `rented` property back to `available` without terminating the lease.
8. **Shadow Review**: User A reviews User B without ever having a lease with them.
9. **Notification Spam**: User A tries to send notifications to User B directly without a valid trigger (though rules can only guard the write).
10. **Conversation Snoop**: Tenant C tries to read messages between Tenant A and Landlord B.
11. **Spoofed Sender**: In a conversation, Tenant A tries to send a message with `senderId: 'landlord_uid'`.
12. **Orphaned Message**: Creating a message in a conversation that doesn't exist.

## Verification
The `firestore.rules` must reject all these payloads.
