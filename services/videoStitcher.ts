import { AspectRatio } from "../types";

const getDimensions = (ratio: AspectRatio): { width: number; height: number } => {
  switch (ratio) {
    case '16:9': return { width: 1280, height: 720 };
    case '9:16': return { width: 720, height: 1280 };
    case '1:1': return { width: 1024, height: 1024 };
    case '4:3': return { width: 1024, height: 768 };
    case '3:4': return { width: 768, height: 1024 };
    default: return { width: 1280, height: 720 };
  }
};

export const stitchVideos = async (
  videoUrls: string[],
  aspectRatio: AspectRatio,
  onProgress: (currentIndex: number, total: number) => void
): Promise<string> => {
  if (videoUrls.length === 0) throw new Error("No videos to stitch");

  const { width, height } = getDimensions(aspectRatio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("Could not get canvas context");

  // Fill black background initially
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, width, height);

  const videoStream = canvas.captureStream(30); // 30 FPS
  
  // Setup Audio (Mixer)
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const dest = audioCtx.createMediaStreamDestination();
  
  // Create recorder
  const combinedStream = new MediaStream([
    ...videoStream.getVideoTracks(),
    ...dest.stream.getAudioTracks()
  ]);

  const mimeTypes = [
    'video/webm;codecs=vp9',
    'video/webm',
    'video/mp4'
  ];
  
  const selectedMime = mimeTypes.find(mime => MediaRecorder.isTypeSupported(mime)) || '';
  
  const mediaRecorder = new MediaRecorder(combinedStream, {
    mimeType: selectedMime,
    videoBitsPerSecond: 5000000 // 5 Mbps
  });

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  mediaRecorder.start();

  // Shared Video Element
  const video = document.createElement('video');
  video.crossOrigin = "anonymous";
  video.playsInline = true;
  video.muted = false; // We need audio to go to the destination, but not speakers
  
  // Connect video audio to the stream destination
  // Note: createMediaElementSource can be tricky if the element is reused or src changes.
  // We will try to create it once.
  const source = audioCtx.createMediaElementSource(video);
  source.connect(dest);
  
  // Playback Loop
  for (let i = 0; i < videoUrls.length; i++) {
    onProgress(i, videoUrls.length);
    const url = videoUrls[i];
    
    await new Promise<void>((resolve, reject) => {
      video.src = url;
      video.onloadedmetadata = () => {
        video.play().then(() => {
          const draw = () => {
            if (video.paused || video.ended) return;
            ctx.drawImage(video, 0, 0, width, height);
            requestAnimationFrame(draw);
          };
          draw();
        }).catch(reject);
      };
      
      video.onended = () => {
        resolve();
      };
      
      video.onerror = (e) => {
        console.error("Video error", e);
        resolve(); // Skip on error
      };
    });
  }
  
  // Stop everything
  mediaRecorder.stop();
  audioCtx.close();
  
  return new Promise<string>((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: selectedMime || 'video/webm' });
      resolve(URL.createObjectURL(blob));
    };
  });
};