import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  fetchProducts,
  fetchProduct,
  editProduct,
} from '../controllers';

const router = Router();
router.post('/create', createProduct);
router.get('/all', fetchProducts);
router.get('/fetch/:id', fetchProduct);
router.delete('/delete/:id', deleteProduct);
router.patch('/edit/:id', editProduct);

export default router;
