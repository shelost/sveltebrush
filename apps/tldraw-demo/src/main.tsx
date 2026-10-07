import { INK_TOOL_ID, sveltebrushInk } from '@sveltebrush/tldraw';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import './index.css';

function App() {
	return (
		<div className="app">
			<Tldraw
				{...sveltebrushInk}
				persistenceKey="sveltebrush-tldraw-demo"
				licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
				onMount={(editor) => {
					editor.setCurrentTool(INK_TOOL_ID);
				}}
			/>
		</div>
	);
}

createRoot(document.getElementById('root') as HTMLElement).render(
	<StrictMode>
		<App />
	</StrictMode>
);
