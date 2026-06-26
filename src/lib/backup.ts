import type { Product } from '@/types/product';
import { getDisplayPin, getAdminPin, getCompanyLogo } from './storage';

interface BackupData {
  version: number;
  timestamp: string;
  products: Product[];
  settings: {
    displayPin: string;
    adminPin: string;
    companyLogo: string;
  };
  images: Record<string, string>; // productId -> base64 image data
}

export async function createBackup(products: Product[]): Promise<Blob> {
  const images: Record<string, string> = {};

  // Fetch and encode all product images
  for (const p of products) {
    if (p.imageUrl) {
      try {
        const response = await fetch(p.imageUrl);
        const blob = await response.blob();
        images[p.id] = await blobToBase64(blob);
      } catch {
        images[p.id] = '';
      }
    }
  }

  const backup: BackupData = {
    version: 1,
    timestamp: new Date().toISOString(),
    products: products.map((p) => ({ ...p, imageUrl: '' })), // strip URLs, images stored separately
    settings: {
      displayPin: getDisplayPin(),
      adminPin: getAdminPin(),
      companyLogo: getCompanyLogo(),
    },
    images,
  };

  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
}

export async function parseBackup(file: File): Promise<BackupData> {
  const text = await file.text();
  const data = JSON.parse(text) as BackupData;

  if (!data.version || !data.products || !data.settings) {
    throw new Error('تنسيق ملف النسخة الاحتياطية غير صالح');
  }

  return data;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
