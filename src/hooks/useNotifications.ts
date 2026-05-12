import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';

export interface Notification {
  id: string;
  recipientId: string;
  senderName: string;
  type: 'message' | 'listing';
  messageSnippet: string;
  isRead: boolean;
  timestamp: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const notifs: Notification[] = [];
        let unread = 0;
        
        snapshot.forEach((doc) => {
          const data = doc.data() as Omit<Notification, 'id'>;
          notifs.push({ id: doc.id, ...data });
          if (!data.isRead) {
            unread++;
          }
        });

        // Sort locally since we might not have a composite index for recipientId + timestamp
        notifs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        setNotifications(notifs);
        setUnreadCount(unread);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'notifications');
      }
    );

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notificationId: string) => {
    if (!user) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'notifications', notificationId), {
        isRead: true
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = useCallback(async () => {
    if (!user || notifications.length === 0) return;
    try {
      const { doc, writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      let hasUnread = false;
      notifications.forEach(notif => {
        if (!notif.isRead) {
          batch.update(doc(db, 'notifications', notif.id), { isRead: true });
          hasUnread = true;
        }
      });
      
      if (hasUnread) {
        await batch.commit();
      }
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  }, [user, notifications]);

  return { notifications, unreadCount, markAsRead, markAllAsRead };
}
