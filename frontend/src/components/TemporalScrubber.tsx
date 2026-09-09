import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock, SkipBack, SkipForward } from 'lucide-react';

interface TemporalScrubberProps {
  timeOffset: number; // in hours: -48 to +24
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

  // Compute formatted timestamp
  const getFormattedTime = () => {
    const base = detectionTimestamp ? new Date(detectionTimestamp) : new Date('2024-01-03T10:00:00Z');
    const adjusted = new Date(base.getTime() + timeOffset * 3600 * 1000);
    return adjusted.toUTCString().replace('GMT', 'UTC');
  };

  return (
    <div className="h-16 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between z-20 shrink-0 text-xs select-none shadow-sm">
      {/* Play Controls & Time State */}
      <div className="flex items-center space-x-2 w-80">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow-sm active:scale-95"
          title={isPlaying ? 'Pause Simulation' : 'Play Drift Timeline'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>

        <button
          onClick={() => onChangeTimeOffset(Math.max(-48, timeOffset - 1))}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all"
          title="Step Backward (-1 Hour)"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onChangeTimeOffset(Math.min(24, timeOffset + 1))}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all"
          title="Step Forward (+1 Hour)"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            setIsPlaying(false);
            onChangeTimeOffset(0);
          }}
          className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          title="Reset to Satellite Capture Time (T=0)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="flex flex-col ml-1">
          <span className="text-[10px] text-slate-400 font-medium flex items-center space-x-1">
            <Clock className="w-3 h-3 text-blue-400" />
            <span>Simulation Clock:</span>
          </span>
          <span className="font-semibold text-slate-200 text-xs font-mono truncate">{getFormattedTime()}</span>
        </div>
      </div>

      {/* Scrubber Slider with Milestones */}
      <div className="flex-1 max-w-2xl px-6 flex flex-col justify-center">
        <div className="flex justify-between text-[11px] text-slate-400 mb-1 font-medium">
          <span className={`${timeOffset < 0 ? 'text-blue-400 font-semibold' : ''}`}>
            Spill Origin Window (-48h)
          </span>
          <span className={`px-2 py-0.5 rounded-full ${timeOffset === 0 ? 'bg-red-500/20 text-red-300 font-semibold border border-red-500/30' : ''}`}>
            Satellite Detection (T₀)
          </span>
          <span className={`${timeOffset > 0 ? 'text-amber-400 font-semibold' : ''}`}>
            Shoreline Forecast (+24h)
          </span>
        </div>

        <input
          type="range"
          min="-48"
          max="24"
          step="1"
          value={timeOffset}
          onChange={(e) => onChangeTimeOffset(parseInt(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
        />

        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
          <span>Lagrangian Hindcast (Source Tracking)</span>
          <span className="text-blue-400 font-semibold font-mono">
            {timeOffset > 0 ? `+${timeOffset}h Dispersion Forecast` : timeOffset < 0 ? `${timeOffset}h Hindcast Backtrack` : 'T=0 Satellite Capture Instant'}
          </span>
          <span>Forward Dispersion Modeling</span>
        </div>
      </div>

      {/* Mode Badge */}
      <div className="hidden sm:flex items-center space-x-2 w-52 justify-end">
        <div className={`px-3 py-1 rounded-full text-xs font-medium border ${
          timeOffset < 0
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            : timeOffset > 0
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-red-500/10 border-red-500/30 text-red-300'
        }`}>
          {timeOffset < 0 ? 'Hindcast Reconstruction' : timeOffset > 0 ? 'Forward Shoreline Risk' : 'Satellite SAR Capture'}
        </div>
      </div>
    </div>
  );
};

