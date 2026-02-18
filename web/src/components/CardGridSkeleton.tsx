export default function CardGridSkeleton({ count = 24 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden animate-pulse"
        >
          {/* Image placeholder */}
          <div className="aspect-[5/7] bg-gray-800" />
          {/* Text placeholder */}
          <div className="p-3 space-y-2">
            <div className="h-4 bg-gray-800 rounded w-3/4" />
            <div className="h-3 bg-gray-800 rounded w-1/2" />
            <div className="flex items-center justify-between mt-2">
              <div className="h-3 w-3 bg-gray-800 rounded-full" />
              <div className="h-4 bg-gray-800 rounded w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
