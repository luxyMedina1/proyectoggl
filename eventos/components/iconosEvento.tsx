// Iconos del evento (bloque de informacion y selector de fechas).
// SVG provistos por diseno; se inlinean como componentes para poder
// colorearlos con currentColor y escalarlos sin peticiones extra.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export const IconoFecha = (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
        <path d="M18 5H6C4.61929 5 3.5 6.11929 3.5 7.5V17.5C3.5 18.8807 4.61929 20 6 20H18C19.3807 20 20.5 18.8807 20.5 17.5V7.5C20.5 6.11929 19.3807 5 18 5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.5 10H20.5M8 3V7M16 3V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const IconoHorario = (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
        <path d="M12 20.5C16.6944 20.5 20.5 16.6944 20.5 12C20.5 7.30558 16.6944 3.5 12 3.5C7.30558 3.5 3.5 7.30558 3.5 12C3.5 16.6944 7.30558 20.5 12 20.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 7.5V12L15 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const IconoApertura = (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
        <path d="M5 21V4.5C5 4.10218 5.15804 3.72064 5.43934 3.43934C5.72064 3.15804 6.10218 3 6.5 3H17.5C17.8978 3 18.2794 3.15804 18.5607 3.43934C18.842 3.72064 19 4.10218 19 4.5V21M3 21H21M14.5 12H14.51" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export const IconoLimite = (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
        <path d="M4 7.5C4 7.10218 4.15804 6.72064 4.43934 6.43934C4.72064 6.15804 5.10218 6 5.5 6H18.5C18.8978 6 19.2794 6.15804 19.5607 6.43934C19.842 6.72064 20 7.10218 20 7.5V10C19.4696 10 18.9609 10.2107 18.5858 10.5858C18.2107 10.9609 18 11.4696 18 12C18 12.5304 18.2107 13.0391 18.5858 13.4142C18.9609 13.7893 19.4696 14 20 14V16.5C20 16.8978 19.842 17.2794 19.5607 17.5607C19.2794 17.842 18.8978 18 18.5 18H5.5C5.10218 18 4.72064 17.842 4.43934 17.5607C4.15804 17.2794 4 16.8978 4 16.5V14C4.53043 14 5.03914 13.7893 5.41421 13.4142C5.78929 13.0391 6 12.5304 6 12C6 11.4696 5.78929 10.9609 5.41421 10.5858C5.03914 10.2107 4.53043 10 4 10V7.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 6V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1.5 1.5" />
    </svg>
);

// Chevron. Apunta a la derecha; se rota para "anterior".
export const IconoChevron = (props: IconProps) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="9" height="17" viewBox="0 0 9 17" fill="none" {...props}>
        <path d="M0.241545 15.5667C0.164905 15.6478 0.10499 15.7432 0.06522 15.8474C0.0254502 15.9517 0.00660438 16.0628 0.00975971 16.1743C0.012915 16.2859 0.0380094 16.3957 0.0836095 16.4975C0.12921 16.5994 0.194423 16.6912 0.275525 16.7679C0.356628 16.8445 0.452033 16.9044 0.556291 16.9442C0.660549 16.984 0.771619 17.0028 0.88316 16.9997C0.994702 16.9965 1.10453 16.9714 1.20637 16.9258C1.30822 16.8802 1.40008 16.815 1.47672 16.7339L8.69748 9.08838C8.8466 8.93066 8.92969 8.72183 8.92969 8.50477C8.92969 8.28772 8.8466 8.07889 8.69748 7.92117L1.47672 0.274803C1.40059 0.191925 1.30874 0.124999 1.20653 0.0779162C1.10431 0.0308329 0.993754 0.00453 0.881285 0.000534076C0.768816 -0.00346185 0.656673 0.0149303 0.551372 0.0546406C0.44607 0.0943509 0.349708 0.154588 0.267884 0.231854C0.186059 0.30912 0.120403 0.401874 0.0747284 0.504729C0.029054 0.607584 0.00427197 0.71849 0.0018216 0.831003C-0.000628769 0.943517 0.0193011 1.0554 0.0604544 1.16014C0.101608 1.26489 0.163164 1.36041 0.241547 1.44117L6.91183 8.50477L0.241545 15.5667Z" fill="currentColor" />
    </svg>
);
