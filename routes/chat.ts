import { Router } from 'express';
import { sendMessage, getConversation, getConversations } from '../controllers';
import { chatValidator } from '../validators';
import { authenticate } from '../middlewares';
import { ChatSchema } from '../validators/chat';

const router = Router();

// All chat routes require authentication
router.use(authenticate);

router.post('/send', chatValidator.getMiddleware(ChatSchema.Send_Message), sendMessage);
router.get('/conversations', getConversations);
router.get('/single/:userId', getConversation);

export default router;
