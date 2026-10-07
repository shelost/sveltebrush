/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Required by tldraw in production; local development works without it. */
	readonly VITE_TLDRAW_LICENSE_KEY?: string;
}
