import React from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { LatencyState } from '../types/trading.types';

export interface LatencyIndicatorProps {
  latencyState: LatencyState;
}

export const LatencyIndicator: React.FC<LatencyIndicatorProps> = ({ latencyState }) => {
  const { latencyMs, status, isConnected } = latencyState;

  const getStatusDetails = () => {
    if (!isConnected || status === 'disconnected') {
      return {
        label: 'Disconnected',
        colorClass: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
        dotClass: 'bg-gray-400',
      };
    }

    if (status === 'good') {
      return {
        label: `${latencyMs} ms`,
        colorClass: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        dotClass: 'bg-emerald-400 animate-pulse',
      };
    }

    if (status === 'moderate') {
      return {
        label: `${latencyMs} ms`,
        colorClass: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        dotClass: 'bg-amber-400',
      };
    }

    return {
      label: `${latencyMs} ms`,
      colorClass: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      dotClass: 'bg-rose-400',
    };
  };

  const details = getStatusDetails();

  return (
    <div
      data-testid="latency-indicator"
      className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded-full text-xs font-mono border transition-colors ${details.colorClass}`}
      title={`WebSocket Status: ${isConnected ? 'Connected' : 'Disconnected'} (${latencyMs}ms)`}
    >
      <span className={`h-2 w-2 rounded-full ${details.dotClass}`} />
      {isConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span>{details.label}</span>
    </div>
  );
};
