import { Request, Response } from 'express';
import { prisma } from '../config';
import { transformProduct } from '../transforms';
import { createProduct as CreateProductBody } from '../types';
import {
  appErrorResponse,
  RequestWithBody,
  RequestWithParams,
  sendSuccessResponse,
  toSafeNumber,
} from '../utils';

const createProduct = async (req: RequestWithBody<CreateProductBody>, res: Response) => {
  try {
    const data = transformProduct(req.body);

    const product = await prisma.product.create({
      data,
      include: {
        variants: {
          include: {
            images: true,
            sizes: true,
          },
        },
      },
    });

    return sendSuccessResponse(res, 200, product, 'Product created successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const fetchProducts = async (req: Request, res: Response) => {
  try {
    // const { search, type, size } = req.body;

    const products = await prisma.product.findMany({
      where: {
        // ...(search && {
        //   name: { contains: search },
        // }),
        // ...(type && { type }),
        // ...(color && {
        //   variants: {
        //     some: {
        //       color,
        //     },
        //   },
        // }),
        // ...(size && {
        //   variants: {
        //     some: {
        //       sizes: {
        //         some: {
        //           size,
        //         },
        //       },
        //     },
        //   },
        // }),
      },
      include: {
        variants: {
          include: {
            images: true,
            sizes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sendSuccessResponse(res, 200, products, 'Products fetched successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const editProduct = async (req: RequestWithParams<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const data = transformProduct(req.body, true);
    const product = await prisma.product.update({
      where: { id: toSafeNumber(id) },
      data,
      include: {
        variants: {
          include: {
            images: true,
            sizes: true,
          },
        },
      },
    });
    return sendSuccessResponse(res, 200, product, 'Product updated successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const fetchProduct = async (req: RequestWithParams<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id: toSafeNumber(id) },
      include: {
        variants: {
          include: {
            images: true,
            sizes: true,
          },
        },
      },
    });
    return sendSuccessResponse(res, 200, product, 'Product fetched successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

const deleteProduct = async (req: RequestWithParams<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.product.delete({
      where: { id: toSafeNumber(id) },
    });
    return sendSuccessResponse(res, 200, [], 'Product deleted successfully');
  } catch (error) {
    return appErrorResponse(res, error);
  }
};

export { createProduct, fetchProducts, fetchProduct, deleteProduct, editProduct };
