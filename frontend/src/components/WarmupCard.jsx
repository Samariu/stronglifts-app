import { getWarmupSets, formatPlates } from '../lib/program';

export default function WarmupCard({ exerciseName, workingWeight, barWeight }) {
  const sets = getWarmupSets(workingWeight, barWeight);
  if (sets.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Warmup</h3>
      <div className="space-y-2">
        {sets.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-8 text-xs text-gray-500 text-right">{s.label}</span>
            <span className="w-16 font-mono font-semibold">{s.weight}kg</span>
            <span className="text-xs text-gray-500">{s.reps} reps</span>
            <span className="text-xs text-gray-600 flex-1 text-right">{formatPlates(s.weight, barWeight)}</span>
          </div>
        ))}
        <div className="flex items-center gap-3 border-t border-gray-800 pt-2">
          <span className="w-8 text-xs text-orange-400 text-right">Work</span>
          <span className="w-16 font-mono font-bold text-orange-400">{workingWeight}kg</span>
          <span className="text-xs text-gray-500">5 reps</span>
          <span className="text-xs text-gray-600 flex-1 text-right">{formatPlates(workingWeight, barWeight)}</span>
        </div>
      </div>
    </div>
  );
}
