import { File } from '../common';

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

interface AuthTokenPayload {
  token: string;
  password: string;
}

interface ProfileUpdateFormData {
  profile?: string;
  removeProfileImage?: string;
  image?: File;
}

export type { LoginPayload, RegisterPayload, AuthTokenPayload, ProfileUpdateFormData };
