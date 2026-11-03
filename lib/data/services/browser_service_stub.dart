import '../../domain/models/browser_context.dart';

Future<BrowserContext> readBrowserContext() async {
  return const BrowserContext(
    siteLabel: 'Предпросмотр интерфейса',
    version: String.fromEnvironment('PAGEFORGE_VERSION', defaultValue: '0.1.0'),
  );
}
