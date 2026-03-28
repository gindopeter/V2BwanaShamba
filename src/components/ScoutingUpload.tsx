import { useState, useRef } from 'react';
import { Camera, Upload, Loader2, AlertTriangle, CheckCircle } from 'lucide-react';
import { analyzeCropImage, Zone } from '../lib/api';

export default function ScoutingUpload({ zones, onAnalysisComplete }: { zones: Zone[], onAnalysisComplete: () => void }) {
  const [selectedZone, setSelectedZone] = useState(zones[0]?.id || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setResult(null);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];

      try {
        const response = await analyzeCropImage(Number(selectedZone), base64Data);
        setResult(response.analysis);
        onAnalysisComplete();
      } catch (error) {
        console.error(error);
        setResult("Error analyzing image.");
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-[#002c11]/5">
      <h3 className="font-bold text-[#002c11] mb-4 flex items-center gap-2">
        <Camera className="w-5 h-5 text-[#035925]" />
        AI Crop Scout
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#5d6c7b] mb-1 uppercase">Select Zone</label>
          <select 
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="w-full rounded-lg border-[#002c11]/10 text-sm focus:border-emerald-500 focus:ring-emerald-500"
          >
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.name} ({z.crop_type})</option>
            ))}
          </select>
        </div>

        <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[#002c11]/10 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-[#035925]/5 transition-colors"
        >
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
            />
            {isAnalyzing ? (
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-[#035925] animate-spin mx-auto mb-2" />
                    <p className="text-sm text-[#5d6c7b]">Analyzing crop health...</p>
                </div>
            ) : (
                <div className="text-center">
                    <Upload className="w-8 h-8 text-[#5d6c7b]/60 mx-auto mb-2" />
                    <p className="text-sm font-medium text-[#5d6c7b]">Upload Photo</p>
                    <p className="text-xs text-[#5d6c7b]/60 mt-1">Detect pests & diseases</p>
                </div>
            )}
        </div>

        {result && (
            <div className="bg-[#f9f6f1] rounded-lg p-3 text-sm border border-[#002c11]/5">
                <p className="font-medium text-[#002c11] mb-1">Analysis Result:</p>
                <p className="text-[#5d6c7b]">{result}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-[#035925] font-medium">
                    <CheckCircle className="w-3 h-3" />
                    Task created automatically
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
