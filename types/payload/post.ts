interface CreatePostPayload {
  caption?: string;
}

interface PostCommentPayload {
  content: string;
}

interface PostMediaItem {
  id: string;
  url: string;
  mediaType: string;
  order: number;
}

interface PostAuthor {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
}

interface PostResponse {
  id: string;
  userId: string;
  caption: string | null;
  createdAt: Date;
  updatedAt: Date;
  media: PostMediaItem[];
  user: PostAuthor;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}

export type { CreatePostPayload, PostCommentPayload, PostMediaItem, PostAuthor, PostResponse };
