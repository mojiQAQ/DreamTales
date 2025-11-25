import { Type } from "@google/genai";

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4';

export interface Scene {
  id: string;
  storyText: string;
  visualPrompt: string;
  status: 'pending' | 'generating-image' | 'image-ready' | 'generating-video' | 'video-ready' | 'error';
  imageUrl?: string;
  videoUrl?: string;
  error?: string;
  aspectRatio?: AspectRatio;
  isSelected?: boolean;
}

export enum ArtStyle {
  DISNEY = 'Disney Animation Style, 3D render, cute, expressive, vibrant lighting',
  PIXAR = 'Pixar Style, high fidelity, 3D, emotional, detailed textures',
  WATERCOLOR = 'Soft Watercolor, storybook illustration, dreamy, pastel colors',
  ANIME = 'Anime Style, Studio Ghibli inspired, lush backgrounds, detailed',
  FLAT = 'Flat Vector Art, simple, colorful, clean lines, modern',
  VINTAGE = 'Vintage Storybook, intricate line work, classic illustration, warm tones'
}

export interface StoryGenerationResponse {
  title: string;
  scenes: {
    storyText: string;
    visualPrompt: string;
  }[];
}
// AI Studio global types
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
