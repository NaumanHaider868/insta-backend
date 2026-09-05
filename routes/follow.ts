import { Router } from 'express';
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus,
} from '../controllers/follow';
import { authenticate } from '../middlewares';

const router = Router();

router.use(authenticate);

router.post('/:userId', followUser);
router.delete('/:userId', unfollowUser);
router.get('/followers/:userId', getFollowers);
router.get('/following/:userId', getFollowing);
router.get('/status/:userId', getFollowStatus);

export default router;
