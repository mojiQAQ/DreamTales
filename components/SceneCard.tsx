import React from 'react';
import { Scene } from '../types';
import { Button } from './Button';

interface SceneCardProps {
  scene: Scene;
  index: number;
  onUpdate: (id: string, updates: Partial<Scene>) => void;
  onGenerateImage: (id: string) => void;
  onGenerateVideo: (id: string) => void;
  onToggleSelect: (id: string) => void;
  isGeneratingAny: boolean;
}

export const SceneCard: React.FC<SceneCardProps> = ({
  scene,
  index,
  onUpdate,
  onGenerateImage,
  onGenerateVideo,
  onToggleSelect,
  isGeneratingAny
}) => {
  
  const handleDownload = (url: string, type: 'image' | 'video') => {
    const a = document.createElement('a');
    a.href = url;
    a.download = `scene-${index + 1}-${type}.${type === 'video' ? 'mp4' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const hasVideo = !!scene.videoUrl;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border transition-all duration-200 flex flex-col md:flex-row overflow-hidden ${scene.isSelected ? 'border-indigo-500 ring-2 ring-indigo-500 ring-offset-2' : 'border-slate-100'}`}>
      
      {/* Visual Side */}
      <div className="md:w-1/2 h-80 md:h-auto bg-slate-50 relative border-b md:border-b-0 md:border-r border-slate-100 flex items-center justify-center p-4 group">
        
        {/* Selection Checkbox (Only if video exists) */}
        {hasVideo && (
           <div className="absolute top-4 left-4 z-20">
              <label className="flex items-center gap-2 cursor-pointer bg-white/90 backdrop-blur px-3 py-1.5 rounded-full shadow-sm hover:bg-white transition-colors">
                <input 
                  type="checkbox" 
                  checked={!!scene.isSelected} 
                  onChange={() => onToggleSelect(scene.id)}
                  className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
                />
                <span className="text-xs font-bold text-slate-700">Include in Movie</span>
              </label>
           </div>
        )}

        {scene.imageUrl ? (
          scene.videoUrl ? (
             <video 
                src={scene.videoUrl} 
                controls 
                className="w-full h-full object-contain rounded-lg shadow-sm"
                loop
                muted // Muted by default in card to avoid noise
             />
          ) : (
            <img 
              src={scene.imageUrl} 
              alt={`Scene ${index + 1}`} 
              className="w-full h-full object-contain rounded-lg shadow-sm"
            />
          )
        ) : (
          <div className="text-center text-slate-400 p-6">
            <span className="text-4xl block mb-2">🖼️</span>
            <p className="text-sm">Image not generated yet</p>
          </div>
        )}

        {/* Loading Overlay */}
        {(scene.status === 'generating-image' || scene.status === 'generating-video') && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center flex-col z-10">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full mb-2"></div>
            <p className="text-indigo-600 font-medium text-sm">
              {scene.status === 'generating-image' ? 'Painting...' : 'Animating...'}
            </p>
          </div>
        )}
      </div>

      {/* Content Side */}
      <div className="md:w-1/2 p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
            Page {index + 1}
          </span>
          {scene.status === 'error' && (
            <span className="text-red-500 text-xs">{scene.error}</span>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Story Text</label>
          <textarea
            value={scene.storyText}
            onChange={(e) => onUpdate(scene.id, { storyText: e.target.value })}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none h-24"
            placeholder="The story text for this page..."
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Visual Description (Prompt)</label>
          <textarea
            value={scene.visualPrompt}
            onChange={(e) => onUpdate(scene.id, { visualPrompt: e.target.value })}
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none h-20 text-slate-600"
            placeholder="Describe what the image should look like..."
          />
        </div>

        <div className="mt-auto pt-4 flex flex-wrap gap-2">
          {!scene.imageUrl && (
             <Button 
                onClick={() => onGenerateImage(scene.id)} 
                disabled={isGeneratingAny || scene.status === 'generating-image'}
                className="w-full text-sm"
             >
                Generate Image
             </Button>
          )}

          {scene.imageUrl && !scene.videoUrl && (
             <div className="flex gap-2 w-full">
                <Button 
                    variant="outline" 
                    onClick={() => onGenerateImage(scene.id)} // Re-roll
                    disabled={isGeneratingAny || scene.status === 'generating-video'}
                    className="flex-1 text-sm"
                >
                    Regenerate Image
                </Button>
                <Button 
                    onClick={() => onGenerateVideo(scene.id)}
                    disabled={isGeneratingAny || scene.status === 'generating-video'}
                    className="flex-1 text-sm bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 border-none"
                >
                    🎥 Animate
                </Button>
             </div>
          )}

          {/* Export Actions */}
          {scene.imageUrl && (
            <div className="flex gap-2 w-full mt-2 pt-2 border-t border-slate-100">
               <button onClick={() => handleDownload(scene.imageUrl!, 'image')} className="text-xs text-slate-500 hover:text-indigo-600 underline">
                 Download Image
               </button>
               {scene.videoUrl && (
                 <button onClick={() => handleDownload(scene.videoUrl!, 'video')} className="text-xs text-slate-500 hover:text-indigo-600 underline">
                   Download Video
                 </button>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};