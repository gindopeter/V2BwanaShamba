export default function WeatherWidget({ weather }: { weather: any }) {
  const data = weather || {
    current: { temp: 28, condition: 'Loading...', humidity: 72, wind: 12 },
    nextDay: { tempHigh: 30, tempLow: 22, forecastRain: 0, condition: 'Sunny' }
  };

  const { current } = data;

  return (
    <div className="bg-[#002c11] rounded-xl p-4 text-white">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-end gap-2">
          <span className="text-2xl font-black" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>{Math.round(current.temp)}°</span>
          <span className="text-white/50 text-xs mb-0.5 font-medium">{current.condition}</span>
        </div>
        <span className="text-lg">🌤️</span>
      </div>
      {data.location && (
        <p className="text-[10px] text-white/40 mb-1.5">📍 {data.location}</p>
      )}
      <div className="flex gap-3 text-[10px] text-white/40">
        <span>Humidity <span className="text-white font-bold">{Math.round(current.humidity)}%</span></span>
        <span>Wind <span className="text-white font-bold">{Math.round(current.wind)} km/h</span></span>
      </div>
    </div>
  );
}
