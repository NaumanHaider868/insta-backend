interface FollowUserParams {
  userId: string;
}

interface FollowUserResponse {
  id: string;
  followerId: string;
  followingId: string;
  createdAt: Date;
}

interface FollowStatusResponse {
  isFollowing: boolean;
  isFollowedBy: boolean;
}

interface FollowUserInfo {
  id: string;
  userName: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
}

export type { FollowUserParams, FollowUserResponse, FollowStatusResponse, FollowUserInfo };
