export type AuthTokenPayload = {
  sub: string;
  username: string;
  sid: string;
  roles: string[];
  type: 'access' | 'refresh';
  jti: string;
};
