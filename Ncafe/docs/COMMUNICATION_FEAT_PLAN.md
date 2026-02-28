# Communication & Notifications Feature Plan

This document outlines the strategy for implementing customer-staff communication and offer notifications in the N-Cafe application.

## 1. Objective
Enable two-way communication between customers and staff, and allow staff to broadcast offers/notifications to customers.

## 2. Database Design (Firebase Firestore)

We will add two new collections to Firestore.

### A. `notifications` (Staff -> Customers)
Used for broadcasting offers or important updates.
```json
{
  "id": "auto-generated-id",
  "title": "Happy Hour!",
  "message": "Get 50% off on all coffees until 5 PM.",
  "type": "offer", // or 'alert', 'info'
  "target": "all", // or specific user ID
  "timestamp": "serverTimestamp",
  "active": true,
  "expiresAt": "date-string" // Optional: auto-hide after date
}
```

### B. `chats` (Customer <-> Staff)
Used for direct support or questions.
```json
{
  "id": "auto-generated-id",
  "participants": ["customer_uid", "staff"], // Array for security rules
  "customerId": "customer_uid",
  "customerName": "John Doe", // Snapshot of name for faster loading
  "lastMessage": "Where is my order?",
  "lastMessageTime": "serverTimestamp",
  "unreadCountStaff": 1,
  "unreadCountCustomer": 0,
  "messages": [ // Sub-collection or Array (Array is easier for small chats)
    {
      "senderId": "customer_uid",
      "text": "Where is my order?",
      "timestamp": "iso-string"
    }
  ]
}
```
*Recommendation*: For simplicity in this prototype, we can use a single `messages` collection where each document is a single message, OR a `chats` collection with a sub-collection of messages. **Suggestion**: Use a flat `messages` collection for simplicity now, or `chats` with an array of the last 20 messages if chats are short. Let's go with a `messages` collection for individual messages to be scalable.

**Refined Schema: `messages` Collection**
```json
{
  "id": "auto-generated",
  "customerId": "user_123", /* Target Customer */
  "direction": "customer_to_staff", /* or 'staff_to_customer' */
  "text": "Can I get extra sugar?",
  "timestamp": "serverTimestamp",
  "read": false
}
```

## 3. UI/UX Plan

### Customer App (`customer.js` & `customer.html`)
1.  **Navigation**:
    *   Update the "Messages" button in the bottom nav (already exists as placeholder) to switch to `view = 'messages'`.
2.  **Messages View (`renderMessages`)**:
    *   **Tab System**: Switch between "Notifications" (Offers) and "Chat" (Support).
    *   **Notifications Tab**:
        *   List card view of active offers.
        *   Visual flair: Use emojis or icons for offers.
    *   **Chat Tab**:
        *   Chat-like interface (bubbles left/right).
        *   Input field at the bottom to send a message.
        *   Real-time updates using `onSnapshot`.

### Staff App (`staff-new.js` & `staff-new.html`)
1.  **Navigation**:
    *   Add a new "Comms" or "Messages" tab to the bottom navigation.
2.  **Comms View (`renderComms`)**:
    *   **Broadcast Section**:
        *   Form to send a new notification (Title, Message, Type).
        *   "Send to All" button.
    *   **Inbox Section**:
        *   List of customers who have sent messages.
        *   Indicators for unread messages.
        *   Clicking a customer opens the thread to reply.

## 4. Implementation Steps

### Phase 1: Notifications (Broadcast)
1.  **Staff Side**: Create `sendNotification()` function in `staff-new.js` that writes to the `notifications` collection.
2.  **Customer Side**: Create `renderNotifications()` in `customer.js` that listens to `notifications` collection and renders them.

### Phase 2: Messaging (Direct Chat)
1.  **Customer Side**: 
    *   Implement `sendMessage()`: Writes to `messages` collection.
    *   Implement `listenToMessages()`: Renders own messages and staff replies.
2.  **Staff Side**:
    *   Implement `listenToAllMessages()`: Groups messages by `customerId`.
    *   Implement `replyToCustomer()`: Writes a message directed to that customer.

## 5. Technical Considerations
*   **Real-time**: We will use `onSnapshot` for instant feedback. This is critical for chat.
*   **Security**: For now, we are using `signInAnonymously`. In a real app, we'd need Security Rules to prevent customers from reading other customers' messages.
*   **Notifications**: Since this is a PWA/Web App, we will use in-app notifications (alerts/badges), not Push Notifications (which require Service Workers and are more complex).

## 6. Action Items for Next Session
1.  Create the backend Firestore collections (automatically handled by code when we write to them).
2.  Update `staff-new.js` to include the Broadcast UI.
3.  Update `customer.js` to replace the "Coming Soon" alert with the actual Messages/Offers interface.
