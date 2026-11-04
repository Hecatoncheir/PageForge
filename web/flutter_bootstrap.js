{{flutter_js}}
{{flutter_build_config}}

_flutter.loader.load({
  config: {
    renderer: 'canvaskit',
    hostElement: document.getElementById('pageforge-app'),
    canvasKitVariant: 'full',
    canvasKitBaseUrl: 'canvaskit/',
    fontFallbackBaseUrl: 'assets/fonts/',
  },
});

