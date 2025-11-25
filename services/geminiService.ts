import { GoogleGenAI, Type } from "@google/genai";
import { StoryGenerationResponse, AspectRatio } from "../types";

// Helper to get client with current env key
const getClient = () => {
  // We recreate client to ensure we capture the latest key if selected via AI Studio
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateStoryStructure = async (
  topic: string
): Promise<StoryGenerationResponse> => {
  const ai = getClient();
  
  const prompt = `Write a short children's story about: "${topic}". 
  Break the story down into exactly 4 distinct scenes/pages.
  For each scene, provide the story text (what is read aloud) and a detailed visual prompt (for an image generator) describing the scene.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                storyText: { type: Type.STRING, description: "The narrative text for this page" },
                visualPrompt: { type: Type.STRING, description: "Detailed visual description of the scene for an image generator. Include characters, setting, lighting, and action." },
              },
              required: ["storyText", "visualPrompt"],
            },
          },
        },
        required: ["title", "scenes"],
      },
    },
  });

  if (!response.text) {
    throw new Error("No response from Gemini");
  }

  return JSON.parse(response.text) as StoryGenerationResponse;
};

export const generateSceneImage = async (
  visualPrompt: string,
  style: string,
  aspectRatio: AspectRatio = '16:9'
): Promise<string> => {
  const ai = getClient();
  
  // Combine visual prompt with style
  const fullPrompt = `${visualPrompt}. Style: ${style}. High quality, detailed, children's book illustration.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: fullPrompt,
    config: {
      imageConfig: {
        aspectRatio: aspectRatio,
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image generated");
};

export const generateSceneVideo = async (
  imageBase64: string,
  prompt: string,
  aspectRatio: AspectRatio = '16:9'
): Promise<string> => {
  const ai = getClient();
  
  // Strip prefix for API
  const base64Data = imageBase64.split(',')[1];
  const mimeType = imageBase64.substring(imageBase64.indexOf(':') + 1, imageBase64.indexOf(';'));

  // Veo 3.1 Fast primarily supports 16:9 and 9:16.
  // We map other ratios to 16:9 to ensure successful video generation.
  const validVeoRatios = ['16:9', '9:16'];
  const videoAspectRatio = validVeoRatios.includes(aspectRatio) ? aspectRatio : '16:9';

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: `Animate this scene subtly: ${prompt}. Keep it calm and magical.`,
    image: {
      imageBytes: base64Data,
      mimeType: mimeType,
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: videoAspectRatio, 
    }
  });

  // Poll for completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  
  if (!downloadLink) {
    throw new Error("Video generation failed to return a link");
  }

  // Fetch the actual video bytes using the key
  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!videoResponse.ok) throw new Error("Failed to download video blob");
  
  const videoBlob = await videoResponse.blob();
  return URL.createObjectURL(videoBlob);
};