import { CloudRain, Sun, Droplets, Wind, Cloud } from 'lucide-react';

export default function WeatherWidget({ weather }: { weather: any }) {
  // Mock data if not provided
  const data = weather || { 
    current: { temp: 32, condition: 'Sunny', humidity: 45, wind: 12 },
    nextDay: { tempHigh: 34, tempLow: 22, forecastRain: 0, condition: 'Sunny' }
  };
  
  const { current, nextDay } = data;

  const getWeatherIcon = (condition: string, className: string) => {
    if (condition.includes('Rain')) return <CloudRain className={className} />;
    if (condition.includes('Cloud')) return <Cloud className={className} />;
    return <Sun className={className} />;
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm h-full flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Live Weather</h3>
          <span className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
            Now
          </span>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
            {getWeatherIcon(current.condition, "w-8 h-8 text-amber-500")}
          </div>
          <div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold text-slate-900 tracking-tighter">
                {Math.round(current.temp)}°
              </span>
            </div>
            <span className="text-sm text-slate-500 font-medium">{current.condition}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Droplets className="w-4 h-4 text-indigo-500" />
            <span>{Math.round(current.humidity)}% Hum</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Wind className="w-4 h-4 text-slate-400" />
            <span>{Math.round(current.wind)} km/h</span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-900">Tomorrow</span>
          <span className="text-xs text-slate-500">{nextDay.condition}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getWeatherIcon(nextDay.condition, "w-5 h-5 text-slate-400")}
            <span className="text-sm text-slate-700 font-medium">
              {Math.round(nextDay.tempHigh)}° / {Math.round(nextDay.tempLow)}°
            </span>
          </div>
          {nextDay.forecastRain > 0 && (
            <div className="flex items-center gap-1 text-xs text-indigo-700 font-medium bg-indigo-50 px-2 py-1 rounded-full">
              <CloudRain className="w-3 h-3" />
              {nextDay.forecastRain.toFixed(1)}mm
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
