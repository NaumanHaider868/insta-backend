import { Router } from 'express';
import { userProfile } from '../controllers';
import { authenticate } from '../middlewares';

const router = Router();

router.use(authenticate);

router.get('/profile/:id', userProfile);

export default router;
