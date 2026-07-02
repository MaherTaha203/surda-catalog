import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import type { Product } from '@/types/product';
import { resolveThumbUrl } from '@/api/client';

interface ProductCardProps {
  product: Product;
  index: number;
}

export function ProductCard({ product, index }: ProductCardProps) {
  // Catalog uses the lightweight thumbnail; if it's missing (e.g. a legacy
  // image uploaded before thumbnails existed), fall back to the full image.
  const thumbUrl = resolveThumbUrl(product.imageUrl);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
      className="h-full"
    >
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="group flex flex-col h-full rounded-2xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        dir="rtl"
      >
        {/* Image — fixed 4:3 frame; the image adapts to the frame, never the reverse */}
        <div className="relative aspect-[4/3] shrink-0 bg-muted overflow-hidden">
          {product.imageUrl ? (
            <img
              src={thumbUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                // Thumbnail missing → fall back to the full image (guard against loops).
                if (e.currentTarget.src !== product.imageUrl) {
                  e.currentTarget.src = product.imageUrl;
                }
              }}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-400"
            />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-muted-foreground">
              <Package size={48} strokeWidth={1} />
            </div>
          )}
          {/* Category badge */}
          <span className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-[10px] font-medium bg-background/90 text-foreground shadow-sm backdrop-blur-sm">
            {product.category}
          </span>
        </div>

        {/* Content — description space is always reserved so every card has identical dimensions */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-base text-foreground leading-tight mb-1 line-clamp-1">
            {product.name}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2 min-h-[2.4375rem]">
            {product.description || ' '}
          </p>
          <div className="flex items-center justify-between gap-2 mt-auto">
            {product.size && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {product.size}
              </span>
            )}
            <span className="font-bold text-lg text-accent ml-auto">
              ₪{Number(product.cartonPrice).toLocaleString('en-US')}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
