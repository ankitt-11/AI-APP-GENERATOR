export interface JwtPayload {
  sub: string;       // User ID (cuid)
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}
