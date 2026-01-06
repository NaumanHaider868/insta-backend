import { CollectionType, Gender } from '../../enums';

interface ProductVariantSize {
  size: string;
  stockCount: number;
}
interface ProductVariantInput {
  color: string;
  images: string[];
  sizes: ProductVariantSize[];
}
interface createProduct {
  name: string;
  description: string;
  price: number;
  collection?: string;
  modelDetail?: string;
  isPublic: boolean;
  gender: Gender;
  collectionType: CollectionType;
  onSale: boolean;
  discountPercent?: number;
  inStock: boolean;
  stock: number;
  category: string;
  type: string;
  variants: ProductVariantInput[];
}

interface FetchProducts {
  search?: string;
  size?: string;
  type?: string;
}

export { createProduct, Gender, CollectionType, ProductVariantInput, FetchProducts };
