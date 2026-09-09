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
    <div className="h-[72px] min-h-[72px] bg-slate-900 border-t border-slate-800 px-4 lg:px-6 flex items-center justify-between z-20 shrink-0 text-xs select-none shadow-sm gap-3">
      {/* Play Controls & Time State */}
      <div className="flex items-center space-x-1.5 shrink-0">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition-all shadow-sm active:scale-95 shrink-0"
          title={isPlaying ? 'Pause Simulation' : 'Play Drift Timeline'}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>

        <button
          onClick={() => onChangeTimeOffset(Math.max(-48, timeOffset - 1))}
          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all shrink-0"
          title="Step Backward (-1 Hour)"
        >
          <SkipBack className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onChangeTimeOffset(Math.min(24, timeOffset + 1))}
          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-all shrink-0"
          title="Step Forward (+1 Hour)"
        >
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            setIsPlaying(false);
            onChangeTimeOffset(0);
          }}
          className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all shrink-0"
          title="Reset to Satellite Capture Time (T=0)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <div className="flex flex-col ml-1 shrink-0">
          <span className="text-[10px] text-slate-400 font-medium flex items-center space-x-1 leading-tight">
            <Clock className="w-3 h-3 text-blue-400 shrink-0" />
            <span>Simulation Clock:</span>
          </span>
          <span className="font-semibold text-slate-200 text-[11px] font-mono whitespace-nowrap leading-tight">
            {getFormattedTime()}
          </span>
        </div>
      </div>

      {/* Scrubber Slider with Milestones */}
      <div className="flex-1 min-w-0 max-w-2xl px-3 lg:px-6 flex flex-col justify-center space-y-1">
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-medium leading-none">
          <span className={`whitespace-nowrap ${timeOffset < 0 ? 'text-blue-400 font-semibold' : ''}`}>
            (-48h) Hindcast Origin
          </span>
          <span className={`whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${timeOffset === 0 ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'text-slate-300'}`}>
            Satellite Detection (T₀)
          </span>
          <span className={`whitespace-nowrap ${timeOffset > 0 ? 'text-amber-400 font-semibold' : ''}`}>
            (+24h) Shoreline Forecast
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

        <div className="flex justify-between items-center text-[10px] text-slate-500 leading-none">
          <span className="whitespace-nowrap">Backtracking</span>
          <span className="whitespace-nowrap text-blue-400 font-semibold font-mono bg-slate-800/80 border border-slate-700/60 px-2 py-0.5 rounded text-[10px]">
            {timeOffset > 0 ? `+${timeOffset}h Dispersion Forecast` : timeOffset < 0 ? `${timeOffset}h Hindcast Backtrack` : 'T=0 Detection Capture'}
          </span>
          <span className="whitespace-nowrap">Shoreline Risk</span>
        </div>
      </div>

      {/* Mode Badge */}
      <div className="hidden sm:flex items-center space-x-2 w-44 justify-end shrink-0">
        <div className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
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

