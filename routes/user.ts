import { Router } from 'express';
import { getSuggestions, uploadProfile, userProfile } from '../controllers';
import { authenticate, upload } from '../middlewares';

const router = Router();

router.use(authenticate);

router.get('/suggestions', getSuggestions);
router.put('/profile', upload.single('image'), uploadProfile);
router.get('/profile/:id', userProfile);

export default router;
