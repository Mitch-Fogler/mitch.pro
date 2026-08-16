<script>
	function handleExit(e) {
		e.preventDefault();
		if (window.self !== window.top) {
			if (window.parent) {
				window.parent.postMessage({ type: 'closeTerminalIframe' }, '*');
			}
		} else {
			window.location.href = '/';
		}
	}
</script>

<div class="h-10 w-full bg-[#0a0f1d] border-b border-[#00ffcc]/30 flex items-center justify-between px-4 select-none font-mono text-xs">
	<!-- Left Brand -->
	<div class="flex items-center space-x-3">
		<a href="/" data-sveltekit-reload on:click={handleExit} class="flex items-center space-x-2 text-[#00ffcc] hover:text-[#00e6b8] transition-colors duration-200">
			<i class="fas fa-terminal text-[#00ffcc]"></i>
			<span class="font-bold tracking-widest text-[#00ffcc] uppercase hover:glow-strong">MitchCoins Mainframe</span>
		</a>
		<span class="text-[#00ffcc]/50">|</span>
		<span class="text-white/70 font-semibold">WebVM Terminal</span>
	</div>

	<!-- Center Info / Status -->
	<div class="hidden md:flex items-center space-x-4">
		<div class="flex items-center space-x-2 bg-[#00ffcc]/10 px-2 py-0.5 rounded border border-[#00ffcc]/20">
			<span class="h-2 w-2 rounded-full bg-[#00ffcc] animate-pulse"></span>
			<span class="text-[#00ffcc] font-semibold text-[10px] uppercase tracking-wider">CLIENT-SIDE VM STATUS: ONLINE</span>
		</div>
	</div>

	<!-- Right Navigation Actions -->
	<div class="flex items-center space-x-4">
		<a href="/" data-sveltekit-reload on:click={handleExit} class="flex items-center space-x-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 px-3 py-1 rounded border border-red-500/20 hover:border-red-500/40 transition-all duration-200 cursor-pointer">
			<i class="fas fa-power-off text-xs"></i>
			<span class="font-bold uppercase tracking-wider text-[10px]">Exit VM</span>
		</a>
	</div>
</div>

<style>
	.glow-strong {
		text-shadow: 0 0 8px rgba(0, 255, 204, 0.6);
	}
</style>
