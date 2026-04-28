import { getWarmupSets, formatPlates } from '../lib/program';

export default function WarmupCard({ workingWeight, barWeight, availablePlates, restSeconds, onStartWorkingSets }) {
  const sets = getWarmupSets(workingWeight, barWeight, availablePlates);
  if (sets.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-xl p-3 space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Warmup — {sets.length} sets
      </h3>
      <div className="space-y-1.5">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="w-5 text-gray-600 text-xs text-right">{i + 1}</span>
            <span className="w-14 font-mono font-semibold">{s.weight}kg</span>
            <span className="text-xs text-gray-500">×{s.reps}</span>
            <span className="text-xs text-gray-600 flex-1 text-right">
              {formatPlates(s.weight, barWeight, availablePlates)}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-3 text-sm border-t border-gray-700 pt-2">
          <span className="w-5 text-orange-400 text-xs text-right">▶</span>
          <span className="w-14 font-mono font-bold text-orange-400">{workingWeight}kg</span>
          <span className="text-xs text-gray-500">5×5</span>
          <span className="text-xs text-gray-600 flex-1 text-right">
            {formatPlates(workingWeight, barWeight, availablePlates)}
          </span>
        </div>
      </div>
      {onStartWorkingSets && (
        <button
          onClick={() => onStartWorkingSets(restSeconds)}
          className="w-full mt-1 py-2 rounded-xl text-sm font-semibold bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 active:scale-95 transition-all border border-orange-500/20"
        >
          Done — start rest timer
        </button>
      )}
    </div>
  );
}
