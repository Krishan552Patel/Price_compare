import Image from "next/image";

export default function CardImage({
  src,
  alt,
  width = 300,
  height = 420,
  className = "",
}: {
  src: string | null;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (!src) {
    return (
      <div
        className={`bg-gray-800 rounded-lg flex items-center justify-center text-gray-500 ${className}`}
        style={{ width, height }}
      >
        <span className="text-sm">No Image</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={`rounded-lg ${className}`}
      unoptimized
    />
  );
}
