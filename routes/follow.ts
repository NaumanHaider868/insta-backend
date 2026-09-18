import { Router } from 'express';
import {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowing,
  getFollowStatus,
} from '../controllers/follow';
import { authenticate } from '../middlewares';
import { followValidator, FollowSchema } from '../validators/follow';

const router = Router();

router.use(authenticate);

router.post(
  '/:userId',
  followValidator.getMiddleware(FollowSchema.Follow_User, { isParams: true }),
  followUser
);
router.delete(
  '/:userId',
  followValidator.getMiddleware(FollowSchema.Follow_User, { isParams: true }),
  unfollowUser
);
router.get(
  '/followers/:userId',
  followValidator.getMiddleware(FollowSchema.Get_Followers, { isParams: true }),
  getFollowers
);
router.get(
  '/following/:userId',
  followValidator.getMiddleware(FollowSchema.Get_Following, { isParams: true }),
  getFollowing
);
router.get(
  '/status/:userId',
  followValidator.getMiddleware(FollowSchema.Follow_Status, { isParams: true }),
  getFollowStatus
);

export default router;
