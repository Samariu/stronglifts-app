import { useState } from 'react';
import { getPlatesPerSide, roundToNearest, ALL_PLATE_SIZES } from '../lib/program';

export default function PlateCalculator({ barWeight = 20, availablePlates = ALL_PLATE_SIZES }) {
  const [target, setTarget] = useState(60);

  const plates = getPlatesPerSide(target, barWeight, availablePlates);
  const counts = {};
  for (const p of plates) counts[p] = (counts[p] || 0) + 1;

  const PLATE_COLORS = {
    25: 'bg-red-500',
    20: 'bg-blue-500',
    15: 'bg-yellow-500',
    10: 'bg-green-500',
    5: 'bg-white text-gray-900',
    2.5: 'bg-gray-300 text-gray-900',
    1.25: 'bg-gray-500',
  };

  return (
    <div className="bg-gray-900 rounded-2xl p-4 space-y-4">
      <h3 className="font-semibold text-lg">Plate Calculator</h3>
      <div className="flex gap-3 items-center">
        <button
          onClick={() => setTarget((t) => Math.max(barWeight, roundToNearest(t - 2.5, 2.5)))}
          className="w-12 h-12 bg-gray-800 rounded-xl text-xl font-bold hover:bg-gray-700"
        >−</button>
        <input
          type="number"
          value={target}
          onChange={(e) => setTarget(Number(e.target.value))}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-white text-center text-xl font-mono"
          step={2.5}
        />
        <span className="text-gray-400 text-sm">kg</span>
        <button
          onClick={() => setTarget((t) => roundToNearest(t + 2.5, 2.5))}
          className="w-12 h-12 bg-gray-800 rounded-xl text-xl font-bold hover:bg-gray-700"
        >+</button>
      </div>

      <div className="bg-gray-800 rounded-xl p-3 space-y-2">
        <div className="text-xs text-gray-500 text-center">Bar ({barWeight}kg) + each side:</div>
        {plates.length === 0 ? (
          <div className="text-center text-gray-400 text-sm">Bar only</div>
        ) : (
          <div className="flex flex-wrap gap-2 justify-center">
            {Object.entries(counts).map(([p, c]) => (
              <div key={p} className={`${PLATE_COLORS[p] || 'bg-gray-600'} rounded-lg px-3 py-1.5 text-sm font-bold`}>
                {c}×{p}kg
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="text-center text-xs text-gray-600">
        = bar + {plates.reduce((s, p) => s + p, 0) * 2}kg = {barWeight + plates.reduce((s, p) => s + p, 0) * 2}kg total
      </div>
    </div>
  );
}
