import React, { useState, useEffect } from 'react';
import { STYLES, ASPECT_RATIOS } from './constants';
import { Scene, ArtStyle, AspectRatio } from './types';
import { generateStoryStructure, generateSceneImage, generateSceneVideo } from './services/geminiService';
import { stitchVideos } from './services/videoStitcher';
import { Button } from './components/Button';
import { SceneCard } from './components/SceneCard';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0: Input, 1: Edit/Review, 2: Production
  const [selectedStyle, setSelectedStyle] = useState<ArtStyle>(ArtStyle.DISNEY);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('16:9');
  const [isLoading, setIsLoading] = useState(false);
  const [isStitching, setIsStitching] = useState(false);
  const [stitchingProgress, setStitchingProgress] = useState(0);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Initial API Key Check for Veo compatibility
  useEffect(() => {
    const checkKey = async () => {
      try {
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(hasKey);
        } else {
          // Fallback if not running in the specific environment expecting this
          setHasApiKey(!!process.env.API_KEY); 
        }
      } catch (e) {
        console.error("Error checking API key", e);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      // Assume success as per instructions to avoid race conditions
      setHasApiKey(true);
      window.location.reload(); // Reload to ensure the new key is picked up by process.env injection
    } else {
        alert("Billing selection is not available in this environment.");
    }
  };

  const handleGenerateStory = async () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    setGlobalError(null);
    try {
      const storyData = await generateStoryStructure(topic);
      setTitle(storyData.title);
      const newScenes: Scene[] = storyData.scenes.map((s, i) => ({
        id: `scene-${Date.now()}-${i}`,
        storyText: s.storyText,
        visualPrompt: s.visualPrompt,
        status: 'pending',
        isSelected: true // Default to selected
      }));
      setScenes(newScenes);
      setStep(1);
    } catch (e: any) {
      setGlobalError(e.message || "Failed to generate story. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateScene = (id: string, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const handleToggleSelect = (id: string) => {
    setScenes(prev => prev.map(s => s.id === id ? { ...s, isSelected: !s.isSelected } : s));
  };

  const handleGenerateImage = async (id: string) => {
    const scene = scenes.find(s => s.id === id);
    if (!scene) return;

    handleUpdateScene(id, { status: 'generating-image', error: undefined });
    try {
      const base64Image = await generateSceneImage(scene.visualPrompt, selectedStyle, selectedAspectRatio);
      handleUpdateScene(id, { 
        status: 'image-ready', 
        imageUrl: base64Image,
        aspectRatio: selectedAspectRatio // Store the ratio used
      });
    } catch (e: any) {
      handleUpdateScene(id, { status: 'error', error: "Image failed: " + e.message });
    }
  };

  const handleGenerateVideo = async (id: string) => {
    const scene = scenes.find(s => s.id === id);
    if (!scene || !scene.imageUrl) return;

    // Check Key again before expensive/paid operation
    if (!hasApiKey) {
        await handleSelectKey();
        return; 
    }

    handleUpdateScene(id, { status: 'generating-video', error: undefined });
    try {
      // Use the ratio stored on the scene if available to match the image, otherwise current selection
      const ratioToUse = scene.aspectRatio || selectedAspectRatio;
      const videoUrl = await generateSceneVideo(scene.imageUrl, scene.visualPrompt, ratioToUse);
      handleUpdateScene(id, { status: 'video-ready', videoUrl: videoUrl });
    } catch (e: any) {
       if (e.message && e.message.includes("Requested entity was not found")) {
         setHasApiKey(false);
         setGlobalError("API Key invalid or expired. Please select a project again.");
         handleUpdateScene(id, { status: 'image-ready' }); // Revert
       } else {
         handleUpdateScene(id, { status: 'error', error: "Video failed: " + e.message });
       }
    }
  };

  // Generate all images at once helper
  const handleGenerateAllImages = async () => {
    setStep(2); // Move to production view
    // Trigger images sequentially to avoid rate limits if any, or parallel if robust
    scenes.forEach(scene => {
        if (!scene.imageUrl) handleGenerateImage(scene.id);
    });
  };

  const handleCombineVideos = async () => {
    const selectedScenes = scenes.filter(s => s.isSelected && s.videoUrl);
    if (selectedScenes.length === 0) return;

    setIsStitching(true);
    setStitchingProgress(0);
    try {
      const urls = selectedScenes.map(s => s.videoUrl!);
      // Use the aspect ratio of the first video, or default
      const ratio = selectedScenes[0].aspectRatio || selectedAspectRatio;
      
      const combinedUrl = await stitchVideos(urls, ratio, (idx, total) => {
        setStitchingProgress(Math.round(((idx + 1) / total) * 100));
      });

      // Auto download
      const a = document.createElement('a');
      a.href = combinedUrl;
      a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_full_movie.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

    } catch (e: any) {
      setGlobalError("Failed to combine videos: " + e.message);
    } finally {
      setIsStitching(false);
    }
  };

  const selectedCount = scenes.filter(s => s.isSelected && s.videoUrl).length;

  if (!hasApiKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl">
                🔐
            </div>
            <h1 className="text-2xl font-bold text-indigo-900 mb-2">Welcome to DreamTales</h1>
            <p className="text-slate-600 mb-8">
                To generate high-quality stories and magical videos with Veo, please connect your Google Cloud project.
            </p>
            <Button onClick={handleSelectKey} className="w-full justify-center">
                Connect Google Cloud Project
            </Button>
            <p className="mt-4 text-xs text-slate-400">
                Uses Gemini 3 Pro & Veo. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="underline hover:text-indigo-600">Billing info</a>
            </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✨</span>
            <h1 className="font-bold text-xl tracking-tight text-indigo-900">DreamTales AI</h1>
          </div>
          {step > 0 && (
            <button onClick={() => setStep(0)} className="text-sm font-medium text-slate-500 hover:text-indigo-600">
              New Story
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        
        {globalError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
             <span>⚠️</span>
             {globalError}
          </div>
        )}

        {/* Step 0: Input */}
        {step === 0 && (
          <div className="max-w-2xl mx-auto mt-12 text-center space-y-8">
            <div className="space-y-4">
              <h2 className="text-4xl font-extrabold text-slate-900 leading-tight">
                Create a magical <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">Children's Book</span> in seconds.
              </h2>
              <p className="text-lg text-slate-600">
                Enter a topic, and we'll write the story, draw the pictures, and animate them!
              </p>
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-lg border border-slate-200 flex flex-col md:flex-row gap-2">
              <input 
                type="text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., A brave bunny who wants to fly to the moon..."
                className="flex-1 p-4 bg-transparent outline-none text-slate-800 placeholder:text-slate-400"
                onKeyDown={(e) => e.key === 'Enter' && handleGenerateStory()}
              />
              <Button 
                onClick={handleGenerateStory} 
                disabled={!topic.trim()} 
                isLoading={isLoading}
                className="md:w-auto w-full"
              >
                Generate Story
              </Button>
            </div>

            <div className="flex flex-wrap justify-center gap-2 text-sm text-slate-500">
               <span>Ideas:</span>
               <button onClick={() => setTopic("A robot who loves gardening")} className="px-3 py-1 bg-white border rounded-full hover:border-indigo-400 transition-colors">🤖 Gardening Robot</button>
               <button onClick={() => setTopic("A kitten lost in a candy kingdom")} className="px-3 py-1 bg-white border rounded-full hover:border-indigo-400 transition-colors">🐱 Candy Kitten</button>
               <button onClick={() => setTopic("A dragon who breathes bubbles")} className="px-3 py-1 bg-white border rounded-full hover:border-indigo-400 transition-colors">🐉 Bubble Dragon</button>
            </div>
          </div>
        )}

        {/* Step 1 & 2: Editor & Production */}
        {step >= 1 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <div>
                  <h2 className="text-3xl font-bold text-slate-900">{title || "Untitled Story"}</h2>
                  <p className="text-slate-500">Review your story and generate the magic.</p>
               </div>
               
               {step === 1 && (
                 <div className="flex flex-col items-end gap-2">
                     <div className="flex gap-2">
                        {/* Aspect Ratio Selector */}
                        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200">
                            <span className="text-xs font-bold text-slate-400 px-2 uppercase">Size</span>
                            <select 
                                value={selectedAspectRatio} 
                                onChange={(e) => setSelectedAspectRatio(e.target.value as AspectRatio)}
                                className="text-sm font-semibold text-indigo-700 bg-transparent outline-none cursor-pointer pr-2"
                            >
                                {ASPECT_RATIOS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>

                        {/* Style Selector */}
                        <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-slate-200">
                            <span className="text-xs font-bold text-slate-400 px-2 uppercase">Style</span>
                            <select 
                                value={selectedStyle} 
                                onChange={(e) => setSelectedStyle(e.target.value as ArtStyle)}
                                className="text-sm font-semibold text-indigo-700 bg-transparent outline-none cursor-pointer pr-2"
                            >
                                {STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                     </div>
                     <Button onClick={handleGenerateAllImages}>
                        Create Illustrations &rarr;
                     </Button>
                 </div>
               )}
            </div>

            {/* Scene Grid */}
            <div className="grid grid-cols-1 gap-8">
              {scenes.map((scene, index) => (
                <SceneCard
                  key={scene.id}
                  index={index}
                  scene={scene}
                  onUpdate={handleUpdateScene}
                  onGenerateImage={handleGenerateImage}
                  onGenerateVideo={handleGenerateVideo}
                  onToggleSelect={handleToggleSelect}
                  isGeneratingAny={isLoading || isStitching}
                />
              ))}
            </div>

          </div>
        )}
      </main>

      {/* Floating Movie Maker Bar */}
      {selectedCount > 0 && (
         <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-md border border-indigo-100 shadow-2xl rounded-full p-2 pl-6 pr-2 flex items-center gap-4 animate-in slide-in-from-bottom-10 z-50">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-indigo-900">Movie Maker</span>
              <span className="text-xs text-indigo-500">{selectedCount} scene{selectedCount > 1 ? 's' : ''} selected</span>
            </div>
            <Button 
              onClick={handleCombineVideos} 
              isLoading={isStitching}
              className="rounded-full px-6"
            >
               {isStitching ? `Merging ${stitchingProgress}%` : '🎬 Export Movie'}
            </Button>
         </div>
      )}
    </div>
  );
};

export default App;