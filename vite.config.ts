import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React vendor chunk
          'react-vendor': ['react', 'react-dom'],
          // Radix UI components
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-slider',
            '@radix-ui/react-tabs',
            '@radix-ui/react-label',
            '@radix-ui/react-separator',
          ],
          // Utilities
          'utils': [
            'lucide-react',
            'sonner',
            'class-variance-authority',
            'clsx',
            'tailwind-merge',
          ],
        },
      },
    },
    // 청크 크기 경고 임계값
    chunkSizeWarningLimit: 1000,
    // 소스맵 비활성화 (프로덕션)
    sourcemap: false,
    // 압축 최적화 (esbuild 사용 - Vite 기본값, 더 빠름)
    minify: 'esbuild',
  },
  // 개발 서버 최적화
  server: {
    hmr: {
      overlay: true,
    },
  },
})
