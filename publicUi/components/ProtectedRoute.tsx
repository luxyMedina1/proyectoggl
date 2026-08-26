import { Navigate, Outlet } from '@/utils/nextRouterCompat';
import { useAuthStore } from '../../hooks/useAuthStore';

const ProtectedRoute = () => {
    const { user } = useAuthStore(); 

    return user ? <Outlet /> : <Navigate to="/auth/login" />;
};

export default ProtectedRoute;
