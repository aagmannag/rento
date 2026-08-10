export default function Stars({ rating, count }: { rating: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700">
      <span className="flex items-center gap-0.5 rounded bg-green-600 px-1.5 py-0.5 text-white">
        {rating.toFixed(1)} ★
      </span>
      {typeof count === "number" && <span className="text-gray-400">({count})</span>}
    </span>
  );
}
