import { NextFunction, Response } from 'express';
import { TokenExpiredError, JsonWebTokenError, verify } from 'jsonwebtoken';
import { Request } from 'src/common-types/gql';
import { getConfig } from 'src/config';
import { User } from 'src/models';

export const userMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const { authorization } = req.headers;
  if (!authorization) {
    return next();
  }

  // We don't, currently, handle different JsonWebTokenError messages
  // differently but we do need to add messages to the error object.
  const raw = authorization.split(' ');
  if (raw.length != 2 || raw[0] != 'Bearer') {
    return next(new JsonWebTokenError('Invalid auth header'));
  }

  const value = verify(raw[1], getConfig('JWT_SECRET')) as { id: number };
  if (!value.id) {
    return next(new JsonWebTokenError('Missing contents'));
  }

  User.findOne(value.id, { relations: ['chapter_roles'] })
    .then((user) => {
      if (!user) {
        return next('User not found');
      }

      req.user = user;
      next();
    })
    .catch((err) => {
      next(err);
    });
};

export function handleAuthenticationError(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof TokenExpiredError) {
    return res.status(401).send({
      message: 'Token expired',
    });
  } else if (err instanceof JsonWebTokenError) {
    return res.status(401).send({
      message: 'Token invalid',
    });
  }
}