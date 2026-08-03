export interface AuthUser {
  id?: string | number;
  username?: string;
  name: string;
  avatar?: string;
  dept?: string;
  title?: string;
  role: string;
  allowedPaths?: string[];
  projectScope?: string;
  dataScope?: string;
  lastLogin?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}
