function AsientosStatusComponent() {
  return (
    <div className='flex items-center gap-x-3 text-xs my-4 justify-end'>
        <div className='flex items-center gap-x-2'>
            <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3.5 18C4.33 18 5 17.33 5 16.5V15H15V16.5C15 17.33 15.67 18 16.5 18C17.33 18 18 17.33 18 16.5V14C18 12.9 17.1 12 16 12H4C2.9 12 2 12.9 2 14V16.5C2 17.33 2.67 18 3.5 18ZM18 7H19C19.55 7 20 7.45 20 8V9C20 9.55 19.55 10 19 10H18C17.45 10 17 9.55 17 9V8C17 7.45 17.45 7 18 7ZM1 7H2C2.55 7 3 7.45 3 8V9C3 9.55 2.55 10 2 10H1C0.45 10 0 9.55 0 9V8C0 7.45 0.45 7 1 7ZM15 10H5V2C5 0.9 5.9 0 7 0H13C14.1 0 15 0.9 15 2V10Z" fill="#71717A"/>
            </svg>
            <span className='text-gray-800'>Reservado</span>
        </div>
        <div className='flex items-center gap-x-2'>
            <svg width="20" height="18" viewBox="0 0 20 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_3372_85057)">
                <g clipPath="url(#clip1_3372_85057)">
                <path d="M3.5 18C4.33 18 5 17.33 5 16.5V15H15V16.5C15 17.33 15.67 18 16.5 18C17.33 18 18 17.33 18 16.5V14C18 12.9 17.1 12 16 12H4C2.9 12 2 12.9 2 14V16.5C2 17.33 2.67 18 3.5 18ZM18 7H19C19.55 7 20 7.45 20 8V9C20 9.55 19.55 10 19 10H18C17.45 10 17 9.55 17 9V8C17 7.45 17.45 7 18 7ZM1 7H2C2.55 7 3 7.45 3 8V9C3 9.55 2.55 10 2 10H1C0.45 10 0 9.55 0 9V8C0 7.45 0.45 7 1 7ZM15 12H5V2C5 0.9 5.9 0 7 0H13C14.1 0 15 0.9 15 2V12Z" fill="#EF4444"/>
                <g filter="url(#filter0_d_3372_85057)">
                <path d="M7.25 5.75C7.25 5.02065 7.53973 4.32118 8.05546 3.80546C8.57118 3.28973 9.27065 3 10 3C10.7293 3 11.4288 3.28973 11.9445 3.80546C12.4603 4.32118 12.75 5.02065 12.75 5.75C12.75 6.47935 12.4603 7.17882 11.9445 7.69454C11.4288 8.21027 10.7293 8.5 10 8.5C9.27065 8.5 8.57118 8.21027 8.05546 7.69454C7.53973 7.17882 7.25 6.47935 7.25 5.75ZM5.5 11.5C5.5 10.837 5.76339 10.2011 6.23223 9.73223C6.70107 9.26339 7.33696 9 8 9H12C12.663 9 13.2989 9.26339 13.7678 9.73223C14.2366 10.2011 14.5 10.837 14.5 11.5V13H5.5V11.5Z" fill="#F4F4F5"/>
                </g>
                </g>
                </g>
                <defs>
                <filter id="filter0_d_3372_85057" x="4.5" y="3" width="11" height="12" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                <feFlood floodOpacity="0" result="BackgroundImageFix"/>
                <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
                <feOffset dy="1"/>
                <feGaussianBlur stdDeviation="0.5"/>
                <feComposite in2="hardAlpha" operator="out"/>
                <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 0"/>
                <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_3372_85057"/>
                <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_3372_85057" result="shape"/>
                </filter>
                <clipPath id="clip0_3372_85057">
                <rect width="20" height="18" fill="white"/>
                </clipPath>
                <clipPath id="clip1_3372_85057">
                <rect width="20" height="18" fill="white"/>
                </clipPath>
                </defs>
            </svg>
            <span className='text-gray-800'>Vendido</span>
        </div>
        <div className='flex items-center gap-x-2'>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.5 21C6.33 21 7 20.33 7 19.5V18H17V19.5C17 20.33 17.67 21 18.5 21C19.33 21 20 20.33 20 19.5V17C20 15.9 19.1 15 18 15H6C4.9 15 4 15.9 4 17V19.5C4 20.33 4.67 21 5.5 21ZM20 10H21C21.55 10 22 10.45 22 11V12C22 12.55 21.55 13 21 13H20C19.45 13 19 12.55 19 12V11C19 10.45 19.45 10 20 10ZM3 10H4C4.55 10 5 10.45 5 11V12C5 12.55 4.55 13 4 13H3C2.45 13 2 12.55 2 12V11C2 10.45 2.45 10 3 10ZM17 13H7V5C7 3.9 7.9 3 9 3H15C16.1 3 17 3.9 17 5V13Z" fill="#71717A"/>
                <rect x="0.5" y="0.5" width="23" height="23" rx="11.5" fill="#112D6A"/>
                <rect x="0.5" y="0.5" width="23" height="23" rx="11.5" stroke="#3B82F6"/>
                <rect x="0.5" y="0.5" width="23" height="23" rx="11.5" stroke="black" strokeOpacity="0.2"/>
                <path d="M8.33333 9.00016C8.33333 8.0277 8.71964 7.09507 9.40727 6.40744C10.0949 5.7198 11.0275 5.3335 12 5.3335C12.9725 5.3335 13.9051 5.7198 14.5927 6.40744C15.2804 7.09507 15.6667 8.0277 15.6667 9.00016C15.6667 9.97262 15.2804 10.9053 14.5927 11.5929C13.9051 12.2805 12.9725 12.6668 12 12.6668C11.0275 12.6668 10.0949 12.2805 9.40727 11.5929C8.71964 10.9053 8.33333 9.97262 8.33333 9.00016ZM6 16.6668C6 15.7828 6.35119 14.9349 6.97631 14.3098C7.60143 13.6847 8.44928 13.3335 9.33333 13.3335H14.6667C15.5507 13.3335 16.3986 13.6847 17.0237 14.3098C17.6488 14.9349 18 15.7828 18 16.6668V18.6668H6V16.6668Z" fill="white"/>
            </svg>
            <span className='text-gray-800'>Seleccionado</span>
        </div>
    </div>
  )
}

export default AsientosStatusComponent
