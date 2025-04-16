import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		target: 'esnext',
	},
	optimizeDeps: {
		esbuildOptions: {
			target: 'esnext'
		}
	},
	plugins: [
		{
			name: "configure-response-headers",
			configureServer: (server) => {
				server.middlewares.use((req, res, next) => {
					res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
					res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
					next();
				});
			},
		},
	],
});
