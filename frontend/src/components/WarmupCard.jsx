import { formatPlates } from '../lib/program';
import { formatWeight } from '../lib/units';

// Ramp-up tracker. The warmup sets themselves are computed by the caller
// (TodayView needs the count for its collapsed progress label) and passed in;
// this component owns the per-set tap interaction.
//
// Progress is a single count of completed sets rather than a per-set array:
// a ramp is done strictly in order, so "how far up the ramp am I" is one number.
export default function WarmupCard({
  sets,
  workingWeight,
  workLabel = '5×5',
  barWeight,
  availablePlates,
  unit = 'kg',
  completedCount = 0,
  onLogSet,
  onUndoSet,
  onSkip,
}) {
  if (!sets || sets.length === 0) return null;

  const allDone = completedCount >= sets.length;

  return (
    <div className="bg-gray-800 rounded-xl p-3 space-y-2">
      <h3 className="flex items-center justify-between text-xs font-semibold text-gray-400 uppercase tracking-wider">
        <span>Warmup — {sets.length} sets</span>
        <span className={allDone ? 'text-green-500' : 'text-orange-400'}>
          {completedCount}/{sets.length}
        </span>
      </h3>

      <div className="space-y-1.5">
        {sets.map((s, i) => {
          const isDone = i < completedCount;
          const isNext = i === completedCount;
          return (
            <button
              key={i}
              type="button"
              disabled={!isNext}
              onClick={() => isNext && onLogSet?.()}
              className={`w-full flex items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm border transition-all ${
                isDone
                  ? 'bg-green-900/25 border-green-900/40'
                  : isNext
                  ? 'bg-orange-500/15 border-orange-500/40 active:scale-[0.98]'
                  : 'border-transparent opacity-50'
              }`}
            >
              <span
                className={`w-5 text-xs text-right ${
                  isDone ? 'text-green-500' : isNext ? 'text-orange-400' : 'text-gray-600'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </span>
              <span
                className={`w-14 font-mono font-semibold ${isDone ? 'text-gray-500 line-through' : ''}`}
              >
                {formatWeight(s.weight, unit)}
              </span>
              <span className="text-xs text-gray-500">×{s.reps}</span>
              <span className="text-xs text-gray-600 flex-1 text-right">
                {formatPlates(s.weight, barWeight, availablePlates, unit)}
              </span>
            </button>
          );
        })}

        <div className="flex items-center gap-3 border-t border-gray-700 px-2 pt-2 text-sm">
          <span className="w-5 text-right text-xs text-orange-400">▶</span>
          <span className="w-14 font-mono font-bold text-orange-400">
            {formatWeight(workingWeight, unit)}
          </span>
          <span className="text-xs text-gray-500">{workLabel}</span>
          <span className="flex-1 text-right text-xs text-gray-600">
            {formatPlates(workingWeight, barWeight, availablePlates, unit)}
          </span>
        </div>
      </div>

      <p className="px-2 text-[11px] leading-tight text-gray-600">
        {allDone
          ? 'Warmed up — rest, then go for your working sets.'
          : 'No rest between warmup sets. The rest timer starts after the last one.'}
      </p>

      <div className="flex gap-2">
        {!allDone && onSkip && (
          <button
            onClick={onSkip}
            className="flex-1 rounded-xl border border-orange-500/20 bg-orange-500/20 py-2 text-sm font-semibold text-orange-400 transition-all hover:bg-orange-500/30 active:scale-95"
          >
            Skip to working sets
          </button>
        )}
        {completedCount > 0 && onUndoSet && (
          <button
            onClick={onUndoSet}
            className={`rounded-xl bg-gray-700 py-2 text-sm font-medium text-gray-300 hover:bg-gray-600 ${
              allDone ? 'flex-1' : 'px-4'
            }`}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
