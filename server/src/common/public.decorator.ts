import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks routes that skip auth (signup, login, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
