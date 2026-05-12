import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { useNotifications } from '../hooks/useNotifications';
import { Send, User, Home, ArrowLeft } from 'lucide-react';

interface Conversation {
  id: string;
  propertyId: string;
  propertyTitle: string;
  tenantId: string;
  tenantName: string;
  landlordId: string;
  landlordName: string;
  lastMessage?: string;
  updatedAt: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: string;
}

const formatDate = (date: any) => {
  if (!date) return '';
  if (typeof date === 'string') return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (date.toDate) return date.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return '';
};

const formatTime = (date: any) => {
  if (!date) return '';
  if (typeof date === 'string') return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (date.toDate) return date.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return '';
};

export default function Messages() {
  const { user, profile } = useAuth();
  const { markAllAsRead } = useNotifications();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  useEffect(() => {
    if (!user || !profile) return;

    const roleField = profile.role === 'tenant' ? 'tenantId' : 'landlordId';
    const q = query(
      collection(db, 'conversations'),
      where(roleField, '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convos: Conversation[] = [];
      snapshot.forEach((doc) => {
        convos.push({ id: doc.id, ...doc.data() } as Conversation);
      });
      // Sort by updatedAt descending locally since we didn't add a composite index yet
      convos.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      
      setConversations(convos);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'conversations');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, profile]);

  useEffect(() => {
    if (!activeConversation) return;

    const q = query(
      collection(db, `conversations/${activeConversation.id}/messages`),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `conversations/${activeConversation.id}/messages`);
    });

    return () => unsubscribe();
  }, [activeConversation]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !activeConversation) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      // Add message
      await addDoc(collection(db, `conversations/${activeConversation.id}/messages`), {
        senderId: user.uid,
        text: messageText,
        createdAt: serverTimestamp()
      });

      // Update conversation lastMessage and updatedAt
      await updateDoc(doc(db, 'conversations', activeConversation.id), {
        lastMessage: messageText,
        updatedAt: serverTimestamp()
      });

      // Create a notification for the recipient
      const recipientId = user.uid === activeConversation.tenantId 
        ? activeConversation.landlordId 
        : activeConversation.tenantId;
        
      const senderName = user.uid === activeConversation.tenantId
        ? activeConversation.tenantName
        : activeConversation.landlordName;

      await addDoc(collection(db, 'notifications'), {
        recipientId,
        senderName,
        type: 'message',
        messageSnippet: messageText.substring(0, 50) + (messageText.length > 50 ? '...' : ''),
        isRead: false,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `conversations/${activeConversation.id}/messages`);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-0 sm:py-8 h-[calc(100dvh-128px-env(safe-area-inset-bottom))] sm:h-auto sm:pb-20">
      <div className="bg-white sm:rounded-3xl shadow-sm sm:border border-gray-100 overflow-hidden h-full sm:h-[800px] flex flex-col md:flex-row">
          
          {/* Conversations List */}
          <div className={`${activeConversation ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 md:border-r border-gray-100 flex-col bg-white h-full`}>
            <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-xl sm:text-2xl font-outfit font-bold text-gray-900 tracking-tight">Messages</h2>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-8 text-center text-gray-500 flex flex-col items-center justify-center h-full">
                  <div className="bg-gray-50 h-16 w-16 rounded-full flex items-center justify-center mb-4">
                    <User className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-lg font-medium text-gray-900">No conversations yet.</p>
                  <p className="text-sm mt-1">When you contact a landlord or tenant, messages will appear here.</p>
                </div>
              ) : (
                <ul className="divide-y divide-gray-50">
                  {conversations.map((convo) => (
                    <li 
                      key={convo.id} 
                      onClick={() => setActiveConversation(convo)}
                      className={`p-4 sm:p-5 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0 md:border-b-0 ${activeConversation?.id === convo.id ? 'md:bg-primary-50/50 md:border-l-4 md:border-primary-600' : 'md:border-l-4 md:border-transparent'}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <h3 className="font-medium text-gray-900 truncate text-base">
                          {profile?.role === 'tenant' ? convo.landlordName : convo.tenantName}
                        </h3>
                        <span className="text-xs font-medium text-gray-400 whitespace-nowrap ml-2">
                          {formatDate(convo.updatedAt)}
                        </span>
                      </div>
                      <div className="flex items-center text-xs font-medium text-primary-600 mb-2 bg-primary-50 w-fit px-2 py-1 rounded-md">
                        <Home className="h-3 w-3 mr-1.5" />
                        <span className="truncate max-w-[150px] sm:max-w-[200px]">{convo.propertyTitle}</span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {convo.lastMessage || 'No messages yet'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`${!activeConversation ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-[#f8fafc] h-full`}>
            {activeConversation ? (
              <>
                {/* Chat Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100 bg-white flex items-center justify-between shadow-sm z-10">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <button 
                      onClick={() => setActiveConversation(null)}
                      className="md:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-full sm:rounded-2xl bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                      <User className="h-5 w-5 sm:h-6 sm:w-6" />
                    </div>
                    <div className="overflow-hidden">
                      <h3 className="font-outfit font-bold text-gray-900 text-base sm:text-lg truncate">
                        {profile?.role === 'tenant' ? activeConversation.landlordName : activeConversation.tenantName}
                      </h3>
                      <p className="text-xs sm:text-sm font-medium text-gray-500 flex items-center mt-0.5 truncate">
                        <Home className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5 flex-shrink-0" />
                        <span className="truncate">{activeConversation.propertyTitle}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                  {messages.map((msg) => {
                    const isMe = msg.senderId === user?.uid;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 shadow-sm ${isMe ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'}`}>
                          <p className="text-[14px] sm:text-[15px] leading-relaxed break-words">{msg.text}</p>
                          <p className={`text-[10px] sm:text-[11px] font-medium mt-1 sm:mt-1.5 text-right ${isMe ? 'text-primary-200' : 'text-gray-400'}`}>
                            {formatTime(msg.createdAt)}
                          </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 sm:p-4 bg-white border-t border-gray-100">
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Message..."
                    className="flex-1 border border-gray-200 rounded-full sm:rounded-xl px-4 py-2.5 sm:py-3 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="bg-primary-600 text-white rounded-full sm:rounded-xl p-2.5 sm:p-3 flex items-center justify-center hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm flex-shrink-0"
                  >
                    <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <User className="h-10 w-10 text-gray-400" />
              </div>
              <p className="text-xl font-outfit font-bold text-gray-900">Your Messages</p>
              <p className="text-sm mt-2">Select a conversation to start chatting</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
