import { createProduct, Gender, CollectionType } from '../types';

const transformProduct = (data: createProduct, isUpdate?: boolean) => {
  return {
    name: data.name,
    description: data.description,
    price: data.price,
    collection: data.collection,
    modelDetail: data.modelDetail,
    isPublic: data.isPublic,
    gender: data.gender as Gender,
    collectionType: data.collectionType as CollectionType,
    onSale: data.onSale,
    discountPercent: data.discountPercent,
    inStock: data.inStock,
    type: data.type,

    variants: {
      ...(isUpdate ? { deleteMany: {} } : {}),
      create: data.variants.map((v) => ({
        color: v.color,
        images: {
          create: (v.images || []).map((img: string | { imageUrl: string }) => ({
            imageUrl: typeof img === 'string' ? img : img.imageUrl,
          })),
        },
        sizes: {
          create: (v.sizes || []).map((s: { size: string; stockCount: number }) => ({
            size: s.size,
            stockCount: s.stockCount,
          })),
        },
      })),
    },
  };
};

export { transformProduct };
