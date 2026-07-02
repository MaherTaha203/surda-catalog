import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Upload, Check } from 'lucide-react';
import { toast } from '@blinkdotnew/ui';
import { createProduct, updateProduct, uploadProductImage } from '@/api/products';
import { compressProductImage, ImageValidationError } from '@/lib/image-compression';
import type { Product, ProductCategory } from '@/types/product';

type UploadStatus = 'idle' | 'preparing' | 'compressing' | 'uploading' | 'processing' | 'completed';

const STATUS_LABEL: Record<Exclude<UploadStatus, 'idle' | 'completed'>, string> = {
  preparing: 'جاري التحضير...',
  compressing: 'جاري الضغط...',
  uploading: 'جاري الرفع...',
  processing: 'جاري المعالجة...',
};

interface FormData {
  name: string;
  description: string;
  size: string;
  cartonQuantity: string;
  cartonPrice: string;
  offerPrice: string;
  offerQuantity: string;
  bonusQuantity: string;
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
  cartonQuantity: '', cartonPrice: '',
  offerPrice: '', offerQuantity: '', bonusQuantity: '',
  category: 'مواد التنظيف',
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
        offerPrice: String(editingProduct.offerPrice || ''),
        offerQuantity: String(editingProduct.offerQuantity || ''),
        bonusQuantity: String(editingProduct.bonusQuantity || ''),
        category: editingProduct.category as ProductCategory,
      };
    }
    return emptyForm;
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState(editingProduct?.imageUrl || '');
  const [status, setStatus] = useState<UploadStatus>('idle');
  const busy = status !== 'idle' && status !== 'completed';

  const uploadImage = useCallback(
    async (file: File): Promise<string> => {
      // Replace: pass the current image so the server deletes the old file.
      return uploadProductImage(file, editingProduct?.imageUrl || undefined);
    },
    [editingProduct],
  );

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('يرجى إدخال اسم المنتج'); return; }
    try {
      let imageUrl = editingProduct?.imageUrl || '';
      if (imageFile) {
        // Prepare → compress (in a Web Worker) → upload.
        setStatus('preparing');
        let fileToUpload = imageFile;
        try {
          setStatus('compressing');
          fileToUpload = await compressProductImage(imageFile);
        } catch (e: unknown) {
          if (e instanceof ImageValidationError) {
            toast.error(e.message);
            setStatus('idle');
            return;
          }
          throw e;
        }
        setStatus('uploading');
        imageUrl = await uploadImage(fileToUpload);
      }

      // Server-side processing of the product record.
      setStatus('processing');
      const data: Record<string, unknown> = {
        name: form.name.trim(),
        description: form.description.trim(),
        size: form.category === 'مواد التنظيف' ? form.size.trim() : '',
        cartonQuantity: parseInt(form.cartonQuantity) || 0,
        cartonPrice: parseFloat(form.cartonPrice) || 0,
        offerPrice: parseFloat(form.offerPrice) || 0,
        offerQuantity: parseInt(form.offerQuantity) || 0,
        bonusQuantity: parseInt(form.bonusQuantity) || 0,
        category: form.category,
        imageUrl,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, data);
        toast.success('تم تحديث المنتج');
      } else {
        data.sortOrder = productCount;
        data.isHidden = 0;
        await createProduct(data);
        toast.success('تم إضافة المنتج');
      }
      setStatus('completed');
      onSaved();
    } catch (e: unknown) {
      toast.error((e as Error).message || 'حدث خطأ');
      setStatus('idle');
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
          {/* Offer: price, quantity, bonus (entered manually — nothing is calculated) */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">سعر العرض (₪)</label>
              <input type="number" step="0.01" value={form.offerPrice} onChange={(e) => setForm({ ...form, offerPrice: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">كمية العرض</label>
              <input type="number" value={form.offerQuantity} onChange={(e) => setForm({ ...form, offerQuantity: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">الكمية المجانية</label>
              <input type="number" value={form.bonusQuantity} onChange={(e) => setForm({ ...form, bonusQuantity: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring" placeholder="0" />
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
            disabled={busy || !form.name.trim()}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? (
              <><div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> {STATUS_LABEL[status as Exclude<UploadStatus, 'idle' | 'completed'>]}</>
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
