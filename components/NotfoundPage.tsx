"use client";

import { useRouter } from 'next/navigation';

export const NotfoundPage = () => {
    const router = useRouter();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <h1 className="text-6xl font-bold text-gray-800 mb-4">404</h1>
            <p className="text-xl text-gray-600 mb-8">Page Not Found</p>
            <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-accentLight text-neutral rounded hover:bg-accentBase"
            >
                Go Back
            </button>
        </div>
    );
};
