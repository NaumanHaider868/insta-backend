import { Router } from 'express';
import {
  uploadReel,
  deleteReel,
  getReel,
  getUserReels,
  getReelsFeed,
  likeReel,
  unlikeReel,
  commentReel,
  getReelComments,
  deleteReelComment,
} from '../controllers/reel';
import { authenticate, uploadVideo } from '../middlewares';
import { reelValidator, ReelSchema } from '../validators/reel';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  uploadVideo.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  reelValidator.getMiddleware(ReelSchema.Create_Reel),
  uploadReel
);

router.get('/feed', getReelsFeed);
router.get('/user/:userId', getUserReels);
router.delete('/comment/:commentId', deleteReelComment);

router.get('/:id', getReel);
router.delete('/:id', deleteReel);
router.post('/:id/like', likeReel);
router.delete('/:id/like', unlikeReel);
router.post('/:id/comment', reelValidator.getMiddleware(ReelSchema.Comment_Reel), commentReel);
router.get('/:id/comments', getReelComments);

export default router;
