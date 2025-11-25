import { ArtStyle, AspectRatio } from "./types";

export const STYLES = [
  { label: 'Disney 3D', value: ArtStyle.DISNEY, img: '🏰' },
  { label: 'Pixar 3D', value: ArtStyle.PIXAR, img: '🛋️' },
  { label: 'Watercolor', value: ArtStyle.WATERCOLOR, img: '🎨' },
  { label: 'Studio Ghibli', value: ArtStyle.ANIME, img: '🍃' },
  { label: 'Flat Vector', value: ArtStyle.FLAT, img: '🔶' },
  { label: 'Vintage', value: ArtStyle.VINTAGE, img: '📜' },
];

export const ASPECT_RATIOS: { label: string; value: AspectRatio }[] = [
  { label: 'Landscape (16:9)', value: '16:9' },
  { label: 'Portrait (9:16)', value: '9:16' },
  { label: 'Square (1:1)', value: '1:1' },
  { label: 'Standard (4:3)', value: '4:3' },
  { label: 'Tall (3:4)', value: '3:4' },
];

export const INITIAL_SCENES_COUNT = 4;