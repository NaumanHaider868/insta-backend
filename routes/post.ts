import { Router } from 'express';
import {
  createPost,
  deletePost,
  getPost,
  getUserPosts,
  getFeed,
  likePost,
  unlikePost,
  commentPost,
  getPostComments,
  deleteComment,
} from '../controllers/post';
import { authenticate, upload } from '../middlewares';
import { postValidator } from '../validators/post';
import { PostSchema } from '../validators/post';

const router = Router();

router.use(authenticate);

router.post(
  '/',
  upload.array('images', 10),
  postValidator.getMiddleware(PostSchema.Create_Post),
  createPost
);
router.get('/feed', getFeed);
router.get('/user/:userId', getUserPosts);
router.delete('/comment/:commentId', deleteComment);

router.get('/:id', getPost);
router.delete('/:id', deletePost);
router.post('/:id/like', likePost);
router.delete('/:id/like', unlikePost);
router.post('/:id/comment', postValidator.getMiddleware(PostSchema.Comment_Post), commentPost);
router.get('/:id/comments', getPostComments);

export default router;
