"use client";

import { useEffect } from "react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Cards Page Error:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
            <h2 className="text-2xl font-bold mb-4 text-red-500">Something went wrong!</h2>
            <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 mb-6 max-w-2xl w-full overflow-auto">
                <p className="text-gray-300 font-mono text-sm whitespace-pre-wrap">
                    {error.message || "Unknown error occurred"}
                </p>
                {error.digest && (
                    <p className="text-gray-500 text-xs mt-2">Digest: {error.digest}</p>
                )}
            </div>
            <button
                onClick={() => reset()}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
            >
                Try again
            </button>
        </div>
    );
}
