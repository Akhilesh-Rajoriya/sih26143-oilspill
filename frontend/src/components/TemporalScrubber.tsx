import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';

interface TemporalScrubberProps {
  timeOffset: number; // in hours: -48 to +48
  onChangeTimeOffset: (hours: number) => void;
  detectionTimestamp?: string;
}

export const TemporalScrubber: React.FC<TemporalScrubberProps> = ({
  timeOffset,
  onChangeTimeOffset,
  detectionTimestamp,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  // Play animation loop
  useEffect(() => {
    let interval: any = null;
    if (isPlaying) {
      interval = setInterval(() => {
        if (timeOffset >= 24) {
          setIsPlaying(false);
        } else {
          onChangeTimeOffset(timeOffset + 1);
        }
      }, 400);
    }
    return () => clearInterval(interval);
  }, [isPlaying, timeOffset, onChangeTimeOffset]);

  // Compute displayed timestamp
  const getFormattedTime = () => {
    const base = detectionTimestamp ? new Date(detectionTimestamp) : new Date('2024-01-03T10:00:00Z');
    const adjusted = new Date(base.getTime() + timeOffset * 3600 * 1000);
    return adjusted.toUTCString().replace('GMT', 'UTC');
  };

  return (
    <div className="h-16 bg-tactical-darker/95 backdrop-blur border-t border-tactical-border px-6 flex items-center justify-between z-20 shrink-0 font-mono text-xs select-none">
      {/* Play Controls & Time State */}
      <div className="flex items-center space-x-3 w-72">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2 rounded-md bg-tactical-surface border border-tactical-border text-tactical-accent hover:bg-tactical-accent hover:text-tactical-darkest transition-all"
          title={isPlaying ? 'Pause Animation' : 'Play Drift Simulation'}
        >
          {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
        </button>

        <button
          onClick={() => {
            setIsPlaying(false);
            onChangeTimeOffset(0);
          }}
          className="p-2 rounded-md bg-tactical-surface border border-tactical-border text-slate-400 hover:text-white transition-all"
          title="Reset to Satellite Capture (T=0)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center space-x-1 text-slate-400 text-[10px]">
            <Clock className="w-3 h-3" />
            <span>SIMULATION CLOCK:</span>
          </div>
          <div className="font-bold text-slate-200 text-xs truncate">{getFormattedTime()}</div>
        </div>
      </div>

      {/* Scrubber Slider */}
      <div className="flex-1 max-w-2xl px-6 flex flex-col justify-center">
        <div className="flex justify-between text-[11px] text-slate-400 mb-1">
          <span className={`${timeOffset < 0 ? 'text-tactical-accent font-bold' : ''}`}>
            T-48h (SPILLED ORIGIN)
          </span>
          <span className={`px-2 py-0.5 rounded ${timeOffset === 0 ? 'bg-red-950 text-red-400 font-bold border border-red-800' : ''}`}>
            T₀ (SATELLITE DETECTION)
          </span>
          <span className={`${timeOffset > 0 ? 'text-amber-400 font-bold' : ''}`}>
            T+24h (SHORELINE THREAT)
          </span>
        </div>

        <input
          type="range"
          min="-48"
          max="24"
          step="1"
          value={timeOffset}
          onChange={(e) => onChangeTimeOffset(parseInt(e.target.value))}
          className="w-full h-1.5 bg-tactical-surface rounded-lg appearance-none cursor-pointer accent-tactical-accent focus:outline-none"
        />

        <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
          <span>Hindcast Reconstruction</span>
          <span className="text-tactical-accent font-bold">
            {timeOffset > 0 ? `+${timeOffset}h Forecast` : timeOffset < 0 ? `${timeOffset}h Hindcast` : 'T=0 Satellite Capture'}
          </span>
          <span>Forward Dispersion</span>
        </div>
      </div>

      {/* Mode Badge */}
      <div className="hidden sm:flex items-center space-x-2 w-48 justify-end">
        <div className={`px-2.5 py-1 rounded text-[11px] font-bold border ${
          timeOffset < 0
            ? 'bg-cyan-950 border-cyan-800 text-cyan-400'
            : timeOffset > 0
            ? 'bg-amber-950 border-amber-800 text-amber-400'
            : 'bg-red-950 border-red-800 text-red-400'
        }`}>
          {timeOffset < 0 ? 'HINDCAST BACKTRACK' : timeOffset > 0 ? 'FORWARD PREDICTION' : 'SAR OBSERVATION'}
        </div>
      </div>
    </div>
  );
};
