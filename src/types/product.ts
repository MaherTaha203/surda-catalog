export type ProductCategory = 'مواد التنظيف' | 'أدوات التنظيف';

export interface Product {
  id: string;
  name: string;
  description: string;
  size: string;
  cartonQuantity: number;
  cartonPrice: number;
  imageUrl: string;
  category: ProductCategory;
  isHidden: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  displayPin: string;
  adminPin: string;
  companyLogo: string;
}
