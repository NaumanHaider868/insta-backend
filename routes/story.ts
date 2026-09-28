import { Router } from 'express';
import { createStory, getStoryFeed, getStoryViewers, markStoryViewed } from '../controllers/story';
import { authenticate, uploadStory } from '../middlewares';

const router = Router();

router.use(authenticate);
router.get('/feed', getStoryFeed);
router.post('/', uploadStory.single('media'), createStory);
router.get('/:id/views', getStoryViewers);
router.post('/:id/view', markStoryViewed);

export default router;