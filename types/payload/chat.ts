interface SendMessagePayload {
  receiverId: string;
  content: string;
}

interface MessageResponse {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderId: string;
  receiverId: string;
}

interface ConversationResponse {
  id: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  senderId: string;
  receiverId: string;
  sender: {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
  };
  receiver: {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
  };
}

interface ConversationListItem {
  user: {
    id: string;
    userName: string;
    firstName: string;
    lastName: string;
  };
  lastMessage: {
    id: string;
    content: string;
    isRead: boolean;
    createdAt: string;
    senderId: string;
    receiverId: string;
  };
}

export type { SendMessagePayload, MessageResponse, ConversationResponse, ConversationListItem };
