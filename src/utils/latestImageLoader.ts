import { validateImageFile } from './fileValidation';
import { loadImage } from './canvasUtils';

export function createLatestImageLoader(loader = async (file: File): Promise<HTMLImageElement> => {
  await validateImageFile(file);
  return loadImage(file);
}) {
  let generation = 0;
  return async (file: File, onLoaded: (image: HTMLImageElement) => void, onError: (error: unknown) => void): Promise<void> => {
    const request = ++generation;
    try {
      const image = await loader(file);
      if (request === generation) onLoaded(image);
    } catch (error) {
      if (request === generation) onError(error);
    }
  };
}
