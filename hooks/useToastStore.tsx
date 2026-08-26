import { toast } from 'react-toastify';

export const useToast = () => {

    const showToast = (type: string,message: string ) => {
        switch (type) {
            case 'success':
                toast.success(message);
                break;
            case 'error':
                toast.error(message);
                break;
            case 'info':
                toast.info(message);
                break;
            case 'warn':
                toast.warn(message);
                break;
            default:
                toast(message);
                break;
        }
    }

    const showConfirmToast = (type: 'success' | 'error' | 'info' | 'warn', title: string, message: string) => {
        return new Promise((resolve) => {
            const ToastContent = () => (
                <div>
                    <h4>{title}</h4>
                    <p>{message}</p>
                    <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between' }}>
                        <button
                            style={{ marginRight: '5px' }}
                            onClick={() => {
                                toast.dismiss(toastId);
                                resolve({ isConfirmed: true });
                            }}
                        >
                            Confirmar
                        </button>
                        <button
                            onClick={() => {
                                toast.dismiss(toastId);
                                resolve({ isConfirmed: false });
                            }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            );

            const toastId = toast[type](<ToastContent />, {
                position: "top-right",
                autoClose: false,
                closeOnClick: false,
                draggable: false,
            });
        });
    };

    return {
        showToast,
        showConfirmToast
    }
}
