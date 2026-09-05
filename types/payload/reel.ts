interface CreateReelPayload {
  caption?: string;
}

interface ReelCommentPayload {
  content: string;
}

interface ReelAuthor {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
}

interface ReelResponse {
  id: string;
  userId: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: ReelAuthor;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
}

export type { CreateReelPayload, ReelCommentPayload, ReelAuthor, ReelResponse };
