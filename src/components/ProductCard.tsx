import { Link } from '@tanstack/react-router';
import { motion } from 'framer-motion';
import { Package } from 'lucide-react';
import type { Product } from '@/types/product';

interface ProductCardProps {
  product: Product;
  index: number;
}

export function ProductCard({ product, index }: ProductCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06 }}
    >
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="group block rounded-2xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98]"
        dir="rtl"
      >
        {/* Image */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-400"
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

        {/* Content */}
        <div className="p-4">
          <h3 className="font-bold text-base text-foreground leading-tight mb-1 line-clamp-1">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-xs text-muted-foreground leading-relaxed mb-3 line-clamp-2">
              {product.description}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            {product.size && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {product.size}
              </span>
            )}
            <span className="font-bold text-lg text-accent ml-auto">
              ₪{Number(product.cartonPrice).toLocaleString('ar-SA')}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
