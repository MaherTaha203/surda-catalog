import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Upload, Check } from 'lucide-react';
import { toast } from '@blinkdotnew/ui';
import { blink } from '@/blink/client';
import type { Product, ProductCategory } from '@/types/product';

interface FormData {
  name: string;
  description: string;
  size: string;
  cartonQuantity: string;
  cartonPrice: string;
  category: ProductCategory;
}

interface AdminProductFormProps {
  open: boolean;
  editingProduct: Product | null;
  productCount: number;
  onClose: () => void;
  onSaved: () => void;
}

const emptyForm: FormData = {
  name: '', description: '', size: '',
  cartonQuantity: '', cartonPrice: '', category: 'مواد التنظيف',
};

export function AdminProductForm({ open, editingProduct, productCount, onClose, onSaved }: AdminProductFormProps) {
  const [form, setForm] = useState<FormData>(() => {
    if (editingProduct) {
      return {
        name: editingProduct.name,
        description: editingProduct.description,
        size: editingProduct.size || '',
        cartonQuantity: String(editingProduct.cartonQuantity || ''),
        cartonPrice: String(editingProduct.cartonPrice || ''),
        category: editingProduct.category as ProductCategory,
      };
    }
    return emptyForm;
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(editingProduct?.imageUrl || '');
  const [uploading, setUploading] = useState(false);

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const { publicUrl } = await blink.storage.upload(file, `products/${Date.now()}.${ext}`);
    return publicUrl;
  }, []);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('يرجى إدخال اسم المنتج'); return; }
    setUploading(true);
    try {
      let imageUrl = editingProduct?.imageUrl || '';
      if (imageFile) imageUrl = await uploadImage(imageFile);

      const data: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        size: form.category === 'مواد التنظيف' ? form.size.trim() : '',
        cartonQuantity: parseInt(form.cartonQuantity) || 0,
        cartonPrice: parseFloat(form.cartonPrice) || 0,
        category: form.category,
        imageUrl,
      };

      if (editingProduct) {
        data.updatedAt = new Date().toISOString();
        await blink.db.table<Product>('products').update(editingProduct.id, data);
        toast.success('تم تحديث المنتج');
      } else {
        data.sortOrder = productCount;
        data.isHidden = 0;
        await blink.db.table<Product>('products').create(data as Record<string, string | number>);
        toast.success('تم إضافة المنتج');
      }
      onSaved();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'حدث خطأ');
    } finally {
      setUploading(false);
    }
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-foreground/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold text-foreground">{editingProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">الفئة</label>
            <div className="flex gap-2">
              {(['مواد التنظيف', 'أدوات التنظيف'] as ProductCategory[]).map((cat) => (
                <button key={cat} type="button"
                  onClick={() => setForm({ ...form, category: cat, size: cat === 'أدوات التنظيف' ? '' : form.size })}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${form.category === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">اسم المنتج *</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring"
              placeholder="أدخل اسم المنتج" />
          </div>
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">وصف مختصر</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring resize-none"
              placeholder="وصف مختصر للمنتج" />
          </div>
          {/* Size */}
          {form.category === 'مواد التنظيف' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">الحجم</label>
              <input type="text" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring"
                placeholder="مثال: 5 لتر" />
            </div>
          )}
          {/* Carton Qty & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">الكمية في الكرتون</label>
              <input type="number" value={form.cartonQuantity} onChange={(e) => setForm({ ...form, cartonQuantity: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">سعر الكرتون (₪)</label>
              <input type="number" step="0.01" value={form.cartonPrice} onChange={(e) => setForm({ ...form, cartonPrice: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring" placeholder="0.00" />
            </div>
          </div>
          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">صورة المنتج</label>
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-border hover:border-ring/50 transition-colors cursor-pointer">
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full max-h-48 object-contain rounded-lg" />
              ) : (
                <><Upload size={28} className="text-muted-foreground" /><span className="text-sm text-muted-foreground">اضغط لرفع صورة</span></>
              )}
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0]; if (!file) return;
                setImageFile(file); setImagePreview(URL.createObjectURL(file));
              }} className="hidden" />
            </label>
          </div>
          {/* Submit */}
          <button type="button" onClick={handleSubmit}
            disabled={uploading || !form.name.trim()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {uploading ? (
              <><div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> جاري الرفع...</>
            ) : editingProduct ? (
              <><Check size={18} /> حفظ التعديلات</>
            ) : (
              <><Plus size={18} /> إضافة المنتج</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
