import { useNavigate } from '@tanstack/react-router';
import { toast } from '@blinkdotnew/ui';

export function useAdminGuard() {
  const navigate = useNavigate();

  const checkAdmin = () => {
    const isAdmin = sessionStorage.getItem('sarda_admin_unlocked') === 'true';
    if (!isAdmin) {
      toast.error('يجب إدخال رمز المدير للوصول');
      navigate({ to: '/' });
      return false;
    }
    return true;
  };

  return { checkAdmin };
}
