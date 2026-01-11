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

export type { LoginPayload, RegisterPayload, AuthTokenPayload };
