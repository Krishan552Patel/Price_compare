import Link from "next/link";

export default function Pagination({
  currentPage,
  totalPages,
  baseUrl,
}: {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push("...");
    for (
      let i = Math.max(2, currentPage - 1);
      i <= Math.min(totalPages - 1, currentPage + 1);
      i++
    ) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
  }

  function buildUrl(page: number) {
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}page=${page}`;
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      {currentPage > 1 && (
        <Link
          href={buildUrl(currentPage - 1)}
          className="px-3 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
        >
          Prev
        </Link>
      )}

      {pages.map((page, i) =>
        page === "..." ? (
          <span key={`ellipsis-${i}`} className="px-2 text-gray-500">
            ...
          </span>
        ) : (
          <Link
            key={page}
            href={buildUrl(page)}
            className={`px-3 py-1 rounded transition ${page === currentPage ? "bg-red-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
          >
            {page}
          </Link>
        )
      )}

      {currentPage < totalPages && (
        <Link
          href={buildUrl(currentPage + 1)}
          className="px-3 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 transition"
        >
          Next
        </Link>
      )}
    </div>
  );
}
