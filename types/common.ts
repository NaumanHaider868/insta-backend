import { Request as ExpressRequest } from 'express';

type File = Express.Multer.File;

interface RequestWithFormData<T = Record<string, unknown>> extends ExpressRequest {
  file?: Express.Multer.File;
  files?: Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
  fields?: Record<string, unknown>;
  body: T;
}

export type { RequestWithFormData, File };
