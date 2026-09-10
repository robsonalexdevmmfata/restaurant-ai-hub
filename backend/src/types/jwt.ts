export type JwtPayload = {
  sub: number;
  restaurantId: number;
  email: string;
  role: string;
};

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}
